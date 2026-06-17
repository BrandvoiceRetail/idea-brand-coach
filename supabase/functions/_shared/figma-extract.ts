/**
 * Pure helpers for turning a Figma REST file response into brand design data.
 *
 * This module is intentionally free of any Deno / network / crypto APIs so it can
 * be unit-tested directly by Vitest (see src/__tests__/figma-extract.test.ts) and
 * reused by the figma-sync edge function. Keep it pure.
 */

// ── Figma REST shapes (the subset we read) ──────────────────────────────────
export interface FigmaRGBA {
  r: number; // 0..1
  g: number;
  b: number;
  a?: number;
}

export interface FigmaPaint {
  type?: string; // 'SOLID', 'GRADIENT_LINEAR', ...
  visible?: boolean;
  opacity?: number;
  color?: FigmaRGBA;
}

export interface FigmaTextStyle {
  fontFamily?: string;
  fontPostScriptName?: string;
  fontWeight?: number;
  fontSize?: number;
  lineHeightPx?: number;
  letterSpacing?: number;
}

export interface FigmaNode {
  id?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  fills?: FigmaPaint[];
  style?: FigmaTextStyle;
  /** Map of property -> published style id, e.g. { fill: 'S:abc', text: 'S:def' } */
  styles?: Record<string, string>;
  children?: FigmaNode[];
}

export interface FigmaStyleMeta {
  key?: string;
  name?: string;
  styleType?: string; // 'FILL' | 'TEXT' | 'EFFECT' | 'GRID'
}

export interface FigmaComponentMeta {
  key?: string;
  name?: string;
  description?: string;
}

export interface FigmaFileResponse {
  name?: string;
  lastModified?: string;
  thumbnailUrl?: string;
  document?: FigmaNode;
  components?: Record<string, FigmaComponentMeta>;
  styles?: Record<string, FigmaStyleMeta>;
}

// ── Extracted output ────────────────────────────────────────────────────────
export interface PaletteEntry {
  hex: string;
  name?: string;
  opacity?: number; // 0..1, present only when < 1
}

export interface TypographyEntry {
  name?: string;
  fontFamily: string;
  fontSize?: number;
  fontWeight?: number;
  lineHeightPx?: number;
}

export interface ComponentEntry {
  name: string;
  key?: string;
  description?: string;
}

export interface ExtractedDesign {
  fileName: string;
  lastModified?: string;
  thumbnailUrl?: string;
  pages: string[];
  palette: PaletteEntry[];
  typography: TypographyEntry[];
  components: ComponentEntry[];
}

export interface ExtractOptions {
  maxColors?: number;
  maxType?: number;
  maxComponents?: number;
  maxNodes?: number;
}

const DEFAULTS: Required<ExtractOptions> = {
  maxColors: 16,
  maxType: 12,
  maxComponents: 40,
  maxNodes: 20000,
};

/** Clamp a 0..1 channel to a 2-digit hex pair. */
function channelToHex(channel: number): string {
  const v = Math.max(0, Math.min(255, Math.round((channel ?? 0) * 255)));
  return v.toString(16).padStart(2, '0');
}

/** Convert a Figma {r,g,b,a} (0..1 floats) to an uppercase #RRGGBB hex string. */
export function rgbaToHex(color: FigmaRGBA): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`.toUpperCase();
}

/**
 * Accept a raw Figma file key OR a figma.com URL and return the file key.
 * Returns null when the input can't be resolved to a key.
 */
export function parseFigmaFileKey(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // figma.com/file/<key>/..., /design/<key>/..., /proto/<key>/...
  const urlMatch = trimmed.match(/figma\.com\/(?:file|design|proto|board)\/([A-Za-z0-9]+)/i);
  if (urlMatch) return urlMatch[1];

  // Bare key: letters + digits, no slashes/spaces.
  if (/^[A-Za-z0-9]+$/.test(trimmed)) return trimmed;

  return null;
}

/** Depth-first walk with a hard node-count cap (guards against huge files). */
function walk(root: FigmaNode | undefined, cap: number, visit: (node: FigmaNode) => void): void {
  if (!root) return;
  const stack: FigmaNode[] = [root];
  let visited = 0;
  while (stack.length > 0 && visited < cap) {
    const node = stack.pop()!;
    visited++;
    visit(node);
    const children = node.children;
    if (children && children.length) {
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
}

/** Resolve the published style name referenced by a node for a given property. */
function styleNameFor(
  node: FigmaNode,
  property: string,
  styles: Record<string, FigmaStyleMeta> | undefined,
): string | undefined {
  const ref = node.styles?.[property];
  if (!ref || !styles) return undefined;
  return styles[ref]?.name;
}

/**
 * Turn a Figma file response into structured brand design data: a deduped color
 * palette, a typography scale, the page list, and the published components.
 */
export function extractDesign(file: FigmaFileResponse, options: ExtractOptions = {}): ExtractedDesign {
  const opts = { ...DEFAULTS, ...options };

  const pages: string[] = (file.document?.children ?? [])
    .filter((c) => c.type === 'CANVAS' && c.name)
    .map((c) => c.name as string);

  // Components from the file-level components map.
  const components: ComponentEntry[] = [];
  const seenComponent = new Set<string>();
  for (const meta of Object.values(file.components ?? {})) {
    const name = (meta?.name ?? '').trim();
    if (!name || seenComponent.has(name)) continue;
    seenComponent.add(name);
    components.push({ name, key: meta.key, description: meta.description?.trim() || undefined });
    if (components.length >= opts.maxComponents) break;
  }

  const palette: PaletteEntry[] = [];
  const seenHex = new Set<string>();
  const typography: TypographyEntry[] = [];
  const seenType = new Set<string>();

  walk(file.document, opts.maxNodes, (node) => {
    if (node.visible === false) return;

    // Colors — first visible SOLID fill on the node.
    if (palette.length < opts.maxColors && Array.isArray(node.fills)) {
      for (const fill of node.fills) {
        if (fill?.type !== 'SOLID' || fill.visible === false || !fill.color) continue;
        const hex = rgbaToHex(fill.color);
        if (seenHex.has(hex)) break;
        seenHex.add(hex);
        const opacity = fill.opacity ?? fill.color.a;
        palette.push({
          hex,
          name: styleNameFor(node, 'fill', file.styles) || styleNameFor(node, 'fills', file.styles),
          opacity: typeof opacity === 'number' && opacity < 1 ? Number(opacity.toFixed(2)) : undefined,
        });
        break; // one representative color per node
      }
    }

    // Typography — TEXT nodes carry a resolved style.
    if (typography.length < opts.maxType && node.type === 'TEXT' && node.style?.fontFamily) {
      const s = node.style;
      const dedupeKey = `${s.fontFamily}|${s.fontSize ?? ''}|${s.fontWeight ?? ''}`;
      if (!seenType.has(dedupeKey)) {
        seenType.add(dedupeKey);
        typography.push({
          name: styleNameFor(node, 'text', file.styles),
          fontFamily: s.fontFamily as string,
          fontSize: typeof s.fontSize === 'number' ? Math.round(s.fontSize * 100) / 100 : undefined,
          fontWeight: s.fontWeight,
          lineHeightPx: typeof s.lineHeightPx === 'number' ? Math.round(s.lineHeightPx * 100) / 100 : undefined,
        });
      }
    }
  });

  return {
    fileName: (file.name ?? 'Untitled').trim() || 'Untitled',
    lastModified: file.lastModified,
    thumbnailUrl: file.thumbnailUrl,
    pages,
    palette,
    typography,
    components,
  };
}

/**
 * Render an ExtractedDesign as a compact, human-readable markdown summary.
 * This is what gets stored as the coach's "visual_identity" knowledge so the
 * brand coach can reference the user's real colors, fonts and components.
 */
export function buildDesignSummary(design: ExtractedDesign): string {
  const lines: string[] = [];
  lines.push(`Visual identity imported from the Figma file "${design.fileName}".`);

  if (design.palette.length) {
    const colors = design.palette
      .map((c) => {
        const label = c.name ? ` (${c.name})` : '';
        const alpha = c.opacity !== undefined ? ` @${Math.round(c.opacity * 100)}%` : '';
        return `${c.hex}${label}${alpha}`;
      })
      .join(', ');
    lines.push(`Color palette (${design.palette.length}): ${colors}.`);
  } else {
    lines.push('Color palette: none detected (the file may have no solid fills).');
  }

  if (design.typography.length) {
    const type = design.typography
      .map((t) => {
        const name = t.name ? `${t.name} — ` : '';
        const size = t.fontSize ? ` ${t.fontSize}px` : '';
        const weight = t.fontWeight ? ` / weight ${t.fontWeight}` : '';
        return `${name}${t.fontFamily}${size}${weight}`;
      })
      .join('; ');
    lines.push(`Typography (${design.typography.length}): ${type}.`);
  }

  if (design.pages.length) {
    lines.push(`Pages: ${design.pages.join(', ')}.`);
  }

  if (design.components.length) {
    const shown = design.components.slice(0, 20).map((c) => c.name).join(', ');
    const extra = design.components.length > 20 ? ` (and ${design.components.length - 20} more)` : '';
    lines.push(`Components (${design.components.length}): ${shown}${extra}.`);
  }

  return lines.join('\n');
}
