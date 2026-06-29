/**
 * TrevorCoachWidget — a floating, almost-fully-transparent Brand Coach chat that
 * spawns over the /v4 surface so you can still see the page behind it.
 *
 * Engine: REUSES the in-app coach (useChatSessions + useChat → the
 * `idea-framework-consultant-claude` edge function), so the coach's voice and
 * behaviour come from the same place as /v2/coach — Trevor's "working session, not
 * a chatbot" persona (finding / action / question every turn) is inherited, not
 * reimplemented here. This component is only the surface.
 *
 * Look (per the reference): right-docked, full-height panel, ~460px on desktop /
 * full-width on mobile, a ~10% tint with NO backdrop-blur so the content behind
 * stays sharp (transparent, not frosted). Message bubbles carry a light translucent
 * backing for legibility; the open areas stay see-through. On-brand v4 tokens
 * (foreground / gold-warm). Launched by a gold FAB; closes back to the FAB.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';

const CHATBOT = 'idea-framework-consultant' as const;

export function TrevorCoachWidget(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { selectedAvatarId } = useAvatarContext();
  const avatarId = selectedAvatarId ?? undefined;

  // Session is auto-created by useChatSessions (autoCreate defaults true); useChat
  // loads + persists messages against it and runs the consultant edge function.
  const { currentSessionId } = useChatSessions({ chatbotType: CHATBOT, avatarId });
  const { messages, sendMessage, isSending } = useChat({
    chatbotType: CHATBOT,
    sessionId: currentSessionId,
    avatarId,
  });

  const visibleMessages = ((messages ?? []) as ChatMessage[]).filter((m) => m.role !== 'system');

  // Auto-scroll to the latest turn whenever the thread or pending state changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, pendingUser, isSending, open]);

  const handleSend = useCallback(async (): Promise<void> => {
    const content = input.trim();
    if (!content || isSending) return;
    setInput('');
    setPendingUser(content);
    try {
      await sendMessage({ content, role: 'user' } as ChatMessageCreate);
    } finally {
      setPendingUser(null);
    }
  }, [input, isSending, sendMessage]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Brand Coach"
        data-testid="coach-widget-launcher"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold-warm text-foreground shadow-[var(--shadow-brand)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-warm focus-visible:ring-offset-2 md:bottom-6 md:right-6"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section
      role="dialog"
      aria-label="Brand Coach"
      data-testid="coach-widget-panel"
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-foreground/15 shadow-2xl',
        // ~10% tint, NO blur → the page behind stays sharp (transparent, not frosted)
        'bg-foreground/10',
        // right-docked, full height; full-width on mobile, ~460px on desktop
        'inset-x-2 top-16 bottom-20 sm:inset-x-auto sm:right-3 sm:w-[460px] md:top-4 md:bottom-4 md:right-4',
      )}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-foreground/10 bg-background/70 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold-warm text-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-none text-foreground">Brand Coach</p>
            <p className="truncate text-[11px] leading-tight text-foreground/55">Your conversion fixer</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Brand Coach"
          data-testid="coach-widget-close"
          className="flex h-7 w-7 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Messages — open areas stay see-through; bubbles carry a light backing */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex flex-col gap-3 px-4 py-4">
          {visibleMessages.length === 0 && !pendingUser && (
            <div
              data-testid="coach-widget-empty"
              className="mt-6 rounded-xl bg-background/70 p-4 text-sm leading-relaxed text-foreground shadow-sm"
            >
              <p className="font-semibold">Let's fix what's costing you conversions.</p>
              <p className="mt-1 text-foreground/80">
                Tell me the number that's worrying you — or paste a listing — and I'll find the one
                thing to fix first.
              </p>
            </div>
          )}

          {visibleMessages.map((m) => (
            <Bubble key={m.id} role={m.role} content={m.content} />
          ))}

          {pendingUser && <Bubble role="user" content={pendingUser} />}

          {isSending && (
            <div
              className="flex items-center gap-2 self-start rounded-2xl bg-background/70 px-3 py-2 text-xs text-foreground/70 shadow-sm"
              data-testid="coach-widget-thinking"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Coach is thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-foreground/10 bg-background/70 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask your Brand Coach…"
            aria-label="Message the Brand Coach"
            data-testid="coach-widget-input"
            className="max-h-32 min-h-[40px] flex-1 resize-none border-foreground/15 bg-background/80 text-foreground placeholder:text-foreground/45 focus-visible:ring-gold-warm"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => void handleSend()}
            disabled={!input.trim() || isSending}
            aria-label="Send message"
            data-testid="coach-widget-send"
            className="h-10 w-10 shrink-0 bg-gold-warm text-foreground hover:bg-gold-warm/90"
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </section>
  );
}

/** One chat turn — user (gold) right-aligned, coach (light) left-aligned. */
function Bubble({ role, content }: { role: ChatMessage['role']; content: string }): JSX.Element {
  const isUser = role === 'user';
  return (
    <div
      className={cn(
        'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm',
        isUser
          ? 'self-end bg-gold-warm/90 text-foreground'
          : 'self-start bg-background/80 text-foreground',
      )}
    >
      {content}
    </div>
  );
}
