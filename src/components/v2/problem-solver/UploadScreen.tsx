/**
 * S3 — Upload (ASIN/URL).
 *
 * ASIN is the working path: a textarea parsed via parseAsinInput (first ASIN).
 * Screenshot upload is a FUTURE capability (F2) — the drop zone is shown but
 * labelled honestly as coming soon and is not wired. "Analyse my listing"
 * is enabled only once a valid ASIN is parsed; it hands the ASIN up and advances.
 */

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Upload as UploadIcon, CheckCircle2 } from 'lucide-react';
import { parseAsinInput } from '@/utils/asinParser';
import { PS_COLORS } from './theme';
import { Eyebrow, ScreenHeading, Lede, GhostButton, GoldButton } from './primitives';

interface UploadScreenProps {
  /** Pre-fill (e.g. when the user comes back to S3). */
  defaultValue?: string;
  /** Hand the validated uppercase ASIN up and advance to S4. */
  onAnalyse: (asin: string) => void;
  onBack: () => void;
}

export function UploadScreen({ defaultValue, onAnalyse, onBack }: UploadScreenProps): JSX.Element {
  const [input, setInput] = useState(defaultValue ?? '');
  const asin = parseAsinInput(input)[0];
  const showInvalid = input.trim() !== '' && !asin;

  return (
    <div>
      <Eyebrow>Your account · context remembered</Eyebrow>
      <ScreenHeading>Upload your listing</ScreenHeading>
      <Lede>
        Paste your Amazon ASIN or product URL — we read it the way a shopper does, and pull your live
        reviews automatically. Upload once; every future session builds on it.
      </Lede>

      <div className="mb-3 space-y-2">
        <label htmlFor="ps-asin" className="text-sm font-bold" style={{ color: PS_COLORS.navy }}>
          ASIN or Amazon URL
        </label>
        <textarea
          id="ps-asin"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={2}
          placeholder={'B0CJBQ7F5C\nhttps://www.amazon.com/dp/B0CJBQ7F5C'}
          className="w-full rounded-[10px] border bg-white p-3 font-mono text-sm"
          style={{ borderColor: PS_COLORS.line }}
        />
        {showInvalid && (
          <p className="text-sm" style={{ color: PS_COLORS.warn }}>
            That doesn&rsquo;t look like a valid ASIN or Amazon URL yet.
          </p>
        )}
        {asin && (
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: PS_COLORS.green }}>
            <CheckCircle2 className="h-4 w-4" /> {asin} ready to analyse
          </div>
        )}
      </div>

      {/* Screenshot upload is FUTURE (F2) — shown, labelled honestly, not wired. */}
      <div
        className="mb-4 rounded-2xl border-2 border-dashed bg-white p-6 text-center text-sm font-semibold"
        style={{ borderColor: '#D0D5DD', color: PS_COLORS.g500 }}
      >
        <UploadIcon className="mx-auto mb-2 h-7 w-7" style={{ color: PS_COLORS.gold }} />
        Screenshot upload is coming soon
        <br />
        <span className="text-xs">For now, paste your ASIN or product URL above — that&rsquo;s the working path.</span>
      </div>

      <div className="flex justify-between">
        <GhostButton onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </GhostButton>
        <GoldButton disabled={!asin} onClick={() => asin && onAnalyse(asin)}>
          Analyse my listing
          <ArrowRight className="h-4 w-4" />
        </GoldButton>
      </div>
    </div>
  );
}
