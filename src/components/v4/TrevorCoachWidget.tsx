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
 * full-width on mobile, a smoked dark tint with NO backdrop-blur so the content
 * behind stays sharp (transparent, not frosted), edged with a barely-there gold
 * hairline. Message bubbles carry a translucent backing for legibility; the open
 * areas stay see-through. On-brand v4 tokens (background / gold-warm). Launched by
 * a gold FAB; closes back to the FAB.
 */
import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Sparkles, X, Send, Loader2, Menu, Paperclip, Wrench, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useChat } from '@/hooks/useChat';
import { useChatSessions } from '@/hooks/useChatSessions';
import { useDocumentUpload } from '@/hooks/useDocumentUpload';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { cn } from '@/lib/utils';
import { TOOL_REGISTRY } from '@/data/toolRegistry.generated';
import type { ChatMessage, ChatMessageCreate } from '@/types/chat';

const CHATBOT = 'idea-framework-consultant' as const;

/** Tool catalogue for the menu — Available tools only, grouped by category,
 * roadmap/"Coming next" filtered out. Reuses the generated registry (SSOT). */
const TOOL_GROUPS = TOOL_REGISTRY.map((g) => ({
  group: g.group,
  tools: g.tools.filter((t) => t.status === 'Available'),
})).filter((g) => g.group !== 'Coming next' && g.tools.length > 0);

/** snake_case tool id → a first-person request the coach's tool loop can act on. */
const toolRequest = (name: string): string => {
  const phrase = name.replace(/_/g, ' ');
  return phrase.charAt(0).toUpperCase() + phrase.slice(1);
};

/** Which edge the panel is docked against — remembered across sessions. */
type DockSide = 'left' | 'right';
const SIDE_KEY = 'coach-widget-side';
const readSide = (): DockSide => {
  try {
    return localStorage.getItem(SIDE_KEY) === 'left' ? 'left' : 'right';
  } catch {
    return 'right';
  }
};
const writeSide = (side: DockSide): void => {
  try {
    localStorage.setItem(SIDE_KEY, side);
  } catch {
    /* storage unavailable — dock just won't persist */
  }
};
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** Gap (px) the panel keeps from the viewport edge when docked (≈ md:right-4). */
const DOCK_MARGIN = 16;
/** The on-screen left coordinate for a given dock side — always inside the
 * viewport, so the panel can never be parked out of view. */
const leftForSide = (side: DockSide, width: number, vw: number): number =>
  side === 'left' ? DOCK_MARGIN : Math.max(DOCK_MARGIN, vw - width - DOCK_MARGIN);

export function TrevorCoachWidget(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // — Side docking — drag the header to slot the panel against the left or right
  // edge; on release it snaps to whichever side its centre is nearest. We drive a
  // concrete, clamped `left` (px) rather than an unbounded translate, so neither a
  // drag nor the snapped rest position can ever leave the viewport. `pos` is null
  // until measured / on full-width mobile, where CSS owns the layout and there's
  // nowhere to drag.
  const panelRef = useRef<HTMLElement>(null);
  const [side, setSide] = useState<DockSide>(readSide);
  const [pos, setPos] = useState<{ left: number; width: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; left0: number } | null>(null);

  const { selectedAvatarId, contextAvatarIds } = useAvatarContext();
  const avatarId = selectedAvatarId ?? undefined;

  // Session is auto-created by useChatSessions (autoCreate defaults true); useChat
  // loads + persists messages against it and runs the consultant edge function.
  const { currentSessionId } = useChatSessions({ chatbotType: CHATBOT, avatarId, avatarIds: contextAvatarIds });
  const { messages, sendMessage, isSending } = useChat({
    chatbotType: CHATBOT,
    sessionId: currentSessionId,
    avatarId,
    avatarIds: contextAvatarIds,
  });

  // Reuse the in-app document pipeline for "Add files" (upload + status polling).
  const { documents, isUploading, fileInputRef, handleFileSelect } = useDocumentUpload();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const visibleMessages = ((messages ?? []) as ChatMessage[]).filter((m) => m.role !== 'system');

  // Auto-scroll to the latest turn whenever the thread or pending state changes.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visibleMessages.length, pendingUser, isSending, open]);

  // Once the panel is on screen, measure its width and park it at the remembered
  // side. Pre-paint (layout effect) so a left-docked panel doesn't flash right
  // first. Re-runs on open and on viewport resize. When the panel is ~full-width
  // (mobile) there's nowhere to dock, so we leave `pos` null and let CSS lay it out.
  useLayoutEffect(() => {
    if (!open) return;
    const recompute = (): void => {
      const el = panelRef.current;
      if (!el) return;
      const vw = window.innerWidth;
      const width = el.getBoundingClientRect().width;
      if (!width || width >= vw - 2 * DOCK_MARGIN) {
        setPos(null); // full-width / no room to move — CSS owns it
        return;
      }
      setPos({ left: leftForSide(side, width, vw), width });
    };
    recompute();
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
    // `side` is the only input that should re-run this; width comes from the DOM.
  }, [open, side]);

  const onHandlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>): void => {
      // Leave header controls (e.g. the close button) clickable.
      if ((e.target as HTMLElement).closest('button')) return;
      if (!pos) return; // nothing to dock against (full-width mobile)
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, left0: pos.left };
      setDragging(true);
    },
    [pos],
  );

  const onHandlePointerMove = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    const start = dragRef.current;
    if (!start) return;
    const clientX = e.clientX;
    setPos((p) => {
      if (!p) return p;
      const maxLeft = Math.max(DOCK_MARGIN, window.innerWidth - p.width - DOCK_MARGIN);
      return { ...p, left: clamp(start.left0 + (clientX - start.startX), DOCK_MARGIN, maxLeft) };
    });
  }, []);

  const onHandlePointerEnd = useCallback((e: React.PointerEvent<HTMLElement>): void => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setPos((p) => {
      if (!p) return p;
      const vw = window.innerWidth;
      const next: DockSide = p.left + p.width / 2 < vw / 2 ? 'left' : 'right';
      setSide(next);
      writeSide(next);
      return { ...p, left: leftForSide(next, p.width, vw) };
    });
  }, []);

  const handleSend = useCallback(async (): Promise<void> => {
    const content = input.trim();
    if (!content || isSending) return;
    setInput('');
    setPendingUser(content);
    try {
      await sendMessage({
        content,
        role: 'user',
        // Attach any uploaded docs so the consultant pulls them in for context.
        metadata: documents.length > 0 ? { hasUploadedDocuments: true, userDocuments: documents } : undefined,
      } as ChatMessageCreate);
    } finally {
      setPendingUser(null);
    }
  }, [input, isSending, sendMessage, documents]);

  // Picking a tool seeds a first-person request; the coach's tool loop runs it.
  const seedTool = useCallback((toolName: string): void => {
    setInput((prev) => (prev.trim() ? prev : toolRequest(toolName)));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

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
      ref={panelRef}
      role="dialog"
      aria-label="Brand Coach"
      data-testid="coach-widget-panel"
      // When measured (desktop/tablet) we own the horizontal position via a
      // clamped `left`; otherwise CSS lays it out full-width (mobile).
      style={pos ? { left: `${pos.left}px`, right: 'auto', width: `${pos.width}px` } : undefined}
      className={cn(
        'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-gold-warm/25 shadow-2xl',
        // smoked dark tint, NO blur → the page behind stays sharp (transparent, not frosted)
        'bg-background/30',
        // full height; full-width on mobile, ~460px on desktop. The horizontal
        // dock is driven by the inline `left` above (overriding the right anchor).
        'inset-x-2 top-16 bottom-20 sm:inset-x-auto sm:right-3 sm:w-[460px] md:top-4 md:bottom-4 md:right-4',
        // glide to the snapped side on release; track the pointer 1:1 while dragging
        !dragging && 'transition-[left] duration-300 ease-out',
      )}
    >
      {/* Header — doubles as the drag handle to dock the panel left or right */}
      <header
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerEnd}
        onPointerCancel={onHandlePointerEnd}
        title={pos ? 'Drag to dock left or right' : undefined}
        className={cn(
          'flex select-none touch-none items-center justify-between gap-2 border-b border-foreground/10 bg-background/70 px-4 py-3',
          pos && (dragging ? 'cursor-grabbing' : 'cursor-grab'),
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {pos && (
            <GripVertical className="h-4 w-4 shrink-0 text-foreground/30" aria-hidden="true" />
          )}
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
        {/* Attached-files indicator */}
        {(documents.length > 0 || isUploading) && (
          <div
            className="mb-2 flex items-center gap-1.5 text-xs text-foreground/70"
            data-testid="coach-widget-files-indicator"
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Paperclip className="h-3.5 w-3.5" />
            )}
            <span>
              {isUploading
                ? 'Uploading…'
                : `${documents.length} file${documents.length === 1 ? '' : 's'} will be included for context`}
            </span>
          </div>
        )}

        {/* Hidden picker driven by the hamburger's "Add files" */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          data-testid="coach-widget-file-input"
        />

        <div className="flex items-end gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask your Brand Coach…"
            aria-label="Message the Brand Coach"
            data-testid="coach-widget-input"
            className="max-h-32 min-h-[40px] flex-1 resize-none border-foreground/15 bg-background/80 text-foreground placeholder:text-foreground/45 focus-visible:ring-gold-warm"
          />

          {/* Hamburger: Add files + categorized Brand Coach tools */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Files and tools"
                data-testid="coach-widget-menu"
                className="h-10 w-10 shrink-0 border-foreground/15 bg-background/80 text-foreground hover:bg-foreground/10"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              collisionPadding={12}
              className="w-72 max-h-[70vh] overflow-y-auto"
            >
              <DropdownMenuItem
                onSelect={(e) => {
                  // Keep the gesture; let the menu close first, then open the OS
                  // file picker (clicking the hidden input inside onSelect is dropped).
                  e.preventDefault();
                  setTimeout(() => fileInputRef.current?.click(), 0);
                }}
                data-testid="coach-widget-addfiles"
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Add files
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Wrench className="h-3.5 w-3.5" />
                Brand Coach tools
              </DropdownMenuLabel>
              {/* Two layers: category → its tools. The flyout flips into view
                  (avoidCollisions, panel hugs the screen edge) and caps to the
                  available height + scrolls, so every tool stays on-screen. */}
              {TOOL_GROUPS.map((g) => (
                <DropdownMenuSub key={g.group}>
                  <DropdownMenuSubTrigger data-testid={`coach-tool-group-${g.group}`}>
                    {g.group}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    collisionPadding={12}
                    className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-64 overflow-y-auto"
                  >
                    {g.tools.map((t) => (
                      <DropdownMenuItem
                        key={t.name}
                        onSelect={() => seedTool(t.name)}
                        title={t.description}
                      >
                        {toolRequest(t.name)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

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
