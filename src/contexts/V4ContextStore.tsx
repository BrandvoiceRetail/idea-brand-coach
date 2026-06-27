/**
 * V4ContextStore — the front-end half of the "I won't ask twice" loop.
 *
 * Mirrors the MCP `get_context_status` / `provide_context` seam (src/mcp/tools/):
 * a catalogue of context slots, each resolving to a status. Anything not
 * owner-stated / evidence-backed is surfaced as `needsInput` for the coach to
 * ask about; once answered it flips to `filled-stated` and is never re-asked.
 *
 * Backed by localStorage, scoped per authenticated user (or a guest bucket) so a
 * returning user keeps their Context Card. This is the client store-of-record for
 * the /v4 surface; the MCP tools remain the canonical server-side resolver.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/hooks/useAuth';

/** Slot statuses mirror the MCP resolver's SlotStatus union. */
export type V4SlotStatus =
  | 'filled-stated'
  | 'filled-evidence'
  | 'filled-inferred'
  | 'missing';

/** Statuses that satisfy a slot — anything else queues for clarification. */
const SATISFIED: ReadonlySet<V4SlotStatus> = new Set<V4SlotStatus>([
  'filled-stated',
  'filled-evidence',
]);

/** A context slot definition (the never-ask-twice catalogue). */
export interface V4SlotDef {
  key: string;
  /** Human label for the Context Card. */
  name: string;
  /** The question the coach asks when this slot is unfilled. */
  askQuestion: string;
}

/** Loop-1 onboarding context catalogue. Extend as later loops land. */
export const V4_SLOTS: readonly V4SlotDef[] = [
  { key: 'brand_name', name: 'Brand name', askQuestion: "What's your brand called?" },
  { key: 'product', name: 'Product', askQuestion: 'What do you sell?' },
  { key: 'customer', name: 'Customer', askQuestion: 'Who is it for?' },
  { key: 'problem', name: 'Problem solved', askQuestion: 'What problem does it solve for them?' },
  { key: 'channel', name: 'Primary channel', askQuestion: 'Where do you mainly sell?' },
  { key: 'goal', name: 'Goal', askQuestion: "What's the outcome you're after?" },
] as const;

/** A resolved slot as held in the store. */
export interface V4ResolvedSlot {
  key: string;
  name: string;
  askQuestion: string;
  status: V4SlotStatus;
  value: string | null;
  /** Where the value came from (e.g. 'megaprompt', 'manual', 'confirmed'). */
  source: string | null;
}

/** A persisted answer payload. */
export interface V4Answer {
  key: string;
  value: string;
  /** Defaults to 'manual'; megaprompt extraction passes 'megaprompt'. */
  source?: string;
  /** Treat as confirmed-stated even if originally inferred. */
  confirm?: boolean;
}

interface StoredEntry {
  value: string;
  status: V4SlotStatus;
  source: string | null;
}

type StoreShape = Record<string, StoredEntry>;

export interface V4ContextValue {
  /** Every slot resolved to its current status + value. */
  fillMap: V4ResolvedSlot[];
  /** Slots the coach should still ask about (not stated/evidence). */
  needsInput: V4ResolvedSlot[];
  /** True when every slot is satisfied. */
  allFilled: boolean;
  /** The filled slots, for the Context Card. */
  contextCard: V4ResolvedSlot[];
  /** Persist one or more answers, flipping their status to filled-stated. */
  provideContext: (answers: V4Answer[]) => void;
  /** Resolve a subset of slots (mirrors get_context_status's targeted read). */
  getContextStatus: (keys?: string[]) => {
    fillMap: V4ResolvedSlot[];
    needsInput: V4ResolvedSlot[];
    allFilled: boolean;
  };
  /** Clear the store (e.g. "start over"). */
  reset: () => void;
}

const V4Context = createContext<V4ContextValue | null>(null);

const STORAGE_PREFIX = 'idea.v4.context.';

function storageKeyFor(userId: string | null): string {
  return `${STORAGE_PREFIX}${userId ?? 'guest'}`;
}

function readStore(userId: string | null): StoreShape {
  try {
    const raw = localStorage.getItem(storageKeyFor(userId));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as StoreShape;
    return {};
  } catch {
    return {};
  }
}

function writeStore(userId: string | null, store: StoreShape): void {
  try {
    localStorage.setItem(storageKeyFor(userId), JSON.stringify(store));
  } catch {
    // Storage may be unavailable (private mode); the in-memory state still works.
  }
}

function resolveSlot(def: V4SlotDef, store: StoreShape): V4ResolvedSlot {
  const entry = store[def.key];
  return {
    key: def.key,
    name: def.name,
    askQuestion: def.askQuestion,
    status: entry?.status ?? 'missing',
    value: entry?.value ?? null,
    source: entry?.source ?? null,
  };
}

export function V4ContextProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [store, setStore] = useState<StoreShape>(() => readStore(userId));

  // Re-hydrate when the signed-in user changes (guest → authed, or switch).
  useEffect(() => {
    setStore(readStore(userId));
  }, [userId]);

  const provideContext = useCallback(
    (answers: V4Answer[]) => {
      setStore((prev) => {
        const next: StoreShape = { ...prev };
        for (const a of answers) {
          if (!V4_SLOTS.some((s) => s.key === a.key)) continue;
          const value = a.value.trim();
          if (!value && !a.confirm) continue;
          next[a.key] = {
            value: value || prev[a.key]?.value || '',
            // Owner-supplied or confirmed → stated; bare extraction stays inferred
            // until the user confirms it via the read-it-back step.
            status:
              a.confirm || a.source === 'manual' || a.source === undefined
                ? 'filled-stated'
                : 'filled-inferred',
            source: a.source ?? 'manual',
          };
        }
        writeStore(userId, next);
        return next;
      });
    },
    [userId],
  );

  const reset = useCallback(() => {
    setStore({});
    writeStore(userId, {});
  }, [userId]);

  const value = useMemo<V4ContextValue>(() => {
    const fillMap = V4_SLOTS.map((def) => resolveSlot(def, store));
    const needsInput = fillMap.filter((s) => !SATISFIED.has(s.status));
    const contextCard = fillMap.filter((s) => SATISFIED.has(s.status));

    const getContextStatus = (keys?: string[]) => {
      const scoped = keys
        ? fillMap.filter((s) => keys.includes(s.key))
        : fillMap;
      const ni = scoped.filter((s) => !SATISFIED.has(s.status));
      return { fillMap: scoped, needsInput: ni, allFilled: ni.length === 0 };
    };

    return {
      fillMap,
      needsInput,
      allFilled: needsInput.length === 0,
      contextCard,
      provideContext,
      getContextStatus,
      reset,
    };
  }, [store, provideContext, reset]);

  return <V4Context.Provider value={value}>{children}</V4Context.Provider>;
}

export function useV4Context(): V4ContextValue {
  const ctx = useContext(V4Context);
  if (!ctx) {
    throw new Error('useV4Context must be used within V4ContextProvider');
  }
  return ctx;
}
