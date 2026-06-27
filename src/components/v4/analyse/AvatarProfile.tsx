/**
 * AvatarProfile (S-08) — the Loop-2 Avatar 2.0 four-field forensic portrait
 * (who they are / their problem / what they want / where you reach them),
 * restated STRICTLY from the user's own words and made editable here.
 *
 * WHAT: A read-it-back restatement (reusing AvatarPortraitCard) followed by four
 * editable fields the user can refine, then a single primary CTA to confirm the
 * avatar the rest of the Analyse loop reasons over.
 *
 * WHY: Avatar is the first leg of the Diagnose→Analyse→Fix spine — every later
 * engine (Trust Gap, Decision Trigger, positioning Moves, Brief) reasons over
 * THIS portrait, so it must be the customer's truth, confirmed by the user.
 *
 * NO-FABRICATION: this surface NEVER invents a portrait. When none can be
 * honestly derived it shows an honest empty state; when the build is in flight
 * it shows loading; when the coach couldn't be reached it shows an error with a
 * retry. Fields are seeded ONLY from the restated portrait — never autofilled.
 */
import { useEffect, useState } from 'react';
import { User, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AvatarPortraitCard } from '@/components/v4/onboarding/AvatarPortraitCard';
import {
  captureAlphaEvent,
  type AlphaEventProps,
} from '@/lib/posthogClient';
import type { AvatarPortrait } from '@/types/v4Analyse';

/**
 * Loop-2 funnel events for this screen. Cast to the shared union at the single
 * call site below — keeps the canonical client untouched while still flowing
 * through the one PostHog seam (which carries IDs/booleans only, never copy).
 */
type V4AvatarProfileEvent =
  | 'v4_avatar_profile_field_edited'
  | 'v4_avatar_profile_confirmed';

function captureV4(name: V4AvatarProfileEvent, properties?: AlphaEventProps): void {
  captureAlphaEvent(name, properties);
}

/** The four portrait fields, in spine order, with plain-language labels. */
const FIELDS: ReadonlyArray<{ key: keyof AvatarPortrait; label: string; hint: string }> = [
  { key: 'who', label: 'Who they are', hint: 'The customer in your own words.' },
  { key: 'problem', label: 'Their problem', hint: 'What they are struggling with.' },
  { key: 'desire', label: 'What they want', hint: 'The outcome they are after.' },
  { key: 'channel', label: 'Where you reach them', hint: 'Where they meet your brand.' },
];

/** Value-equality over the four portrait fields (handles null on either side). */
function portraitsEqual(a: AvatarPortrait | null, b: AvatarPortrait | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return FIELDS.every(({ key }) => a[key] === b[key]);
}

export interface AvatarProfileProps {
  /** The restated four-field portrait — null when none could be derived yet. */
  portrait: AvatarPortrait | null;
  /** True while the avatar build is in flight. */
  isLoading?: boolean;
  /** Set when the coach couldn't be reached / the build failed. */
  error?: string | null;
  /** Fires on each field edit (field key + new value). */
  onEdit: (field: keyof AvatarPortrait, value: string) => void;
  /** Fires when the user confirms the (possibly edited) portrait. */
  onConfirm: (portrait: AvatarPortrait) => void;
  /** Retry the build after an error (omit to hide the retry button). */
  onRetry?: () => void;
}

export function AvatarProfile({
  portrait,
  isLoading = false,
  error = null,
  onEdit,
  onConfirm,
  onRetry,
}: AvatarProfileProps): JSX.Element {
  const [draft, setDraft] = useState<AvatarPortrait | null>(portrait);

  // Re-seed ONLY when the incoming portrait differs in CONTENT from the draft —
  // never autofill blank fields. The parent echoes each edit back as a NEW
  // portrait object reference; re-seeding on reference alone would replace the
  // draft mid-keystroke and reset the textarea caret to the end. The value-equal
  // guard skips that echo while still re-seeding a genuine coach-pushed update.
  useEffect(() => {
    setDraft((prev) => (portraitsEqual(prev, portrait) ? prev : portrait));
  }, [portrait]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <Card data-testid="v4-avatar-profile-loading">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-gold-warm" />
            Sketching your customer…
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {FIELDS.map((f) => (
            <Skeleton key={f.key} className="h-16 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Alert variant="destructive" data-testid="v4-avatar-profile-error">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Couldn't build your customer portrait</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          {onRetry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // ── Empty (nothing honestly derivable yet) ──────────────────────────────────
  if (!draft) {
    return (
      <Card data-testid="v4-avatar-profile-empty">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4 text-muted-foreground" />
            No customer portrait yet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Share a bit about your brand and customer and I'll restate your
            customer back to you here — in your own words, nothing invented.
          </p>
        </CardContent>
      </Card>
    );
  }

  const allFilled = FIELDS.every(({ key }) => draft[key].trim().length > 0);

  const handleFieldChange = (field: keyof AvatarPortrait, value: string): void => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
    onEdit(field, value);
    captureV4('v4_avatar_profile_field_edited', { field });
  };

  const handleConfirm = (): void => {
    if (!allFilled) return;
    onConfirm(draft);
    captureV4('v4_avatar_profile_confirmed', {});
  };

  // ── Ready: restate (read-back) + edit + confirm ─────────────────────────────
  return (
    <div className="space-y-4" data-testid="v4-avatar-profile">
      <AvatarPortraitCard portrait={draft} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Refine it if I got anything wrong</CardTitle>
          <p className="text-sm text-muted-foreground">
            This is the customer the rest of the work reasons over. Edit any field
            so it's true to your customer — then confirm.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`avatar-field-${key}`} className="text-sm font-medium">
                  {label}
                </Label>
                <Textarea
                  id={`avatar-field-${key}`}
                  data-testid={`avatar-field-${key}`}
                  value={draft[key]}
                  onChange={(e) => handleFieldChange(key, e.target.value)}
                  placeholder={hint}
                  className="min-h-[64px] resize-y break-words"
                />
              </div>
            ))}
          </div>

          {!allFilled && (
            <p className="text-xs text-muted-foreground" data-testid="avatar-incomplete-hint">
              Fill in every field in your own words before confirming — I won't
              guess one for you.
            </p>
          )}

          <Button
            type="button"
            variant="brand"
            onClick={handleConfirm}
            disabled={!allFilled}
            data-testid="avatar-confirm"
            className="w-full gap-2 sm:w-auto"
          >
            <CheckCircle2 className="h-4 w-4" />
            This is my customer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
