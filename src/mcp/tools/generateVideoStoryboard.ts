/**
 * Layer 2 (tool) — `generate_video_storyboard` (OWNED — the video storyboard plan).
 *
 * Generates a positioning-aligned, scene-by-scene video storyboard plan (Amazon listing
 * video / social short / brand story), each scene tied to the Decision Trigger, the
 * Avatar's emotional core, and the Trust Gap pillar it closes — with a per-scene
 * Higgsfield `generate_video` execution route so the host can carry the composed brief
 * straight to generation, and a scene-level adjustment protocol so one changed component
 * means one re-run job. Director only: it never renders video, never invents a claim.
 */
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { groundingPreamble } from '../skills/skillLoader.js';
import { appGroundingPreamble } from '../skills/appSkills.js';
import { buildVideoStoryboard } from '../service/videoStoryboard.js';
import { safeLog } from '../logging/redact.js';
import { getIdentity, userTag } from '../context/identity.js';

const inputSchema = {
  product: z
    .string()
    .min(3)
    .describe('The product / brand the video is for — a name plus a sentence of context, or an ASIN.'),
  format: z
    .enum(['listing_video', 'social_short', 'brand_story'])
    .optional()
    .describe('The video format; defaults to listing_video (the Amazon PDP video slot).'),
  decision_trigger: z
    .enum(['permission', 'recognition', 'identity', 'belonging', 'momentum', 'fear_of_loss'])
    .optional()
    .describe('The identified Decision Trigger, if known (else identify it first via identify_decision_trigger).'),
  avatar_summary: z
    .string()
    .optional()
    .describe("Short summary of the Avatar 2.0 emotional core (the felt experience), if the coach has it."),
  signature: z.string().optional().describe('The chosen Signature (distinctive line), if one exists.'),
  trust_gap_summary: z
    .string()
    .optional()
    .describe('The Trust Gap finding — weakest pillar + score — if known.'),
  verified_facts: z
    .string()
    .optional()
    .describe('User-confirmed product facts (claims/dimensions/counts) safe to state in copy or voiceover.'),
  duration_seconds: z.number().int().min(6).max(180).optional().describe("Override the format's target duration."),
  marketplace: z.string().optional().describe('Marketplace; defaults to amazon.'),
  brand_asset_id: z
    .string()
    .optional()
    .describe('The funnel piece (brand_asset) this video is for, to wire the split-test.'),
};

export function registerGenerateVideoStoryboardTool(server: McpServer): void {
  server.registerTool(
    'generate_video_storyboard',
    {
      title: 'Generate video storyboard plan (Higgsfield-ready)',
      description:
        'Generate a positioning-aligned, scene-by-scene VIDEO STORYBOARD plan — Amazon listing video, social short, or brand-story film — grounded in the Decision Trigger, Avatar 2.0, the Signature, and the Trust Gap. Returns the scene architecture + per-scene direction (shot, motion, overlay/VO rules, IDEA pillar) + TWO Higgsfield execution modes: storyboard-image mode (the fast default — build the reference kit from the real product photo, compose ONE multi-panel storyboard image with embedded beat captions, run ONE generate_video job with it as reference for a full multi-shot film) and per-scene mode (precision image-to-video, one job per scene) — plus VIDEO_PROMPT construction with the exact negative prompt, marketing-studio preset routing for UGC/unboxing/high-motion ads (persona matched to the customer avatar), and audio direction (diegetic-only, no generated text). You (the coach) compose the briefs and ready-to-paste prompts. Built for easy adjustment: fix one storyboard panel via image edit or re-render one scene — never regenerate the set; aspect/resolution/voice changes route to Higgsfield edit tools. Works with partial context — missing positioning inputs degrade honestly and the plan names the one input that sharpens it. Amazon channel rules baked in (no price/promo/off-Amazon CTA; sound-off first). Generates storyboard plans only, never video, never invented claims.' +
        groundingPreamble('generate_video_storyboard') +
        appGroundingPreamble('generate_video_storyboard'),
      inputSchema,
    },
    async ({
      product,
      format,
      decision_trigger,
      avatar_summary,
      signature,
      trust_gap_summary,
      verified_facts,
      duration_seconds,
      marketplace,
      brand_asset_id,
    }) => {
      const result = buildVideoStoryboard({
        product,
        format,
        decisionTrigger: decision_trigger,
        avatarSummary: avatar_summary,
        signature,
        trustGapSummary: trust_gap_summary,
        verifiedFacts: verified_facts,
        durationSeconds: duration_seconds,
        marketplace,
        brandAssetId: brand_asset_id,
      });
      safeLog({
        event: 'tool.generate_video_storyboard',
        caller: userTag(getIdentity()),
        format: result.format.key,
        decision_trigger: result.decision_trigger,
        scenes: result.scenes.length,
      });
      return {
        content: [{ type: 'text' as const, text: `${result.summary}\n\n${JSON.stringify(result, null, 2)}` }],
        structuredContent: { ...result },
      };
    },
  );
}
