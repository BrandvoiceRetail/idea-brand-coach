import { describe, it, expect } from 'vitest';
import { stripAiDashes } from '../sanitize.ts';

describe('stripAiDashes — Trevor Skill-02 no-dash backstop', () => {
  it('replaces an em dash with a comma', () => {
    expect(stripAiDashes('the current feel of your listing — would you describe it?'))
      .toBe('the current feel of your listing, would you describe it?');
  });

  it('replaces multiple em dashes', () => {
    expect(stripAiDashes('Insight — a deep read; Distinctive — standing out'))
      .toBe('Insight, a deep read; Distinctive, standing out');
  });

  it('turns a number range into "to"', () => {
    expect(stripAiDashes('aged 25–40 collectors')).toBe('aged 25 to 40 collectors');
  });

  it('handles a double dash', () => {
    expect(stripAiDashes('use commas--not dashes')).toBe('use commas, not dashes');
  });

  it('LEAVES single hyphens untouched (no mangling of compound words)', () => {
    const s = 'serious trading-card collectors who love best-selling sets';
    expect(stripAiDashes(s)).toBe(s);
  });

  it('leaves dash-free prose unchanged', () => {
    const s = 'No dashes here at all. Just clean prose.';
    expect(stripAiDashes(s)).toBe(s);
  });

  it('does not leave a doubled space or a space before punctuation', () => {
    expect(stripAiDashes('one — two — three.')).toBe('one, two, three.');
  });
});
