/**
 * AvatarPortraitCard — the Avatar-2.0 four-field portrait (.af card), restated
 * STRICTLY from the user's own words (src/lib/v4/megapromptParse → portrait).
 * Renders nothing when no portrait could be honestly derived.
 */
import { User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AvatarPortrait } from '@/types/onboardingReflection';

interface AvatarPortraitCardProps {
  portrait: AvatarPortrait | null;
}

const FIELDS: ReadonlyArray<{ key: keyof AvatarPortrait; label: string; tone: string }> = [
  { key: 'who', label: 'Who they are', tone: 'text-idea-i' },
  { key: 'problem', label: 'Their problem', tone: 'text-idea-e' },
  { key: 'desire', label: 'What they want', tone: 'text-idea-a' },
  { key: 'channel', label: 'Where you reach them', tone: 'text-idea-d' },
];

export function AvatarPortraitCard({ portrait }: AvatarPortraitCardProps): JSX.Element | null {
  if (!portrait) return null;
  return (
    <Card data-testid="avatar-portrait-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4 text-gold-warm" />
          Your customer, in your words
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(({ key, label, tone }) => (
          <div key={key} className="rounded-md bg-muted/60 px-3 py-2">
            <p className={`text-xs font-semibold uppercase tracking-wide ${tone}`}>{label}</p>
            <p className="break-words text-sm text-foreground">{portrait[key]}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
