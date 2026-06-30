/**
 * DecisionBoard (S-10) — the Loop-2 "pick your positioning move" surface.
 *
 * WHAT: Renders the 2-3 candidate positioning Moves the move engine produced,
 * each as a transparent card showing its per-criterion scores, the rationale,
 * and the composite. The user picks ONE to expand into a brief (onChooseMove),
 * or flips to a Compare view that lines the moves up side-by-side on every
 * criterion so the trade-off is legible.
 *
 * WHY: This is the Diagnose->Analyse->Fix spine's decision point — turning a Trust
 * Gap + Decision Trigger into a distinctive angle to TEST. The scoring is shown
 * (not hidden) so the choice is the user's, made with the coach's reasoning in
 * full view.
 *
 * NO FABRICATION (the production bar): this surface NEVER invents a move or a
 * score. When the engine is loading we show skeletons; when it errored we show an
 * honest "couldn't generate moves" with a retry; when it returned nothing we show
 * an honest "not enough evidence yet" empty state. A card only ever renders the
 * real numbers passed in via `moves`.
 *
 * Presentational only — the parent (V4Analyse) owns the move engine call,
 * retry wiring, and what happens after a move is chosen.
 */
import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Columns3,
  LayoutGrid,
  Lightbulb,
  RefreshCw,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { captureAlphaEvent } from '@/lib/posthogClient';
import type { MoveCriterionScore, PositioningMove } from '@/types/v4Analyse';

export interface DecisionBoardProps {
  /** Candidate moves from the move engine; empty array = honest no-data state. */
  moves: PositioningMove[];
  /** Called with the full move when the user picks one to expand into a brief. */
  onChooseMove: (move: PositioningMove) => void;
  /** True while the move engine is in flight (drives skeletons). */
  isLoading?: boolean;
  /** Hard error from the move engine; shows the honest retry state when set. */
  error?: string | null;
  /** Retry handler for the error state (omit to hide the retry button). */
  onRetry?: () => void;
  /** The move already selected (highlights its card). */
  selectedMoveId?: string | null;
  /**
   * Display name of the customer the current moves were generated FOR. Moves are an
   * expensive generate over the ONE confirmed (focus) customer — never fanned out to
   * N — so the board labels them with this customer; the user switches focus (the
   * customer menu) to generate moves for another. null until moves are generated.
   */
  movesAvatarName?: string | null;
  /** Display name of the CURRENT focus customer (for the staleness note). */
  focusAvatarName?: string | null;
  /**
   * How many customers are in the active analysis SET. The set-context label only
   * shows when > 1; at <= 1 the single-avatar render is byte-identical.
   */
  avatarCount?: number;
  /**
   * True when the shown moves were generated for a customer other than the current
   * focus (focus switched after generating) — surfaces an honest "regenerate" note
   * instead of silently mislabelling the moves.
   */
  movesStale?: boolean;
}

/**
 * Fire a v4 Decision Board funnel event. Reuses the canonical FE analytics client
 * (safe no-op when PostHog is unconfigured); the cast threads a v4-namespaced
 * name through the shared union without editing the shared client.
 */
function emit(
  name: 'v4_decision_board_moves_shown' | 'v4_decision_board_move_selected',
  props?: Record<string, string | number | boolean | null>,
): void {
  captureAlphaEvent(name, props);
}

/** Format an engine score for display without assuming a fixed scale. */
function fmtScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/** The move with the highest composite (first wins ties); null when empty. */
function topMoveOf(moves: PositioningMove[]): PositioningMove | null {
  if (moves.length === 0) return null;
  return moves.reduce((best, m) => (m.composite > best.composite ? m : best), moves[0]);
}

/**
 * Build the "Why #1?" explanation for the top move STRICTLY from the real scores
 * passed in — its composite, its two strongest criteria, and its lead over the
 * runner-up. Never fabricates a rationale; if there's only one move there's no
 * ranking to explain and we return ''.
 */
function buildWhyExplanation(moves: PositioningMove[], top: PositioningMove): string {
  if (moves.length < 2) return '';
  const strengths = [...top.criteriaScores]
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((c) => `${c.criterion} (${fmtScore(c.score)})`)
    .join(' and ');
  const runnerUp = moves
    .filter((m) => m.id !== top.id)
    .reduce<PositioningMove | null>(
      (best, m) => (best === null || m.composite > best.composite ? m : best),
      null,
    );

  let text = `It ranks #1 with a composite of ${fmtScore(top.composite)}`;
  if (strengths) text += `, leading on ${strengths}`;
  text += '.';
  if (runnerUp) {
    const delta = fmtScore(top.composite - runnerUp.composite);
    text += ` That's ${delta} ahead of "${runnerUp.headline}" (${fmtScore(runnerUp.composite)}).`;
  }
  return text;
}

export function DecisionBoard({
  moves,
  onChooseMove,
  isLoading = false,
  error = null,
  onRetry,
  selectedMoveId = null,
  movesAvatarName = null,
  focusAvatarName = null,
  avatarCount = 1,
  movesStale = false,
}: DecisionBoardProps): JSX.Element {
  const [compare, setCompare] = useState(false);
  const shownRef = useRef(false);

  const hasMoves = moves.length > 0;
  const topMove = topMoveOf(moves);
  const whyText = topMove ? buildWhyExplanation(moves, topMove) : '';
  // 1-up on mobile, 2-up from md; spread to 3-up on large screens when there are
  // 3 moves so the desktop uses its width instead of letterboxing the cards.
  const gridColsClass = moves.length >= 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2';

  // Emit moves_shown once per populated render (not on loading/empty/error).
  useEffect(() => {
    if (isLoading || error || !hasMoves || shownRef.current) return;
    shownRef.current = true;
    emit('v4_decision_board_moves_shown', { count: moves.length });
  }, [isLoading, error, hasMoves, moves.length]);

  function handleChoose(move: PositioningMove): void {
    emit('v4_decision_board_move_selected', {
      move_id: move.id,
      composite: move.composite,
    });
    onChooseMove(move);
  }

  return (
    <Card data-testid="v4-decision-board">
      <CardHeader className="space-y-1">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-lg">Choose your move</CardTitle>
          {hasMoves && !isLoading && !error && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 gap-2 self-start sm:self-auto"
              onClick={() => setCompare((c) => !c)}
              data-testid="decision-board-compare-toggle"
            >
              {compare ? (
                <>
                  <LayoutGrid className="h-4 w-4" /> Cards
                </>
              ) : (
                <>
                  <Columns3 className="h-4 w-4" /> Compare all
                </>
              )}
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Each move is a distinctive angle to test. The scores are shown in full — the call is
          yours.
        </p>

        {/* Set-context label — moves are generated for ONE focus customer (never
            fanned out to N), so when the set has >1 customer the board names whose
            moves these are and flags when the focus has since switched (stale). */}
        {avatarCount > 1 && (hasMoves || movesAvatarName) && (
          <p className="text-xs" data-testid="v4-decision-board-set-context">
            {movesStale ? (
              <span className="font-medium text-gold-warm">
                These moves are for {movesAvatarName ?? 'another customer'} — not your current
                focus{focusAvatarName ? `, ${focusAvatarName}` : ''}. Regenerate to score moves
                for {focusAvatarName ?? 'this customer'}.
              </span>
            ) : (
              <span className="text-muted-foreground">
                Moves for{' '}
                <span className="font-semibold text-foreground">
                  {movesAvatarName ?? focusAvatarName}
                </span>{' '}
                · switch the customer menu to generate moves for another.
              </span>
            )}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && <LoadingState />}

        {!isLoading && error && <ErrorState message={error} onRetry={onRetry} />}

        {!isLoading && !error && !hasMoves && <EmptyState />}

        {!isLoading && !error && hasMoves && !compare && (
          <div className={`grid grid-cols-1 gap-4 ${gridColsClass}`} data-testid="decision-board-cards">
            {moves.map((move) => {
              const isTop = move.id === topMove?.id && moves.length > 1;
              return (
                <MoveCard
                  key={move.id}
                  move={move}
                  selected={move.id === selectedMoveId}
                  isTop={isTop}
                  whyText={isTop ? whyText : ''}
                  onChoose={handleChoose}
                />
              );
            })}
          </div>
        )}

        {!isLoading && !error && hasMoves && compare && (
          <CompareView moves={moves} selectedMoveId={selectedMoveId} onChoose={handleChoose} />
        )}
      </CardContent>
    </Card>
  );
}

// -- States --------------------------------------------------------------------

function LoadingState(): JSX.Element {
  return (
    <div
      className="grid grid-cols-1 gap-4 md:grid-cols-2"
      data-testid="decision-board-loading"
      aria-busy="true"
    >
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3 rounded-lg border border-border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}): JSX.Element {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4"
      data-testid="decision-board-error"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertCircle className="h-4 w-4" />
        Couldn&apos;t generate moves
      </div>
      <p className="text-sm text-muted-foreground">
        The coach couldn&apos;t put together your positioning moves just now — nothing was made up.
        {message ? ` (${message})` : ''}
      </p>
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-10 gap-2"
          onClick={onRetry}
          data-testid="decision-board-retry"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      )}
    </div>
  );
}

function EmptyState(): JSX.Element {
  return (
    <div
      className="flex flex-col items-start gap-2 rounded-lg border border-border bg-muted/30 p-4"
      data-testid="decision-board-empty"
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Lightbulb className="h-4 w-4 text-gold-warm" />
        Not enough evidence yet
      </div>
      <p className="text-sm text-muted-foreground">
        Once your Trust Gap and Decision Trigger are in, the coach will draft a few positioning moves
        for you to choose from here.
      </p>
    </div>
  );
}

// -- Card view -----------------------------------------------------------------

function MoveCard({
  move,
  selected,
  isTop = false,
  whyText = '',
  onChoose,
}: {
  move: PositioningMove;
  selected: boolean;
  /** True for the highest-composite move; surfaces the best-fit + Why #1 affordances. */
  isTop?: boolean;
  /** Derived composite explanation shown when the user opens "Why #1?". */
  whyText?: string;
  onChoose: (move: PositioningMove) => void;
}): JSX.Element {
  const [showWhy, setShowWhy] = useState(false);

  return (
    <div
      className={`flex h-full flex-col gap-3 rounded-lg border p-4 transition-shadow ${
        selected ? 'border-gold-warm bg-gold-light/20 shadow-brand' : 'border-border bg-background'
      }`}
      data-testid={`decision-board-move-${move.id}`}
      data-selected={selected}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1.5">
          {isTop && (
            <Badge
              variant="secondary"
              className="gap-1 border-gold-warm/40 bg-gold-light/30 text-foreground"
              data-testid={`move-bestfit-${move.id}`}
            >
              <Star className="h-3 w-3 text-gold-warm" /> Best fit
            </Badge>
          )}
          <h3 className="text-sm font-semibold leading-snug text-foreground">{move.headline}</h3>
        </div>
        <Badge variant="secondary" className="shrink-0" data-testid={`move-composite-${move.id}`}>
          {fmtScore(move.composite)}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground">{move.rationale}</p>

      <Separator />

      <ul className="space-y-2" data-testid={`move-criteria-${move.id}`}>
        {move.criteriaScores.map((c) => (
          <CriterionRow key={c.criterion} criterion={c} />
        ))}
      </ul>

      {isTop && whyText && (
        <div className="space-y-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setShowWhy((w) => !w)}
            aria-expanded={showWhy}
            data-testid={`move-why-toggle-${move.id}`}
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${showWhy ? 'rotate-180' : ''}`}
            />
            Why #1?
          </Button>
          {showWhy && (
            <p
              className="rounded-md border border-border bg-muted/30 p-2 text-xs leading-snug text-muted-foreground"
              data-testid={`move-why-${move.id}`}
            >
              {whyText}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto pt-1">
        <Button
          type="button"
          variant={selected ? 'brand' : 'outline'}
          size="sm"
          className="min-h-10 w-full gap-2"
          onClick={() => onChoose(move)}
          aria-pressed={selected}
          data-testid={`move-choose-${move.id}`}
        >
          {selected ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Chosen
            </>
          ) : (
            <>
              Choose this move <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function CriterionRow({ criterion }: { criterion: MoveCriterionScore }): JSX.Element {
  return (
    <li className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{criterion.criterion}</span>
        <span className="tabular-nums text-muted-foreground">{fmtScore(criterion.score)}</span>
      </div>
      <p className="text-xs leading-snug text-muted-foreground">{criterion.why}</p>
    </li>
  );
}

// -- Compare view --------------------------------------------------------------

function CompareView({
  moves,
  selectedMoveId,
  onChoose,
}: {
  moves: PositioningMove[];
  selectedMoveId: string | null;
  onChoose: (move: PositioningMove) => void;
}): JSX.Element {
  // Union of criteria names across all moves, preserving first-seen order.
  const criteria: string[] = [];
  for (const move of moves) {
    for (const c of move.criteriaScores) {
      if (!criteria.includes(c.criterion)) criteria.push(c.criterion);
    }
  }

  const rawScoreFor = (move: PositioningMove, name: string): number | null => {
    const found = move.criteriaScores.find((c) => c.criterion === name);
    return found ? found.score : null;
  };

  // Highest score on a given criterion row (used to highlight the winning cell,
  // matching the mockup). Ignores moves that don't carry that criterion.
  const maxFor = (name: string): number | null => {
    const present = moves.map((m) => rawScoreFor(m, name)).filter((s): s is number => s !== null);
    return present.length ? Math.max(...present) : null;
  };

  const maxComposite = Math.max(...moves.map((m) => m.composite));
  const winCls = 'font-semibold text-gold-warm';

  return (
    <div className="-mx-1 overflow-x-auto" data-testid="decision-board-compare">
      <table className="w-full min-w-[28rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="p-2 font-medium text-muted-foreground">Criterion</th>
            {moves.map((m) => (
              <th key={m.id} className="p-2 align-bottom font-semibold text-foreground">
                {m.headline}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((name) => {
            const max = maxFor(name);
            return (
              <tr key={name} className="border-b border-border/60">
                <td className="p-2 text-muted-foreground">{name}</td>
                {moves.map((m) => {
                  const raw = rawScoreFor(m, name);
                  const isWin = raw !== null && max !== null && raw === max;
                  return (
                    <td
                      key={m.id}
                      className={`p-2 tabular-nums ${isWin ? winCls : 'text-foreground'}`}
                      data-win={isWin}
                    >
                      {raw !== null ? fmtScore(raw) : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr className="border-b border-border">
            <td className="p-2 font-semibold text-foreground">Composite</td>
            {moves.map((m) => (
              <td key={m.id} className="p-2">
                <Badge
                  variant={m.composite === maxComposite ? 'default' : 'secondary'}
                  data-win={m.composite === maxComposite}
                >
                  {fmtScore(m.composite)}
                </Badge>
              </td>
            ))}
          </tr>
          <tr>
            <td className="p-2" />
            {moves.map((m) => (
              <td key={m.id} className="p-2">
                <Button
                  type="button"
                  variant={m.id === selectedMoveId ? 'brand' : 'outline'}
                  size="sm"
                  className="min-h-10 w-full gap-1"
                  onClick={() => onChoose(m)}
                  aria-pressed={m.id === selectedMoveId}
                  data-testid={`compare-choose-${m.id}`}
                >
                  {m.id === selectedMoveId ? 'Chosen' : 'Choose'}
                </Button>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
