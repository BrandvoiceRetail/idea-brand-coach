/**
 * Tests for generate_brief tool with Decision Trigger support
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runGenerateBrief, type GenerateBriefDeps } from '../generateBrief';
import type { DecisionTriggerRow } from '../../service/decisionTriggerStore';

describe('generateBrief with Decision Trigger', () => {
  let deps: GenerateBriefDeps;

  const mockCanvasRow = {
    id: 'canvas-123',
    content: { brand_name: 'TestBrand', positioning: 'test' },
  };

  const mockSignatureRow = {
    id: 'sig-456',
    content: { signature_text: 'Test signature' },
  };

  const mockDecisionTrigger: DecisionTriggerRow = {
    id: 'trigger-789',
    user_id: 'user-1',
    session_id: 'session-1',
    avatar_id: 'avatar-1',
    content: {
      dominant_type: 'Recognition',
      brand_anchor: 'Premium quality trusted by professionals',
      evidence_phrases: ['finally works', 'no more frustration'],
      placement_instruction: 'Lead with the moment of recognition',
      why_this_trigger: 'Strongest emotional lever in reviews',
    },
    generated_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
  };

  const mockProductClaims = {
    status: 'filled-evidence' as const,
    value: ['Holds 432 cards', '30-day guarantee'],
    source: 'user-confirmed',
  };

  const mockExportBriefResponse = {
    ok: true,
    data: {
      title_formula: {
        brief: 'Lead with brand',
        example_output: 'TestBrand Premium Card Holder',
        product_truth_claims: [],
      },
      bullets: Array(5).fill({
        element: 'Bullet',
        brief: 'Test brief',
        example_output: 'Test output',
        stage_ref: 'canvas',
        product_truth_claims: [],
      }),
      image_brief: Array(7).fill({
        slot: 'Hero',
        intent: 'Test intent',
        brief: 'Test brief',
      }),
      ppc_keywords: {
        tier_a: ['keyword1'],
        tier_b: ['keyword2'],
        tier_c: ['keyword3'],
      },
      grounding: 'evidence',
      evidence_refs: [{ kind: 'artifact', ref: 'brand_canvas' }],
    },
  };

  beforeEach(() => {
    deps = {
      resolve: vi.fn().mockResolvedValue([mockProductClaims]),
      getCurrentArtifact: vi.fn(),
      saveArtifact: vi.fn().mockResolvedValue({ id: 'saved-123' }),
      getLatestDecisionTrigger: vi.fn(),
      edgeFn: {
        invoke: vi.fn().mockResolvedValue(mockExportBriefResponse),
      } as unknown as GenerateBriefDeps['edgeFn'],
      sleep: vi.fn(),
    };
  });

  describe('Positioning root precedence', () => {
    it('should prefer Canvas over Decision Trigger and Signature', async () => {
      deps.getCurrentArtifact = vi.fn()
        .mockResolvedValueOnce(mockCanvasRow) // canvas
        .mockResolvedValueOnce(mockSignatureRow) // signature
        .mockResolvedValueOnce(null) // s1
        .mockResolvedValueOnce(null) // s3
        .mockResolvedValueOnce(null); // s4
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(mockDecisionTrigger);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(deps.edgeFn.invoke).toHaveBeenCalledWith('export-brief', expect.objectContaining({
        canvas: mockCanvasRow.content,
        signature: mockSignatureRow.content,
        trigger: mockDecisionTrigger.content,
      }));
      expect(result.status).toBe('persisted');
    });

    it('should use Decision Trigger when no Canvas exists', async () => {
      deps.getCurrentArtifact = vi.fn()
        .mockResolvedValueOnce(null) // no canvas
        .mockResolvedValueOnce(mockSignatureRow) // signature
        .mockResolvedValueOnce(null) // s1
        .mockResolvedValueOnce(null) // s3
        .mockResolvedValueOnce(null); // s4
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(mockDecisionTrigger);

      // Update mock response to reflect trigger as root
      const triggerResponse = {
        ...mockExportBriefResponse,
        data: {
          ...mockExportBriefResponse.data,
          evidence_refs: [{ kind: 'artifact', ref: 'decision_trigger' }],
        },
      };
      deps.edgeFn.invoke = vi.fn().mockResolvedValue(triggerResponse);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(deps.edgeFn.invoke).toHaveBeenCalledWith('export-brief', expect.objectContaining({
        canvas: null,
        signature: mockSignatureRow.content,
        trigger: mockDecisionTrigger.content,
      }));
      expect(result.status).toBe('persisted');
    });

    it('should use Signature when no Canvas or Trigger exists', async () => {
      deps.getCurrentArtifact = vi.fn()
        .mockResolvedValueOnce(null) // no canvas
        .mockResolvedValueOnce(mockSignatureRow) // signature
        .mockResolvedValueOnce(null) // s1
        .mockResolvedValueOnce(null) // s3
        .mockResolvedValueOnce(null); // s4
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(null); // no trigger

      // Update mock response to reflect signature as root
      const signatureResponse = {
        ...mockExportBriefResponse,
        data: {
          ...mockExportBriefResponse.data,
          evidence_refs: [{ kind: 'artifact', ref: 'signature' }],
        },
      };
      deps.edgeFn.invoke = vi.fn().mockResolvedValue(signatureResponse);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(deps.edgeFn.invoke).toHaveBeenCalledWith('export-brief', expect.objectContaining({
        canvas: null,
        signature: mockSignatureRow.content,
        trigger: null,
      }));
      expect(result.status).toBe('persisted');
    });

    it('should return needs_input when no positioning root exists', async () => {
      deps.getCurrentArtifact = vi.fn().mockResolvedValue(null);
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(null);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(result.status).toBe('needs_input');
      expect(result).toEqual(expect.objectContaining({
        status: 'needs_input',
        reason: 'no_canvas',
        needs_input: expect.arrayContaining([
          expect.objectContaining({
            slot: 1,
            question: expect.stringContaining('Brand Canvas'),
          }),
        ]),
      }));
      expect(deps.edgeFn.invoke).not.toHaveBeenCalled();
    });
  });

  describe('Evidence refs handling', () => {
    it('should set decision_trigger as root ref when trigger is the positioning source', async () => {
      deps.getCurrentArtifact = vi.fn()
        .mockResolvedValueOnce(null) // no canvas
        .mockResolvedValueOnce(null) // no signature
        .mockResolvedValueOnce(null) // s1
        .mockResolvedValueOnce(null) // s3
        .mockResolvedValueOnce(null); // s4
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(mockDecisionTrigger);

      const triggerOnlyResponse = {
        ...mockExportBriefResponse,
        data: {
          ...mockExportBriefResponse.data,
          grounding: 'evidence', // trigger is evidence-derived
          evidence_refs: [{ kind: 'artifact', ref: 'decision_trigger' }],
        },
      };
      deps.edgeFn.invoke = vi.fn().mockResolvedValue(triggerOnlyResponse);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(result.status).toBe('persisted');
      if (result.status === 'persisted') {
        expect(result.content.evidence_refs).toContainEqual({
          kind: 'artifact',
          ref: 'decision_trigger',
        });
        expect(result.grounding).toBe('evidence');
      }
    });
  });

  describe('Avatar fallback behavior', () => {
    it('should fall back to brand-level trigger when avatar-specific trigger not found', async () => {
      deps.getCurrentArtifact = vi.fn().mockResolvedValue(null);

      // Mock getLatestDecisionTrigger to simulate avatar -> brand fallback
      const brandLevelTrigger = { ...mockDecisionTrigger, avatar_id: null };
      deps.getLatestDecisionTrigger = vi.fn().mockResolvedValue(brandLevelTrigger);

      const result = await runGenerateBrief('avatar-1', deps);

      expect(deps.getLatestDecisionTrigger).toHaveBeenCalledWith('avatar-1');
      expect(deps.edgeFn.invoke).toHaveBeenCalledWith('export-brief', expect.objectContaining({
        trigger: brandLevelTrigger.content,
      }));
    });
  });
});