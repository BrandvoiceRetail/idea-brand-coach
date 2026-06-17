import { describe, it, expect } from 'vitest';
import {
  rgbaToHex,
  parseFigmaFileKey,
  extractDesign,
  buildDesignSummary,
  type FigmaFileResponse,
} from '../../supabase/functions/_shared/figma-extract';

/** A small but representative Figma file response covering the cases we extract. */
const sampleFile: FigmaFileResponse = {
  name: 'Acme Brand',
  lastModified: '2026-06-01T00:00:00Z',
  thumbnailUrl: 'https://figma.example/thumb.png',
  components: {
    '1:1': { key: 'ckey1', name: 'Button', description: 'Primary button' },
    '1:2': { key: 'ckey2', name: 'Card' },
  },
  styles: {
    'S:fill1': { key: 'fk1', name: 'Primary/Blue', styleType: 'FILL' },
    'S:text1': { key: 'tk1', name: 'Heading/H1', styleType: 'TEXT' },
  },
  document: {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    children: [
      {
        id: '1:0',
        name: 'Page 1',
        type: 'CANVAS',
        children: [
          {
            id: '2:0',
            name: 'Rect',
            type: 'RECTANGLE',
            styles: { fill: 'S:fill1' },
            fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8, a: 1 } }],
          },
          {
            id: '2:1',
            name: 'Title',
            type: 'TEXT',
            styles: { text: 'S:text1' },
            style: { fontFamily: 'Inter', fontSize: 32, fontWeight: 700, lineHeightPx: 40 },
            fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } }],
          },
        ],
      },
      { id: '1:1', name: 'Page 2', type: 'CANVAS', children: [] },
    ],
  },
};

describe('rgbaToHex', () => {
  it('converts 0..1 channels to #RRGGBB', () => {
    expect(rgbaToHex({ r: 1, g: 1, b: 1 })).toBe('#FFFFFF');
    expect(rgbaToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    expect(rgbaToHex({ r: 0.2, g: 0.4, b: 0.8 })).toBe('#3366CC');
  });
});

describe('parseFigmaFileKey', () => {
  it('extracts the key from /design and /file URLs', () => {
    expect(parseFigmaFileKey('https://www.figma.com/design/abc123XYZ/My-Brand')).toBe('abc123XYZ');
    expect(parseFigmaFileKey('https://www.figma.com/file/Key999/Title')).toBe('Key999');
  });

  it('passes through a bare key', () => {
    expect(parseFigmaFileKey('abc123')).toBe('abc123');
  });

  it('returns null for non-keys', () => {
    expect(parseFigmaFileKey('not a key!!')).toBeNull();
    expect(parseFigmaFileKey('')).toBeNull();
  });
});

describe('extractDesign', () => {
  const design = extractDesign(sampleFile);

  it('captures file metadata and pages', () => {
    expect(design.fileName).toBe('Acme Brand');
    expect(design.thumbnailUrl).toBe('https://figma.example/thumb.png');
    expect(design.pages).toEqual(['Page 1', 'Page 2']);
  });

  it('extracts a named palette from solid fills', () => {
    const primary = design.palette.find((c) => c.hex === '#3366CC');
    expect(primary).toBeDefined();
    expect(primary?.name).toBe('Primary/Blue');
  });

  it('extracts typography from TEXT nodes with the published style name', () => {
    expect(design.typography).toEqual([
      { name: 'Heading/H1', fontFamily: 'Inter', fontSize: 32, fontWeight: 700, lineHeightPx: 40 },
    ]);
  });

  it('lists published components by name', () => {
    expect(design.components.map((c) => c.name)).toEqual(['Button', 'Card']);
  });

  it('respects the maxColors cap', () => {
    const capped = extractDesign(sampleFile, { maxColors: 1 });
    expect(capped.palette).toHaveLength(1);
  });
});

describe('buildDesignSummary', () => {
  it('produces a readable summary the coach can reference', () => {
    const summary = buildDesignSummary(extractDesign(sampleFile));
    expect(summary).toContain('Acme Brand');
    expect(summary).toContain('#3366CC');
    expect(summary).toContain('Primary/Blue');
    expect(summary).toContain('Inter');
    expect(summary).toContain('Button');
  });
});
