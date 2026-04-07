/**
 * Tests for useBrandCoachChat — injected messages behavior
 *
 * Verifies that local-only assistant messages (e.g., rejection follow-ups)
 * are correctly merged into the display message list.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBrandCoachChat } from '../useBrandCoachChat';
import type { InjectedAssistantMessage } from '../useBrandCoachChat';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';

// Mock config dependencies
vi.mock('@/config/chapterFields', () => ({
  CHAPTER_FIELDS_MAP: {},
  BOOK_CHAPTER_NUMBER_TO_FIELDS_KEY: {},
}));

function makeChatMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: 'msg-1',
    user_id: 'user-1',
    role: 'assistant',
    content: 'Hello from Trevor',
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

function makeInjectedMessage(overrides: Partial<InjectedAssistantMessage> = {}): InjectedAssistantMessage {
  return {
    id: 'rejection-1',
    content: "Got it, I won't use that for **Brand Name**. What would you like instead?",
    created_at: '2026-01-01T10:05:00Z',
    ...overrides,
  };
}

function defaultConfig(overrides: Record<string, unknown> = {}) {
  return {
    messages: [] as ChatMessage[],
    currentChapter: null,
    fieldValues: {},
    focusedFieldId: null,
    userDocuments: [],
    isSystemKBEnabled: false,
    latestDiagnostic: null,
    sendMessageStreaming: vi.fn() as (msg: ChatMessageCreate) => Promise<void>,
    injectedMessages: [] as InjectedAssistantMessage[],
    ...overrides,
  };
}

describe('useBrandCoachChat — injected messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty displayMessages when no messages or injected messages', () => {
    const { result } = renderHook(() => useBrandCoachChat(defaultConfig()));
    expect(result.current.displayMessages).toEqual([]);
  });

  it('should include injected messages in displayMessages', () => {
    const injected = makeInjectedMessage();
    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          injectedMessages: [injected],
        }),
      ),
    );

    expect(result.current.displayMessages).toHaveLength(1);
    expect(result.current.displayMessages[0].id).toBe('rejection-1');
    expect(result.current.displayMessages[0].role).toBe('assistant');
    expect(result.current.displayMessages[0].content).toContain('Brand Name');
  });

  it('should merge injected messages with persisted messages in chronological order', () => {
    const persistedMsg = makeChatMessage({
      id: 'msg-1',
      role: 'user',
      content: 'Tell me about branding',
      created_at: '2026-01-01T10:00:00Z',
    });

    const assistantMsg = makeChatMessage({
      id: 'msg-2',
      role: 'assistant',
      content: 'Here is what I found about your brand...',
      created_at: '2026-01-01T10:01:00Z',
    });

    const injected = makeInjectedMessage({
      id: 'rejection-1',
      created_at: '2026-01-01T10:05:00Z',
    });

    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          messages: [persistedMsg, assistantMsg],
          injectedMessages: [injected],
        }),
      ),
    );

    expect(result.current.displayMessages).toHaveLength(3);
    // Chronological: user msg, assistant msg, then injected rejection
    expect(result.current.displayMessages[0].id).toBe('msg-1');
    expect(result.current.displayMessages[1].id).toBe('msg-2');
    expect(result.current.displayMessages[2].id).toBe('rejection-1');
  });

  it('should place injected messages between persisted messages based on timestamp', () => {
    const earlyMsg = makeChatMessage({
      id: 'msg-early',
      created_at: '2026-01-01T10:00:00Z',
    });

    const injected = makeInjectedMessage({
      id: 'rejection-mid',
      created_at: '2026-01-01T10:02:00Z',
    });

    const lateMsg = makeChatMessage({
      id: 'msg-late',
      role: 'user',
      content: 'Follow up',
      created_at: '2026-01-01T10:05:00Z',
    });

    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          messages: [earlyMsg, lateMsg],
          injectedMessages: [injected],
        }),
      ),
    );

    expect(result.current.displayMessages).toHaveLength(3);
    expect(result.current.displayMessages[0].id).toBe('msg-early');
    expect(result.current.displayMessages[1].id).toBe('rejection-mid');
    expect(result.current.displayMessages[2].id).toBe('msg-late');
  });

  it('should also include injected messages in messagesWithPending', () => {
    const injected = makeInjectedMessage();
    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          injectedMessages: [injected],
        }),
      ),
    );

    expect(result.current.messagesWithPending).toHaveLength(1);
    expect(result.current.messagesWithPending[0].id).toBe('rejection-1');
  });

  it('should filter system messages but keep injected messages', () => {
    const systemMsg = makeChatMessage({
      id: 'system-msg',
      role: 'assistant',
      content: 'System instruction',
      metadata: { isSystemMessage: true },
    });

    const injected = makeInjectedMessage();

    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          messages: [systemMsg],
          injectedMessages: [injected],
        }),
      ),
    );

    // System message filtered, injected included
    expect(result.current.displayMessages).toHaveLength(1);
    expect(result.current.displayMessages[0].id).toBe('rejection-1');
  });

  it('should handle multiple injected messages', () => {
    const injection1 = makeInjectedMessage({
      id: 'rejection-1',
      content: "Got it, I won't use that for **Brand Name**.",
      created_at: '2026-01-01T10:02:00Z',
    });

    const injection2 = makeInjectedMessage({
      id: 'rejection-2',
      content: "Got it, I won't use that for **Mission**.",
      created_at: '2026-01-01T10:08:00Z',
    });

    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          injectedMessages: [injection1, injection2],
        }),
      ),
    );

    expect(result.current.displayMessages).toHaveLength(2);
    expect(result.current.displayMessages[0].id).toBe('rejection-1');
    expect(result.current.displayMessages[1].id).toBe('rejection-2');
  });

  it('should mark injected messages with isInjected metadata', () => {
    const injected = makeInjectedMessage();
    const { result } = renderHook(() =>
      useBrandCoachChat(
        defaultConfig({
          injectedMessages: [injected],
        }),
      ),
    );

    expect(result.current.displayMessages[0].metadata).toEqual({ isInjected: true });
  });
});
