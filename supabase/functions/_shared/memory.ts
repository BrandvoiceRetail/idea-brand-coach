/**
 * Memory tool handler — backing implementation for Anthropic's client-side
 * memory tool (`memory_20250818`) against the `user_memories` table.
 *
 * Each row is one memory "file" under the per-user /memories directory;
 * directories are implicit path prefixes. Return strings follow the
 * conventions documented for the memory tool so the model recognises them
 * (directory listing shape, 6-char right-aligned line numbers, exact error
 * phrasing for missing paths / duplicate matches / existing destinations).
 *
 * Layering: `executeMemoryCommand(store, input)` holds all command logic and
 * is storage-agnostic (unit-testable with an in-memory store);
 * `createSupabaseMemoryStore(client, userId)` is the thin RLS-scoped adapter;
 * `handleMemoryCommand(client, userId, input)` is the edge-function entry.
 *
 * Deliberate divergence from the reference spec: `create` upserts
 * (create-or-overwrite) instead of erroring on an existing file — Trevor's
 * write policy is "replace outdated notes", and erroring would force
 * delete-then-create round-trips.
 */

const MEMORY_ROOT = '/memories';
/** Max characters per memory file (DB CHECK mirrors this as defense in depth). */
const MAX_FILE_CHARS = 8192;
/** Max memory files per user. */
const MAX_FILES_PER_USER = 30;
/** Max path depth below /memories (allows /memories/sessions/note.md). */
const MAX_DEPTH = 2;

export interface MemoryCommandInput {
  command: 'view' | 'create' | 'str_replace' | 'insert' | 'delete' | 'rename';
  path?: string;
  file_text?: string;
  old_str?: string;
  new_str?: string;
  insert_line?: number;
  insert_text?: string;
  view_range?: [number, number];
  old_path?: string;
  new_path?: string;
}

export interface MemoryCommandResult {
  result: string;
  isError: boolean;
}

export interface MemoryRow {
  path: string;
  content: string;
}

/** Storage seam — command logic depends on this, not on Supabase. */
export interface MemoryStore {
  /** All memory rows for the user, ordered by path. */
  listAll(): Promise<MemoryRow[]>;
  get(path: string): Promise<MemoryRow | null>;
  /** Create-or-overwrite. */
  put(path: string, content: string): Promise<void>;
  remove(path: string): Promise<void>;
  /** Remove every row whose path starts with `${prefix}/`. */
  removePrefix(prefix: string): Promise<void>;
  move(oldPath: string, newPath: string): Promise<void>;
}

// ── Path validation ─────────────────────────────────────────────────────────

/**
 * Validate a memory path. Returns an error string, or null when valid.
 * `kind` distinguishes file targets (.md, depth-capped) from paths that may
 * also be directories (view/delete).
 */
export function validateMemoryPath(
  rawPath: string | undefined,
  kind: 'file' | 'file-or-dir'
): string | null {
  if (!rawPath || typeof rawPath !== 'string') {
    return 'Error: A path is required. Paths must live under /memories.';
  }
  const path = rawPath.trim();

  if (path.length > 200) return 'Error: Path is too long.';
  if (path.includes('\0') || path.includes('\\')) {
    return `Error: The path ${path} is not valid. Paths must live under /memories.`;
  }
  // Reject traversal incl. URL-encoded variants before any prefix check.
  if (/\.\.|%2e/i.test(path)) {
    return `Error: The path ${path} is not allowed. Paths must stay within /memories.`;
  }
  if (path !== MEMORY_ROOT && !path.startsWith(`${MEMORY_ROOT}/`)) {
    return `Error: The path ${path} is not valid. Paths must live under /memories.`;
  }

  const rest = path === MEMORY_ROOT ? '' : path.slice(MEMORY_ROOT.length + 1);
  const segments = rest === '' ? [] : rest.split('/');

  for (const segment of segments) {
    if (segment === '') {
      return `Error: The path ${path} is not valid. Paths must live under /memories.`;
    }
    if (segment.startsWith('.')) {
      return `Error: The path ${path} is not allowed. Hidden files are not permitted.`;
    }
    if (!/^[A-Za-z0-9._-]+$/.test(segment)) {
      return `Error: The path ${path} contains unsupported characters. Use letters, numbers, dots, dashes and underscores.`;
    }
  }

  if (segments.length > MAX_DEPTH) {
    return `Error: The path ${path} is too deep. Memory files may be at most ${MAX_DEPTH} levels below /memories.`;
  }

  if (kind === 'file') {
    if (path === MEMORY_ROOT) {
      return `Error: The path ${path} is a directory, not a file.`;
    }
    if (!path.endsWith('.md')) {
      return `Error: The path ${path} must be a Markdown file ending in .md.`;
    }
  }

  return null;
}

// ── Content screening ───────────────────────────────────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[A-Za-z0-9_-]{8,}/, // Anthropic keys
  /sk-[A-Za-z0-9]{20,}/, // generic sk- API keys
  /AKIA[0-9A-Z]{16}/, // AWS access keys
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}/, // JWTs
  /password\s*[:=]\s*\S+/i,
  /api[_-]?key\s*[:=]\s*\S+/i,
];

/** Returns an error string when content looks like it contains a secret. */
export function screenContent(content: string): string | null {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(content)) {
      return 'Error: The content appears to contain a secret or credential (API key, password or token). Never store secrets or sensitive credentials in memory.';
    }
  }
  return null;
}

// ── Rendering helpers ───────────────────────────────────────────────────────

export function humanSize(chars: number): string {
  if (chars < 1024) return `${chars}`;
  return `${(chars / 1024).toFixed(1)}K`;
}

function numberLines(content: string, range?: [number, number]): string {
  const lines = content.split('\n');
  let start = 1;
  let end = lines.length;
  if (range) {
    start = Math.max(1, range[0]);
    end = range[1] === -1 ? lines.length : Math.min(lines.length, range[1]);
  }
  const out: string[] = [];
  for (let i = start; i <= end; i++) {
    out.push(`${String(i).padStart(6, ' ')}\t${lines[i - 1]}`);
  }
  return out.join('\n');
}

function renderDirectoryListing(viewPath: string, rows: MemoryRow[]): string {
  const prefix = viewPath === MEMORY_ROOT ? `${MEMORY_ROOT}/` : `${viewPath}/`;
  const inScope = rows.filter((row) => row.path.startsWith(prefix));

  const fileLines: string[] = [];
  const dirSizes = new Map<string, number>();
  let totalSize = 0;

  for (const row of inScope) {
    const rest = row.path.slice(prefix.length);
    const segments = rest.split('/');
    totalSize += row.content.length;
    if (segments.length === 1) {
      fileLines.push(`${humanSize(row.content.length)}\t${row.path}`);
    } else {
      // Aggregate first-level subdirectories (listing is 2 levels deep).
      const dir = `${prefix}${segments[0]}`;
      dirSizes.set(dir, (dirSizes.get(dir) ?? 0) + row.content.length);
      fileLines.push(`${humanSize(row.content.length)}\t${row.path}`);
    }
  }

  const dirLines = [...dirSizes.entries()].map(
    ([dir, size]) => `${humanSize(size)}\t${dir}`
  );

  const entries = [...dirLines, ...fileLines].sort((a, b) => {
    const pathA = a.split('\t')[1];
    const pathB = b.split('\t')[1];
    return pathA.localeCompare(pathB);
  });

  return [
    `Here're the files and directories up to 2 levels deep in ${viewPath}, excluding hidden items:`,
    `${humanSize(totalSize)}\t${viewPath}`,
    ...entries,
  ].join('\n');
}

// ── Command implementations ─────────────────────────────────────────────────

async function commandView(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const pathError = validateMemoryPath(input.path, 'file-or-dir');
  if (pathError) return { result: pathError, isError: true };
  const path = (input.path as string).trim();

  // File view first; fall back to directory listing.
  if (path.endsWith('.md')) {
    const row = await store.get(path);
    if (!row) {
      return {
        result: `The path ${path} does not exist. Please provide a valid path.`,
        isError: true,
      };
    }
    return {
      result: `Here's the content of ${path} with line numbers:\n${numberLines(row.content, input.view_range)}`,
      isError: false,
    };
  }

  const rows = await store.listAll();
  if (path !== MEMORY_ROOT && !rows.some((row) => row.path.startsWith(`${path}/`))) {
    return {
      result: `The path ${path} does not exist. Please provide a valid path.`,
      isError: true,
    };
  }
  return { result: renderDirectoryListing(path, rows), isError: false };
}

async function commandCreate(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const pathError = validateMemoryPath(input.path, 'file');
  if (pathError) return { result: pathError, isError: true };
  const path = (input.path as string).trim();

  const fileText = input.file_text ?? '';
  if (fileText.length > MAX_FILE_CHARS) {
    return {
      result: `Error: The file is too large (${fileText.length} characters; the limit is ${MAX_FILE_CHARS}). Keep memory files concise — replace outdated notes instead of appending.`,
      isError: true,
    };
  }
  const secretError = screenContent(fileText);
  if (secretError) return { result: secretError, isError: true };

  const existing = await store.get(path);
  if (!existing) {
    const rows = await store.listAll();
    if (rows.length >= MAX_FILES_PER_USER) {
      return {
        result: `Error: The memory directory already holds ${MAX_FILES_PER_USER} files. Consolidate or delete files that are no longer relevant before creating new ones.`,
        isError: true,
      };
    }
  }

  await store.put(path, fileText);
  return { result: `File created successfully at: ${path}`, isError: false };
}

async function commandStrReplace(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const pathError = validateMemoryPath(input.path, 'file');
  if (pathError) return { result: pathError, isError: true };
  const path = (input.path as string).trim();

  const row = await store.get(path);
  if (!row) {
    return {
      result: `Error: The path ${path} does not exist. Please provide a valid path.`,
      isError: true,
    };
  }

  const oldStr = input.old_str ?? '';
  const newStr = input.new_str ?? '';
  if (oldStr === '') {
    return { result: 'Error: old_str must not be empty.', isError: true };
  }

  const occurrences = row.content.split(oldStr).length - 1;
  if (occurrences === 0) {
    return {
      result: `No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in ${path}.`,
      isError: true,
    };
  }
  if (occurrences > 1) {
    const lineNumbers = row.content
      .split('\n')
      .map((line, i) => (line.includes(oldStr) ? i + 1 : 0))
      .filter((n) => n > 0)
      .join(', ');
    return {
      result: `No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines: ${lineNumbers}. Please ensure it is unique`,
      isError: true,
    };
  }

  const updated = row.content.replace(oldStr, newStr);
  if (updated.length > MAX_FILE_CHARS) {
    return {
      result: `Error: The edit would make the file too large (${updated.length} characters; the limit is ${MAX_FILE_CHARS}).`,
      isError: true,
    };
  }
  const secretError = screenContent(newStr);
  if (secretError) return { result: secretError, isError: true };

  await store.put(path, updated);

  // Snippet: a few lines around the replacement site.
  const replaceLine = updated.slice(0, updated.indexOf(newStr)).split('\n').length;
  const snippetStart = Math.max(1, replaceLine - 3);
  const snippetEnd = replaceLine + 3 + newStr.split('\n').length;
  return {
    result: `The memory file has been edited.\n${numberLines(updated, [snippetStart, snippetEnd])}`,
    isError: false,
  };
}

async function commandInsert(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const pathError = validateMemoryPath(input.path, 'file');
  if (pathError) return { result: pathError, isError: true };
  const path = (input.path as string).trim();

  const row = await store.get(path);
  if (!row) {
    return { result: `Error: The path ${path} does not exist`, isError: true };
  }

  const lines = row.content.split('\n');
  const insertLine = input.insert_line ?? -1;
  if (insertLine < 0 || insertLine > lines.length) {
    return {
      result: `Error: Invalid \`insert_line\` parameter: ${insertLine}. It should be within the range of lines of the file: [0, ${lines.length}]`,
      isError: true,
    };
  }

  const insertText = input.insert_text ?? '';
  const secretError = screenContent(insertText);
  if (secretError) return { result: secretError, isError: true };

  const insertedLines = insertText.endsWith('\n')
    ? insertText.slice(0, -1).split('\n')
    : insertText.split('\n');
  lines.splice(insertLine, 0, ...insertedLines);
  const updated = lines.join('\n');
  if (updated.length > MAX_FILE_CHARS) {
    return {
      result: `Error: The edit would make the file too large (${updated.length} characters; the limit is ${MAX_FILE_CHARS}).`,
      isError: true,
    };
  }

  await store.put(path, updated);
  return { result: `The file ${path} has been edited.`, isError: false };
}

async function commandDelete(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const pathError = validateMemoryPath(input.path, 'file-or-dir');
  if (pathError) return { result: pathError, isError: true };
  const path = (input.path as string).trim();

  if (path === MEMORY_ROOT) {
    return {
      result: `Error: The root directory ${MEMORY_ROOT} cannot be deleted.`,
      isError: true,
    };
  }

  if (path.endsWith('.md')) {
    const row = await store.get(path);
    if (!row) {
      return { result: `Error: The path ${path} does not exist`, isError: true };
    }
    await store.remove(path);
    return { result: `Successfully deleted ${path}`, isError: false };
  }

  const rows = await store.listAll();
  if (!rows.some((row) => row.path.startsWith(`${path}/`))) {
    return { result: `Error: The path ${path} does not exist`, isError: true };
  }
  await store.removePrefix(path);
  return { result: `Successfully deleted ${path}`, isError: false };
}

async function commandRename(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  const oldError = validateMemoryPath(input.old_path, 'file');
  if (oldError) return { result: oldError, isError: true };
  const newError = validateMemoryPath(input.new_path, 'file');
  if (newError) return { result: newError, isError: true };
  const oldPath = (input.old_path as string).trim();
  const newPath = (input.new_path as string).trim();

  const source = await store.get(oldPath);
  if (!source) {
    return { result: `Error: The path ${oldPath} does not exist`, isError: true };
  }
  const destination = await store.get(newPath);
  if (destination) {
    return {
      result: `Error: The destination ${newPath} already exists`,
      isError: true,
    };
  }

  await store.move(oldPath, newPath);
  return { result: `Successfully renamed ${oldPath} to ${newPath}`, isError: false };
}

// ── Entry points ────────────────────────────────────────────────────────────

/** Storage-agnostic command dispatcher (unit-test against an in-memory store). */
export async function executeMemoryCommand(
  store: MemoryStore,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  try {
    switch (input.command) {
      case 'view':
        return await commandView(store, input);
      case 'create':
        return await commandCreate(store, input);
      case 'str_replace':
        return await commandStrReplace(store, input);
      case 'insert':
        return await commandInsert(store, input);
      case 'delete':
        return await commandDelete(store, input);
      case 'rename':
        return await commandRename(store, input);
      default:
        return {
          result: `Error: Unknown memory command: ${String(input.command)}`,
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Memory] Command failed:', input.command, message);
    return { result: `Memory error: ${message}`, isError: true };
  }
}

// Minimal structural typing of the Supabase query chains this adapter uses,
// so this module stays importable under Vitest (no URL imports).
interface MemoryQueryResponse {
  data: unknown;
  error: { message: string } | null;
}
interface MemoryQueryBuilder extends PromiseLike<MemoryQueryResponse> {
  select(columns: string): MemoryQueryBuilder;
  upsert(
    values: Record<string, unknown>,
    options?: { onConflict?: string }
  ): MemoryQueryBuilder;
  update(values: Record<string, unknown>): MemoryQueryBuilder;
  delete(): MemoryQueryBuilder;
  eq(column: string, value: string): MemoryQueryBuilder;
  like(column: string, pattern: string): MemoryQueryBuilder;
  order(column: string, options?: { ascending?: boolean }): MemoryQueryBuilder;
  maybeSingle(): PromiseLike<MemoryQueryResponse>;
}
export interface SupabaseClientLike {
  from(table: string): MemoryQueryBuilder;
}

/**
 * RLS-scoped adapter. `client` must be the request-scoped client carrying the
 * user's JWT (RLS enforces isolation); the explicit user_id filters are
 * defense in depth.
 */
export function createSupabaseMemoryStore(
  client: SupabaseClientLike,
  userId: string
): MemoryStore {
  const TABLE = 'user_memories';

  function throwOnError(response: MemoryQueryResponse, operation: string): void {
    if (response.error) {
      throw new Error(`${operation} failed: ${response.error.message}`);
    }
  }

  return {
    async listAll(): Promise<MemoryRow[]> {
      const response = await client
        .from(TABLE)
        .select('path, content')
        .eq('user_id', userId)
        .order('path', { ascending: true });
      throwOnError(response, 'list');
      return (response.data as MemoryRow[] | null) ?? [];
    },

    async get(path: string): Promise<MemoryRow | null> {
      const response = await client
        .from(TABLE)
        .select('path, content')
        .eq('user_id', userId)
        .eq('path', path)
        .maybeSingle();
      throwOnError(response, 'read');
      return (response.data as MemoryRow | null) ?? null;
    },

    async put(path: string, content: string): Promise<void> {
      const response = await client
        .from(TABLE)
        .upsert(
          { user_id: userId, path, content },
          { onConflict: 'user_id,path' }
        );
      throwOnError(response, 'write');
    },

    async remove(path: string): Promise<void> {
      const response = await client
        .from(TABLE)
        .delete()
        .eq('user_id', userId)
        .eq('path', path);
      throwOnError(response, 'delete');
    },

    async removePrefix(prefix: string): Promise<void> {
      const response = await client
        .from(TABLE)
        .delete()
        .eq('user_id', userId)
        .like('path', `${prefix}/%`);
      throwOnError(response, 'delete');
    },

    async move(oldPath: string, newPath: string): Promise<void> {
      const response = await client
        .from(TABLE)
        .update({ path: newPath })
        .eq('user_id', userId)
        .eq('path', oldPath);
      throwOnError(response, 'rename');
    },
  };
}

/** Edge-function entry point: execute one memory tool command for a user. */
export async function handleMemoryCommand(
  client: SupabaseClientLike,
  userId: string,
  input: MemoryCommandInput
): Promise<MemoryCommandResult> {
  return executeMemoryCommand(createSupabaseMemoryStore(client, userId), input);
}
