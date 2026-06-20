import { describe, it, expect } from 'vitest';
import {
  TitanAlertSource,
  mapCategoryToDimension,
  deriveSeverity,
  buildInterpretation,
  buildResponseBrief,
  pendingDraftedResponse,
  type AlertEvent,
} from '../lib';

const baseEvent = (overrides: Partial<AlertEvent> = {}): AlertEvent => ({
  external_id: 'evt-1',
  category: 'listing-integrity',
  title: 'Listing changed',
  description: 'A competitor edited the listing copy.',
  ...overrides,
});

describe('brand-defense-monitor lib', () => {
  describe('TitanAlertSource (STUB)', () => {
    it('is flagged coverage-unverified', () => {
      const source = new TitanAlertSource();
      expect(source.name).toBe('titan-stub');
      expect(source.coverageVerified).toBe(false);
    });

    it('returns NO alerts by default (never a fabricated live threat)', async () => {
      const source = new TitanAlertSource();
      const alerts = await source.fetchAlerts({ avatarId: 'a-1' });
      expect(alerts).toEqual([]);
    });

    it('returns a clearly-marked fixture only when explicitly enabled', async () => {
      const source = new TitanAlertSource(true);
      const alerts = await source.fetchAlerts({ avatarId: 'a-1', asins: ['B0XYZ'] });
      expect(alerts).toHaveLength(1);
      // Fixture is obviously synthetic — title carries [STUB], desc says FIXTURE.
      expect(alerts[0].title).toContain('[STUB]');
      expect(alerts[0].description).toContain('FIXTURE');
      expect(alerts[0].description).toContain('UNVERIFIED');
      // It only echoes evidence the context supplied (no invented refs).
      expect(alerts[0].evidence).toEqual([{ kind: 'asin', ref: 'B0XYZ' }]);
    });

    it('emits no fabricated evidence when none is supplied', async () => {
      const source = new TitanAlertSource(true);
      const alerts = await source.fetchAlerts({ avatarId: 'a-1' });
      expect(alerts[0].evidence).toEqual([]);
    });
  });

  describe('mapCategoryToDimension (deterministic, not an LLM score)', () => {
    it('maps each category to its threatened IDEA pillar', () => {
      expect(mapCategoryToDimension('listing-integrity')).toBe('distinctive');
      expect(mapCategoryToDimension('buy-box')).toBe('authentic');
      expect(mapCategoryToDimension('compliance')).toBe('authentic');
      expect(mapCategoryToDimension('reputation')).toBe('empathetic');
    });
  });

  describe('deriveSeverity', () => {
    it('honours a source-supplied severity', () => {
      expect(deriveSeverity(baseEvent({ severity: 'low' }))).toBe('low');
    });

    it('falls back to a per-category default', () => {
      expect(deriveSeverity(baseEvent({ category: 'buy-box', severity: undefined }))).toBe('critical');
      expect(deriveSeverity(baseEvent({ category: 'reputation', severity: undefined }))).toBe('medium');
    });
  });

  describe('buildInterpretation (grounded — restates source, no fabrication)', () => {
    it('names the threatened pillar and quotes the source description', () => {
      const out = buildInterpretation(baseEvent(), 'distinctive');
      expect(out).toContain('Distinctive');
      expect(out).toContain('A competitor edited the listing copy.');
    });
  });

  describe('buildResponseBrief', () => {
    it('forbids naming competitors / inventing facts in the brief', () => {
      const out = buildResponseBrief(baseEvent(), 'distinctive');
      expect(out).toContain('Do not reference competitors by name');
      expect(out).toContain('do not invent facts');
      expect(out).toContain('Distinctive');
    });
  });

  describe('pendingDraftedResponse (grounded default — never a fabricated draft)', () => {
    it('returns a pending-generation envelope with no copy', () => {
      const out = pendingDraftedResponse(baseEvent(), 'distinctive');
      expect(out.status).toBe('pending-generation');
      expect(out.copy).toBeNull();
      expect(out.publish_filter).toBeNull();
      expect(out.threatened_dimension).toBe('distinctive');
      expect(out.brief).toContain('Distinctive');
    });
  });
});
