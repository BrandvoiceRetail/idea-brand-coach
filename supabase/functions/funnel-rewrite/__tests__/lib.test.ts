import { describe, it, expect } from 'vitest';
import {
  formatContext,
  buildCompetitorBriefBlock,
  buildSystemPrompt,
  buildUserMessage,
  parseRewrite,
  type RewriteInput,
} from '../lib';

describe('funnel-rewrite lib', () => {
  describe('formatContext', () => {
    it('returns a trimmed string as-is', () => {
      expect(formatContext('  hello  ')).toBe('hello');
    });

    it('renders an object as key/value lines, dropping empties', () => {
      const out = formatContext({ voice: 'warm', tone: '', goal: 'sleep' });
      expect(out).toContain('- voice: warm');
      expect(out).toContain('- goal: sleep');
      expect(out).not.toContain('tone');
    });

    it('returns empty string for null/undefined', () => {
      expect(formatContext(null)).toBe('');
      expect(formatContext(undefined)).toBe('');
    });
  });

  describe('buildCompetitorBriefBlock', () => {
    it('folds the strategic angle + gap into a tagged block (the P4 seam)', () => {
      const block = buildCompetitorBriefBlock({
        strategic_angle: 'Own the bedtime ritual narrative.',
        gap_to_our_avatar: 'Competitors speak to dosage, not ritual.',
      });
      expect(block).toContain('<competitor-brief>');
      expect(block).toContain('Own the bedtime ritual narrative.');
      expect(block).toContain('Competitors speak to dosage, not ritual.');
    });

    it('marks competitor names as context-only (never to appear in copy)', () => {
      const block = buildCompetitorBriefBlock({
        strategic_angle: 'x',
        competitor_names: ['Acme Sleep'],
      });
      expect(block).toContain('do not name them in the copy');
      expect(block).toContain('Acme Sleep');
    });

    it('returns empty string when no brief is supplied', () => {
      expect(buildCompetitorBriefBlock(undefined)).toBe('');
      expect(buildCompetitorBriefBlock({})).toBe('');
    });
  });

  describe('buildSystemPrompt', () => {
    it('carries the grounding rule and the JSON output contract', () => {
      const p = buildSystemPrompt();
      expect(p).toContain('<grounding-rule>');
      expect(p).toContain('Do NOT invent competitor names, prices, statistics, or customer quotes');
      expect(p).toContain('"rewrite": string');
    });
  });

  describe('buildUserMessage', () => {
    it('includes the competitor brief, current copy, and contexts', () => {
      const input: RewriteInput = {
        touchpoint_id: 'amazon_listing_copy',
        current_copy: 'Sleep better tonight.',
        competitor_brief: { strategic_angle: 'Ritual over dosage.' },
        avatar_context: { voice: 'warm' },
        signature_context: 'Calm, never clinical.',
      };
      const msg = buildUserMessage(input);
      expect(msg).toContain('amazon_listing_copy');
      expect(msg).toContain('Ritual over dosage.');
      expect(msg).toContain('Sleep better tonight.');
      expect(msg).toContain('- voice: warm');
      expect(msg).toContain('Calm, never clinical.');
    });

    it('uses a fresh-draft placeholder when no current copy is supplied', () => {
      const msg = buildUserMessage({ competitor_brief: { strategic_angle: 'x' } });
      expect(msg).toContain('no current copy supplied');
    });
  });

  describe('parseRewrite', () => {
    it('extracts a balanced JSON object', () => {
      const out = parseRewrite('{"rewrite":"New copy.","angle_note":"Beats the dosage angle."}');
      expect(out).toEqual({ rewrite: 'New copy.', angle_note: 'Beats the dosage angle.' });
    });

    it('extracts the object even with prose/fences around it', () => {
      const raw = 'Here you go:\n```json\n{"rewrite":"Copy","angle_note":"Note"}\n```\nThanks';
      expect(parseRewrite(raw)).toEqual({ rewrite: 'Copy', angle_note: 'Note' });
    });

    it('tolerates a missing angle_note (defaults to empty)', () => {
      expect(parseRewrite('{"rewrite":"Copy"}')).toEqual({ rewrite: 'Copy', angle_note: '' });
    });

    it('returns null when there is no usable rewrite', () => {
      expect(parseRewrite('{"angle_note":"no rewrite"}')).toBeNull();
      expect(parseRewrite('not json')).toBeNull();
      expect(parseRewrite('')).toBeNull();
    });

    it('does not break on braces inside string values', () => {
      const out = parseRewrite('{"rewrite":"Use {this} tonight","angle_note":""}');
      expect(out?.rewrite).toBe('Use {this} tonight');
    });
  });
});
