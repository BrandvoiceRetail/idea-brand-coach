/**
 * ForensicArtifactReview — read-only render of the persisted S1→S4 artifacts (§4.2).
 *
 * Presentational. The forensic build is review-read-only: artifacts are NOT
 * editable here. A manual edit is a separate, explicit path (avatar field edit
 * with field_source='manual') the enforce_avatar_field_lock trigger protects;
 * this view never mutates artifacts, so a re-run can supersede them safely.
 */

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  FORENSIC_STAGE_LABELS,
  type ForensicStage,
  type StageArtifact,
  type S1Vocab,
  type S2Jobmap,
  type S3Triggers,
  type S4Objections,
} from '@/types/forensicBuild';

interface ForensicArtifactReviewProps {
  stage: ForensicStage;
  content: StageArtifact['content'];
}

// StageArtifact['content'] is the union of S1Vocab | S2Jobmap | S3Triggers | S4Objections.

export function ForensicArtifactReview({ stage, content }: ForensicArtifactReviewProps): JSX.Element {
  return (
    <Card className="p-3 space-y-2" data-testid={`forensic-review-${stage}`}>
      <h4 className="text-sm font-semibold">{FORENSIC_STAGE_LABELS[stage]}</h4>
      {stage === 's1' &&
        (content as S1Vocab).clusters.map((c, i) => (
          <div key={i} className="text-sm">
            <span className="font-medium">{c.cluster}</span>{' '}
            <Badge variant="secondary">{c.frequency_signal}</Badge>
            <div className="text-muted-foreground">{c.customer_words.join(', ')}</div>
            <p className="text-xs text-muted-foreground">{c.why_it_matters}</p>
          </div>
        ))}
      {stage === 's2' &&
        (content as S2Jobmap).job_map.map((j, i) => (
          <div key={i} className="text-sm">
            <p><span className="font-medium">Functional:</span> {j.functional_job}</p>
            <p><span className="font-medium">Emotional:</span> {j.emotional_job}</p>
            <p><span className="font-medium">Identity:</span> {j.identity_job}</p>
            <p className="text-muted-foreground"><span className="font-medium">Villain:</span> {j.villain}</p>
          </div>
        ))}
      {stage === 's3' &&
        (content as S3Triggers).triggers.map((t, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium">{t.trigger_moment}</p>
            <p className="text-muted-foreground">{t.what_they_feel}</p>
            <p className="text-xs">Searches: {t.search_terms.join(', ')} ({t.estimated_volume_band})</p>
          </div>
        ))}
      {stage === 's4' &&
        (content as S4Objections).objections.map((o, i) => (
          <div key={i} className="text-sm">
            <p className="font-medium">{o.hesitation}</p>
            <p className="text-muted-foreground italic">&ldquo;{o.verbatim_signal}&rdquo;</p>
            <p className="text-xs">Resolution: {o.resolution}</p>
          </div>
        ))}
    </Card>
  );
}
