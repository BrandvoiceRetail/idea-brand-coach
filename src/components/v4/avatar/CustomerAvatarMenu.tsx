/**
 * CustomerAvatarMenu — the shared "brain" of the global Customer Avatar control
 * (UX spec: _bmad-output/planning-artifacts/ux-design-avatar-control.md — Direction D,
 * extended to the multi-avatar SET model).
 *
 * ONE control, two thin triggers: CustomerAvatarChip (sidebar rail + mobile top bar)
 * and CustomerAvatarEcho (the in-stage spine echo) both render THIS menu via the
 * `trigger` prop, so there is a single source of behaviour and state.
 *
 * MULTI-SELECT: the funnel analysis considers a SET of customer avatars (the native
 * `AvatarContext` set model — `contextAvatarIds`). Each row is a membership checkbox
 * (toggling keeps the menu open so you can build the set); the ⋯ menu carries
 * "Work as only this" for a quick single-lens switch, plus rename / edit / duplicate /
 * set-primary / delete. Switching a SET re-casts the brand-scoped funnel's per-avatar
 * verdicts/metrics across the selected customers (pieces persist — the "lens" model).
 *
 * Owner ≠ customer: this is the CUSTOMER control — gold OUTLINE initials. The account
 * owner is `ProfileMenu` (SOLID gold) pinned at the opposite end of the shell.
 */
import {
  useMemo,
  useState,
  useEffect,
  type ReactNode,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Plus,
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Star,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useAvatarContext } from '@/contexts/AvatarContext';
import { useBrand } from '@/contexts/BrandContext';
import { V4_ROUTES } from '@/config/v4';
import type { Avatar } from '@/types/avatar';

/** Above this many customers the menu shows a filter box (spec: searchable when many). */
export const AVATAR_SEARCH_THRESHOLD = 7;

/** 1–2 uppercase initials from an avatar name (never invented; '?' when empty). */
export function avatarInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : parts[0].slice(0, 2);
  return letters.toUpperCase();
}

/** Summarise the active SET for a trigger label: focus name + "+N" when multiple. */
export function summarizeAvatarSet(
  avatars: Avatar[] | undefined,
  contextAvatarIds: string[],
): { label: string; focusName: string; count: number } {
  const list = avatars ?? [];
  const selected = contextAvatarIds
    .map((id) => list.find((a) => a.id === id))
    .filter((a): a is Avatar => Boolean(a));
  if (selected.length === 0) return { label: 'Select an avatar', focusName: '', count: 0 };
  const focusName = selected[0].name;
  if (selected.length === 1) return { label: focusName, focusName, count: 1 };
  return { label: `${focusName} +${selected.length - 1}`, focusName, count: selected.length };
}

export interface CustomerAvatarMenuProps {
  /** The trigger element (the chip or the echo). Rendered via `DropdownMenuTrigger asChild`. */
  trigger: ReactNode;
  /** Which side the menu opens from (rail opens up; top bar / echo open down). */
  side?: 'top' | 'bottom';
  /** Menu alignment relative to the trigger. */
  align?: 'start' | 'end';
}

const NEW_ROW = '__new__';

export function CustomerAvatarMenu({
  trigger,
  side = 'bottom',
  align = 'start',
}: CustomerAvatarMenuProps): JSX.Element {
  const navigate = useNavigate();
  const {
    avatars,
    contextAvatarIds,
    selectedAvatarId,
    setContextAvatars,
    toggleAvatarInContext,
    renameAvatar,
    duplicateAvatar,
    deleteAvatar,
    setPrimaryAvatar,
    isLoadingAvatars,
  } = useAvatarContext();
  const { createAvatar } = useBrand();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  /** id of the row being renamed inline (null = none); or NEW_ROW while creating. */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  /** The avatar pending a delete confirmation (null = no dialog open). */
  const [deleteTarget, setDeleteTarget] = useState<Avatar | null>(null);

  // Only real customer avatars belong in the switcher (templates are starting
  // points, not customers you "work as"). Falls back to all avatars if every one
  // happens to be a template, so the control never strands on an empty list.
  const customers = useMemo<Avatar[]>(() => {
    const list = avatars ?? [];
    const real = list.filter((a) => !a.is_template);
    return real.length > 0 ? real : list;
  }, [avatars]);

  const showSearch = customers.length > AVATAR_SEARCH_THRESHOLD;
  const filtered = useMemo<Avatar[]>(() => {
    const q = query.trim().toLowerCase();
    return q ? customers.filter((a) => a.name.toLowerCase().includes(q)) : customers;
  }, [customers, query]);

  const selectedCount = contextAvatarIds.length;

  // Reset all transient menu state whenever it closes.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setEditingId(null);
      setDraft('');
    }
  }, [open]);

  // A close request WHILE editing inline cancels the edit but keeps the menu open
  // (Escape/outside-click first cancels the rename/create, a second closes the menu).
  const handleOpenChange = (next: boolean): void => {
    if (!next && editingId) {
      setEditingId(null);
      setDraft('');
      return;
    }
    setOpen(next);
  };

  /** Toggle this avatar's membership in the funnel-analysis SET (menu stays open). */
  const handleToggleMembership = (a: Avatar): void => {
    void toggleAvatarInContext(a.id);
    // No per-toggle toast (noisy when building a set); the checkbox is the feedback.
    // setContextAvatars (under toggle) rolls back + toasts on RPC failure.
  };

  /** Collapse the SET to just this avatar — the quick single-lens switch. */
  const handleWorkAsOnly = (a: Avatar): void => {
    setOpen(false);
    if (selectedCount === 1 && selectedAvatarId === a.id) return;
    toast.success(`Now seeing the funnel as ${a.name}`);
    void setContextAvatars([a.id]);
  };

  const beginRename = (a: Avatar): void => {
    setEditingId(a.id);
    setDraft(a.name);
  };

  const commitRename = async (a: Avatar): Promise<void> => {
    const name = draft.trim();
    setEditingId(null);
    setDraft('');
    if (!name || name === a.name) return;
    try {
      await renameAvatar(a.id, name);
      toast.success(`Renamed to ${name}`);
    } catch {
      /* AvatarContext.renameAvatar surfaces its own error toast. */
    }
  };

  const beginCreate = (): void => {
    setEditingId(NEW_ROW);
    setDraft('');
  };

  const commitCreate = async (): Promise<void> => {
    const name = draft.trim();
    setEditingId(null);
    setDraft('');
    if (!name) return;
    setOpen(false);
    try {
      const created = await createAvatar({ name });
      // Make the new customer the active lens via the canonical switch path, then
      // open the Analyse portrait to build it (the funnel is honestly empty until then).
      await setContextAvatars([created.id]);
      toast.success(`Created ${name}`);
      navigate(V4_ROUTES.ANALYSE);
    } catch {
      /* BrandContext.createAvatar surfaces its own error toast. */
    }
  };

  const handleEditDetails = (a: Avatar): void => {
    setOpen(false);
    if (a.id !== selectedAvatarId) void setContextAvatars([a.id]);
    navigate(V4_ROUTES.ANALYSE);
  };

  /** Keep keystrokes inside an inline input from reaching the menu (typeahead/close). */
  const inlineKeyHandler =
    (onEnter: () => void, onEscape: () => void) =>
    (e: ReactKeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape();
      } else {
        // Stop the menu's built-in typeahead from stealing the keystroke.
        e.stopPropagation();
      }
    };

  const cancelEdit = (): void => {
    setEditingId(null);
    setDraft('');
  };

  return (
    <>
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent side={side} align={align} className="w-72" data-testid="customer-avatar-menu">
        <DropdownMenuLabel className="flex items-center justify-between gap-2 text-xs font-normal text-muted-foreground">
          <span>Avatars in funnel analysis</span>
          {selectedCount > 1 && (
            <span className="rounded-full bg-gold-warm/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold-warm">
              {selectedCount} selected
            </span>
          )}
        </DropdownMenuLabel>

        {showSearch && (
          <div className="px-2 pb-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="Search avatars…"
              aria-label="Search avatars"
              className="h-8"
            />
          </div>
        )}

        {isLoadingAvatars ? (
          <div className="space-y-1 px-2 py-1.5" aria-hidden>
            <div className="h-7 animate-pulse rounded bg-muted" />
            <div className="h-7 animate-pulse rounded bg-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <DropdownMenuItem disabled className="text-sm text-muted-foreground">
            {customers.length === 0 ? 'No avatars yet' : 'No avatars match'}
          </DropdownMenuItem>
        ) : (
          filtered.map((a) => {
            const inSet = contextAvatarIds.includes(a.id);
            const isFocus = a.id === selectedAvatarId;
            return (
              <div key={a.id} className="flex items-center gap-1 pr-1">
                {editingId === a.id ? (
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={inlineKeyHandler(() => void commitRename(a), cancelEdit)}
                    onBlur={() => void commitRename(a)}
                    aria-label={`Rename ${a.name}`}
                    className="mx-1 my-0.5 h-8"
                  />
                ) : (
                  <>
                    {/* Checkbox: add/remove this customer from the funnel-analysis SET
                        (multi-select) — keeps the menu open. */}
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={inSet}
                      aria-label={
                        inSet
                          ? `Remove ${a.name} from the funnel analysis`
                          : `Add ${a.name} to the funnel analysis`
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleMembership(a);
                      }}
                      className={cn(
                        'ml-1 grid h-5 w-5 shrink-0 place-items-center rounded border outline-none transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-gold-warm',
                        inSet
                          ? 'border-gold-warm bg-gold-warm text-foreground'
                          : 'border-muted-foreground/40 hover:border-gold-warm',
                      )}
                    >
                      {inSet && <Check className="h-3.5 w-3.5" />}
                    </button>

                    {/* Name: SWITCH to (only) this customer — the primary action; closes the menu. */}
                    <DropdownMenuItem
                      onSelect={() => handleWorkAsOnly(a)}
                      aria-current={isFocus ? 'true' : undefined}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2"
                    >
                      <span
                        aria-hidden
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-gold-warm text-[11px] font-semibold text-gold-warm"
                      >
                        {avatarInitials(a.name)}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {a.is_primary && (
                          <Star className="h-3 w-3 shrink-0 fill-gold-warm text-gold-warm" aria-label="primary" />
                        )}
                        <span className="truncate" title={a.name}>
                          {a.name}
                        </span>
                      </span>
                      {isFocus && <Check className="ml-auto h-4 w-4 shrink-0 text-gold-warm" aria-hidden />}
                    </DropdownMenuItem>

                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        aria-label={`Manage ${a.name}`}
                        className="cursor-pointer px-2 py-1.5 [&>svg:last-child]:hidden"
                      >
                        <MoreVertical className="h-4 w-4 text-muted-foreground" />
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            beginRename(a);
                          }}
                          className="cursor-pointer gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          <span>Rename</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleEditDetails(a)} className="cursor-pointer gap-2">
                          <SlidersHorizontal className="h-4 w-4" />
                          <span>Edit details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => void duplicateAvatar(a.id)} className="cursor-pointer gap-2">
                          <Copy className="h-4 w-4" />
                          <span>Duplicate</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={a.is_primary}
                          onSelect={() => void setPrimaryAvatar(a.id)}
                          className="cursor-pointer gap-2"
                        >
                          <Star className="h-4 w-4" />
                          <span>{a.is_primary ? 'Primary customer' : 'Set as primary'}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={customers.length <= 1}
                          onSelect={(e) => {
                            e.preventDefault();
                            setOpen(false);
                            setDeleteTarget(a);
                          }}
                          className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              </div>
            );
          })
        )}

        <DropdownMenuSeparator />

        {editingId === NEW_ROW ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={inlineKeyHandler(() => void commitCreate(), cancelEdit)}
            onBlur={() => {
              if (draft.trim()) void commitCreate();
              else cancelEdit();
            }}
            placeholder="New avatar name…"
            aria-label="New avatar name"
            className="mx-1 my-0.5 h-8"
          />
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              beginCreate();
            }}
            className="cursor-pointer gap-2 text-gold-warm focus:text-gold-warm"
          >
            <Plus className="h-4 w-4" />
            <span>New avatar</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    <AlertDialog
      open={deleteTarget !== null}
      onOpenChange={(o) => {
        if (!o) setDeleteTarget(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Deleting this avatar removes its portrait and all associated assessments. This cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deleteTarget) void deleteAvatar(deleteTarget.id);
              setDeleteTarget(null);
            }}
          >
            Delete avatar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
