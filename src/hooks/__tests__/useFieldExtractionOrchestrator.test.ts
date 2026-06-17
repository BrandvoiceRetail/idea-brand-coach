import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFieldExtractionOrchestrator } from '../useFieldExtractionOrchestrator';
import type { ChatMessage } from '@/types/chat';

// ── Helpers ────────────────────────────────────────────────────────────

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

function makeAssistantMsg(id: string, createdAt: string): ChatMessage {
  return {
    id,
    user_id: 'u1',
    session_id: 's1',
    role: 'assistant',
    content: 'hello',
    metadata: {
      extractedFields: [
        { identifier: 'demographics', value: 'TCG enthusiasts', confidence: 0.9, source: 'user_stated' },
      ],
    },
    created_at: createdAt,
    updated_at: createdAt,
  };
}

function baseProps(messages: ChatMessage[]) {
  return {
    messages,
    allChapters: [],
    fieldValues: {},
    fieldSources: {},
    setMessageExtraction: vi.fn(),
    enqueueFields: vi.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('useFieldExtractionOrchestrator — review drawer auto-open', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does NOT auto-enqueue extractions from history already present on load', () => {
    const props = baseProps([makeAssistantMsg('m-old', PAST)]);
    renderHook(() => useFieldExtractionOrchestrator(props));

    // History should not pop the review drawer open...
    expect(props.enqueueFields).not.toHaveBeenCalled();
    // ...but its badge metadata is still set so the user can reopen it.
    expect(props.setMessageExtraction).toHaveBeenCalledTimes(1);
  });

  it('auto-enqueues an assistant message that arrives after the session loads', () => {
    const props = baseProps([]);
    const { rerender } = renderHook(
      (p: ReturnType<typeof baseProps>) => useFieldExtractionOrchestrator(p),
      { initialProps: props }
    );

    // A genuinely new reply (created after view start) should enqueue for review.
    const next = { ...props, messages: [makeAssistantMsg('m-new', FUTURE)] };
    rerender(next);

    expect(next.enqueueFields).toHaveBeenCalledTimes(1);
    expect(next.enqueueFields).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ fieldId: 'demographics' })])
    );
  });
});
