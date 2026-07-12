/**
 * FixBreadcrumb — the Funnel drill-down trail for the Fix stage.
 *
 * The Fix stage is the one /v4 stage with genuine 2nd-level hierarchy
 * (map → piece detail → fix). This renders that path so a user three levels deep
 * always knows where they are and can jump up ANY number of levels in one tap —
 * each ancestor is a real button; the leaf is the current page (non-interactive,
 * aria-current). It replaces the scattered single-step "Back" buttons with one
 * consistent, multi-level trail.
 *
 * Presentation only: driven by V4Fix's existing `view`/`selectedPiece` state via
 * `onCrumb`. The lateral Funnel ↔ Testing & Lift switch stays as the top tabs —
 * this expresses drill-down, never the lateral switch (two nav types, two
 * affordances, never conflated). See
 * `_bmad-output/planning-artifacts/ux-design-fix-navigation.md`.
 */
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { cn } from '@/lib/utils';

/** The Funnel drill-down depths the breadcrumb represents. */
export type FixBreadcrumbView = 'map' | 'detail' | 'fix';

export interface FixBreadcrumbProps {
  /** Current Funnel drill-down depth. */
  view: FixBreadcrumbView;
  /** Label of the piece under work (shown from `detail` down). */
  pieceLabel: string | null;
  /** Navigate up to an ancestor crumb. */
  onCrumb: (view: 'map' | 'detail') => void;
}

/** A clickable ancestor crumb — a real button: ≥44px target, keyboard-reachable. */
function CrumbButton({
  label,
  title,
  onClick,
  className,
}: {
  label: string;
  title?: string;
  onClick: () => void;
  className?: string;
}): JSX.Element {
  return (
    <BreadcrumbLink asChild>
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={cn('inline-flex min-h-11 items-center font-medium', className)}
      >
        <span className="truncate">{label}</span>
      </button>
    </BreadcrumbLink>
  );
}

export function FixBreadcrumb({ view, pieceLabel, onCrumb }: FixBreadcrumbProps): JSX.Element | null {
  // The map is the root of the Funnel; the top "Funnel" tab already carries it,
  // so there is no trail to show at depth 0 (avoids a redundant lone crumb).
  if (view === 'map') return null;

  const piece = pieceLabel?.trim() || 'This piece';
  // Cap a long piece name so a 375px crumb never forces horizontal overflow.
  const pieceCap = 'max-w-[60vw] sm:max-w-[28rem]';

  return (
    <Breadcrumb data-testid="v4-fix-breadcrumb">
      <BreadcrumbList>
        <BreadcrumbItem>
          <CrumbButton label="Funnel" onClick={() => onCrumb('map')} />
        </BreadcrumbItem>
        <BreadcrumbSeparator />

        {view === 'detail' ? (
          <BreadcrumbItem>
            <BreadcrumbPage className={cn('block truncate', pieceCap)} title={piece}>
              {piece}
            </BreadcrumbPage>
          </BreadcrumbItem>
        ) : (
          <>
            <BreadcrumbItem>
              <CrumbButton
                label={piece}
                title={piece}
                onClick={() => onCrumb('detail')}
                className={pieceCap}
              />
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Fix</BreadcrumbPage>
            </BreadcrumbItem>
          </>
        )}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
