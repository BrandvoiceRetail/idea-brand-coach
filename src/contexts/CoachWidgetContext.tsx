/**
 * CoachWidgetContext — lets any /v4 surface open the floating, transparent Brand
 * Coach (TrevorCoachWidget) and seed its composer with context, instead of
 * navigating away to the legacy /v2/coach page.
 *
 * The widget still owns its own open/dock/chat state; this context only carries an
 * imperative "open now, optionally with this message" request. Keying on a
 * monotonic nonce means repeated asks re-open + re-seed even when the message is
 * unchanged.
 *
 * Provider: V4Layout (wraps both the routed page and the widget so they share it).
 * Consumers: TrevorCoachWidget (reacts to requests) + any /v4 page handing the
 * coach a working-session seed (e.g. V4Fix "Open the coach to refine").
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { JSX, ReactNode } from 'react';

export interface CoachOpenRequest {
  /** Prefilled into the composer (editable) so the coach starts with context. */
  message?: string;
  /** Monotonic id so repeated opens re-fire even with an identical message. */
  nonce: number;
}

interface CoachWidgetValue {
  /** The latest open request the widget should honour (null = nothing pending). */
  request: CoachOpenRequest | null;
  /** Open the floating coach, optionally seeding the composer with `message`. */
  openCoach: (opts?: { message?: string }) => void;
}

const noop = (): void => {};
const DEFAULT: CoachWidgetValue = { request: null, openCoach: noop };

const CoachWidgetContext = createContext<CoachWidgetValue>(DEFAULT);

export function CoachWidgetProvider({ children }: { children: ReactNode }): JSX.Element {
  const [request, setRequest] = useState<CoachOpenRequest | null>(null);
  const nonce = useRef(0);

  const openCoach = useCallback((opts?: { message?: string }): void => {
    nonce.current += 1;
    setRequest({ message: opts?.message, nonce: nonce.current });
  }, []);

  const value = useMemo<CoachWidgetValue>(() => ({ request, openCoach }), [request, openCoach]);
  return <CoachWidgetContext.Provider value={value}>{children}</CoachWidgetContext.Provider>;
}

/**
 * Read the coach-widget controls. Returns a safe no-op default when used outside a
 * provider, so the widget (and its tests) can still render standalone.
 */
export function useCoachWidget(): CoachWidgetValue {
  return useContext(CoachWidgetContext);
}
