import { describe, it, expect, afterEach } from 'vitest';
import { expertEmails, isExpertEmail } from '../experts.js';

const ORIGINAL = process.env.EXPERT_EMAILS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.EXPERT_EMAILS;
  else process.env.EXPERT_EMAILS = ORIGINAL;
});

describe('expert allowlist', () => {
  it('defaults to Trevor and NOT to any admin (Matthew)', () => {
    delete process.env.EXPERT_EMAILS;
    expect(isExpertEmail('trevor@brandvoice.co.uk')).toBe(true);
    expect(isExpertEmail('matthew@icodemybusiness.com')).toBe(false);
    expect(isExpertEmail('matthew@arisegroup.ai')).toBe(false);
  });

  it('is case-insensitive and trims', () => {
    delete process.env.EXPERT_EMAILS;
    expect(isExpertEmail('  Trevor@BrandVoice.co.UK ')).toBe(true);
  });

  it('null / empty is never an expert', () => {
    expect(isExpertEmail(null)).toBe(false);
    expect(isExpertEmail('')).toBe(false);
    expect(isExpertEmail(undefined)).toBe(false);
  });

  it('honours an EXPERT_EMAILS override', () => {
    process.env.EXPERT_EMAILS = 'someone@else.com, another@x.io';
    expect(expertEmails()).toEqual(['someone@else.com', 'another@x.io']);
    expect(isExpertEmail('someone@else.com')).toBe(true);
    expect(isExpertEmail('trevor@brandvoice.co.uk')).toBe(false);
  });
});
