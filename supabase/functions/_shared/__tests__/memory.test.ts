import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeMemoryCommand,
  validateMemoryPath,
  screenContent,
  MemoryStore,
  MemoryRow,
  MemoryCommandInput,
} from '../memory';

/** Map-backed MemoryStore for exercising command logic without Supabase. */
function createInMemoryStore(seed: Record<string, string> = {}): MemoryStore {
  const files = new Map<string, string>(Object.entries(seed));
  return {
    async listAll(): Promise<MemoryRow[]> {
      return [...files.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([path, content]) => ({ path, content }));
    },
    async get(path: string): Promise<MemoryRow | null> {
      const content = files.get(path);
      return content === undefined ? null : { path, content };
    },
    async put(path: string, content: string): Promise<void> {
      files.set(path, content);
    },
    async remove(path: string): Promise<void> {
      files.delete(path);
    },
    async removePrefix(prefix: string): Promise<void> {
      for (const path of [...files.keys()]) {
        if (path.startsWith(`${prefix}/`)) files.delete(path);
      }
    },
    async move(oldPath: string, newPath: string): Promise<void> {
      const content = files.get(oldPath);
      if (content !== undefined) {
        files.delete(oldPath);
        files.set(newPath, content);
      }
    },
  };
}

const run = (store: MemoryStore, input: MemoryCommandInput) =>
  executeMemoryCommand(store, input);

describe('validateMemoryPath', () => {
  it('accepts the root, top-level files, and one subdirectory level', () => {
    expect(validateMemoryPath('/memories', 'file-or-dir')).toBeNull();
    expect(validateMemoryPath('/memories/founder.md', 'file')).toBeNull();
    expect(validateMemoryPath('/memories/sessions/2026-06-11.md', 'file')).toBeNull();
  });

  it('rejects traversal, encoded traversal, backslashes and null bytes', () => {
    expect(validateMemoryPath('/memories/../secrets.md', 'file')).toMatch(/not allowed/);
    expect(validateMemoryPath('/memories/%2e%2e/x.md', 'file')).toMatch(/not allowed/);
    expect(validateMemoryPath('/memories/%2E%2E/x.md', 'file')).toMatch(/not allowed/);
    expect(validateMemoryPath('/memories\\x.md', 'file')).toMatch(/not valid/);
    expect(validateMemoryPath('/memories/a\0b.md', 'file')).toMatch(/not valid/);
  });

  it('rejects paths outside /memories and hidden segments', () => {
    expect(validateMemoryPath('/etc/passwd', 'file')).toMatch(/not valid/);
    expect(validateMemoryPath('/memoriesx/a.md', 'file')).toMatch(/not valid/);
    expect(validateMemoryPath('/memories/.hidden.md', 'file')).toMatch(/not allowed/);
  });

  it('rejects over-deep paths and non-md files', () => {
    expect(validateMemoryPath('/memories/a/b/c.md', 'file')).toMatch(/too deep/);
    expect(validateMemoryPath('/memories/notes.txt', 'file')).toMatch(/\.md/);
    expect(validateMemoryPath('/memories', 'file')).toMatch(/directory/);
  });
});

describe('screenContent', () => {
  it('flags secret-shaped content', () => {
    expect(screenContent('key: sk-ant-abc123def456ghi')).not.toBeNull();
    expect(screenContent('AKIAIOSFODNN7EXAMPLE')).not.toBeNull();
    expect(screenContent('password = hunter22')).not.toBeNull();
    expect(
      screenContent('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT')
    ).not.toBeNull();
  });

  it('passes ordinary coaching notes', () => {
    expect(screenContent('Founder left a 15-year corporate career.')).toBeNull();
  });
});

describe('view', () => {
  it('lists the root directory with sizes and subdirectory aggregates', async () => {
    const store = createInMemoryStore({
      '/memories/index.md': '# Index\n',
      '/memories/sessions/kickoff.md': 'Notes from kickoff session',
    });
    const { result, isError } = await run(store, { command: 'view', path: '/memories' });
    expect(isError).toBe(false);
    expect(result).toContain(
      "Here're the files and directories up to 2 levels deep in /memories"
    );
    expect(result).toContain('/memories/index.md');
    expect(result).toContain('/memories/sessions');
    expect(result).toContain('/memories/sessions/kickoff.md');
  });

  it('shows file content with 6-char right-aligned line numbers', async () => {
    const store = createInMemoryStore({ '/memories/founder.md': 'line one\nline two' });
    const { result, isError } = await run(store, {
      command: 'view',
      path: '/memories/founder.md',
    });
    expect(isError).toBe(false);
    expect(result).toContain("Here's the content of /memories/founder.md with line numbers:");
    expect(result).toContain('     1\tline one');
    expect(result).toContain('     2\tline two');
  });

  it('honours view_range including -1 for end-of-file', async () => {
    const store = createInMemoryStore({ '/memories/founder.md': 'a\nb\nc\nd' });
    const ranged = await run(store, {
      command: 'view',
      path: '/memories/founder.md',
      view_range: [2, 3],
    });
    expect(ranged.result).toContain('     2\tb');
    expect(ranged.result).toContain('     3\tc');
    expect(ranged.result).not.toContain('     4\td');

    const toEnd = await run(store, {
      command: 'view',
      path: '/memories/founder.md',
      view_range: [3, -1],
    });
    expect(toEnd.result).toContain('     4\td');
  });

  it('errors on a missing file and a missing directory', async () => {
    const store = createInMemoryStore();
    const file = await run(store, { command: 'view', path: '/memories/nope.md' });
    expect(file.isError).toBe(true);
    expect(file.result).toBe(
      'The path /memories/nope.md does not exist. Please provide a valid path.'
    );
    const dir = await run(store, { command: 'view', path: '/memories/sessions' });
    expect(dir.isError).toBe(true);
  });
});

describe('create', () => {
  it('creates a new file', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'create',
      path: '/memories/founder.md',
      file_text: 'Founder: Sam, brand InfinityVault',
    });
    expect(isError).toBe(false);
    expect(result).toBe('File created successfully at: /memories/founder.md');
    expect((await store.get('/memories/founder.md'))?.content).toContain('Sam');
  });

  it('overwrites an existing file (create-or-overwrite semantics)', async () => {
    const store = createInMemoryStore({ '/memories/coaching.md': 'old state' });
    const { isError } = await run(store, {
      command: 'create',
      path: '/memories/coaching.md',
      file_text: 'new state',
    });
    expect(isError).toBe(false);
    expect((await store.get('/memories/coaching.md'))?.content).toBe('new state');
  });

  it('enforces the size cap with an instructive error', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'create',
      path: '/memories/big.md',
      file_text: 'x'.repeat(9000),
    });
    expect(isError).toBe(true);
    expect(result).toMatch(/too large/);
  });

  it('enforces the per-user file cap for new paths but allows overwrites', async () => {
    const seed: Record<string, string> = {};
    for (let i = 0; i < 30; i++) seed[`/memories/f${i}.md`] = 'x';
    const store = createInMemoryStore(seed);

    const blocked = await run(store, {
      command: 'create',
      path: '/memories/f30.md',
      file_text: 'x',
    });
    expect(blocked.isError).toBe(true);
    expect(blocked.result).toMatch(/Consolidate or delete/);

    const overwrite = await run(store, {
      command: 'create',
      path: '/memories/f0.md',
      file_text: 'updated',
    });
    expect(overwrite.isError).toBe(false);
  });

  it('refuses secret-shaped content', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'create',
      path: '/memories/founder.md',
      file_text: 'their api_key = abc123secret',
    });
    expect(isError).toBe(true);
    expect(result).toMatch(/secret or credential/);
  });
});

describe('str_replace', () => {
  it('replaces a unique occurrence and returns a numbered snippet', async () => {
    const store = createInMemoryStore({
      '/memories/brand.md': 'Positioning Statement: dignity angle\nStatus: exploring',
    });
    const { result, isError } = await run(store, {
      command: 'str_replace',
      path: '/memories/brand.md',
      old_str: 'Status: exploring',
      new_str: 'Status: chosen',
    });
    expect(isError).toBe(false);
    expect(result).toContain('The memory file has been edited.');
    expect(result).toMatch(/\d+\tStatus: chosen/);
    expect((await store.get('/memories/brand.md'))?.content).toContain('Status: chosen');
  });

  it('errors when old_str is absent', async () => {
    const store = createInMemoryStore({ '/memories/brand.md': 'content' });
    const { result, isError } = await run(store, {
      command: 'str_replace',
      path: '/memories/brand.md',
      old_str: 'missing text',
      new_str: 'x',
    });
    expect(isError).toBe(true);
    expect(result).toBe(
      'No replacement was performed, old_str `missing text` did not appear verbatim in /memories/brand.md.'
    );
  });

  it('errors with line numbers when old_str appears multiple times', async () => {
    const store = createInMemoryStore({
      '/memories/brand.md': 'note\nother\nnote',
    });
    const { result, isError } = await run(store, {
      command: 'str_replace',
      path: '/memories/brand.md',
      old_str: 'note',
      new_str: 'x',
    });
    expect(isError).toBe(true);
    expect(result).toContain('Multiple occurrences of old_str `note` in lines: 1, 3');
  });

  it('errors on a missing file', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'str_replace',
      path: '/memories/none.md',
      old_str: 'a',
      new_str: 'b',
    });
    expect(isError).toBe(true);
    expect(result).toBe(
      'Error: The path /memories/none.md does not exist. Please provide a valid path.'
    );
  });
});

describe('insert', () => {
  it('inserts at the top with insert_line 0 and mid-file', async () => {
    const store = createInMemoryStore({ '/memories/coaching.md': 'first\nsecond' });
    const top = await run(store, {
      command: 'insert',
      path: '/memories/coaching.md',
      insert_line: 0,
      insert_text: 'zeroth\n',
    });
    expect(top.isError).toBe(false);
    expect(top.result).toBe('The file /memories/coaching.md has been edited.');
    expect((await store.get('/memories/coaching.md'))?.content).toBe(
      'zeroth\nfirst\nsecond'
    );
  });

  it('rejects out-of-range insert_line with the documented message', async () => {
    const store = createInMemoryStore({ '/memories/coaching.md': 'one\ntwo' });
    const { result, isError } = await run(store, {
      command: 'insert',
      path: '/memories/coaching.md',
      insert_line: 5,
      insert_text: 'x',
    });
    expect(isError).toBe(true);
    expect(result).toBe(
      'Error: Invalid `insert_line` parameter: 5. It should be within the range of lines of the file: [0, 2]'
    );
  });
});

describe('delete', () => {
  it('deletes a file', async () => {
    const store = createInMemoryStore({ '/memories/old.md': 'x' });
    const { result, isError } = await run(store, {
      command: 'delete',
      path: '/memories/old.md',
    });
    expect(isError).toBe(false);
    expect(result).toBe('Successfully deleted /memories/old.md');
    expect(await store.get('/memories/old.md')).toBeNull();
  });

  it('deletes a directory recursively', async () => {
    const store = createInMemoryStore({
      '/memories/sessions/a.md': 'x',
      '/memories/sessions/b.md': 'y',
      '/memories/founder.md': 'keep',
    });
    const { isError } = await run(store, {
      command: 'delete',
      path: '/memories/sessions',
    });
    expect(isError).toBe(false);
    expect(await store.get('/memories/sessions/a.md')).toBeNull();
    expect(await store.get('/memories/sessions/b.md')).toBeNull();
    expect(await store.get('/memories/founder.md')).not.toBeNull();
  });

  it('refuses to delete the /memories root', async () => {
    const store = createInMemoryStore({ '/memories/founder.md': 'x' });
    const { result, isError } = await run(store, { command: 'delete', path: '/memories' });
    expect(isError).toBe(true);
    expect(result).toMatch(/cannot be deleted/);
  });

  it('errors on a missing path', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'delete',
      path: '/memories/none.md',
    });
    expect(isError).toBe(true);
    expect(result).toBe('Error: The path /memories/none.md does not exist');
  });
});

describe('rename', () => {
  it('renames a file', async () => {
    const store = createInMemoryStore({ '/memories/draft.md': 'content' });
    const { result, isError } = await run(store, {
      command: 'rename',
      old_path: '/memories/draft.md',
      new_path: '/memories/final.md',
    });
    expect(isError).toBe(false);
    expect(result).toBe('Successfully renamed /memories/draft.md to /memories/final.md');
    expect(await store.get('/memories/draft.md')).toBeNull();
    expect((await store.get('/memories/final.md'))?.content).toBe('content');
  });

  it('refuses to overwrite an existing destination', async () => {
    const store = createInMemoryStore({
      '/memories/a.md': 'x',
      '/memories/b.md': 'y',
    });
    const { result, isError } = await run(store, {
      command: 'rename',
      old_path: '/memories/a.md',
      new_path: '/memories/b.md',
    });
    expect(isError).toBe(true);
    expect(result).toBe('Error: The destination /memories/b.md already exists');
  });

  it('errors when the source does not exist', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'rename',
      old_path: '/memories/none.md',
      new_path: '/memories/new.md',
    });
    expect(isError).toBe(true);
    expect(result).toBe('Error: The path /memories/none.md does not exist');
  });
});

describe('dispatcher resilience', () => {
  it('returns an error result for unknown commands', async () => {
    const store = createInMemoryStore();
    const { result, isError } = await run(store, {
      command: 'chmod' as MemoryCommandInput['command'],
    });
    expect(isError).toBe(true);
    expect(result).toContain('Unknown memory command');
  });

  it('converts store failures into error strings instead of throwing', async () => {
    const store = createInMemoryStore();
    store.get = async () => {
      throw new Error('connection reset');
    };
    const { result, isError } = await run(store, {
      command: 'view',
      path: '/memories/founder.md',
    });
    expect(isError).toBe(true);
    expect(result).toBe('Memory error: connection reset');
  });
});
