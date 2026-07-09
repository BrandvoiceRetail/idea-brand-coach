#!/usr/bin/env node
/**
 * validate-content.mjs — deterministic quality gates for the marketing content
 * programs (content/blog, content/storyboards, content/emails).
 * Exits non-zero with a violation report; used before deploying content.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const warn = [];

const TOOLS = new Set([
  'run_trust_gap','assess_idea_dimensions','identify_decision_trigger','compute_trust_gap_lift',
  'run_diagnostic_evidence','build_avatar_stage','create_avatar','update_avatar','delete_avatar',
  'list_avatars','get_avatar','set_current_avatar','set_context_avatars','set_primary_avatar',
  'record_avatar_build','ingest_evidence','bulk_ingest_evidence','get_ingest_job',
  'upsert_funnel_touchpoint','list_funnel_inventory','get_funnel_coverage','run_funnel_audit',
  'audit_asset','get_funnel_piece_metrics','ingest_funnel_analytics','get_funnel_audit','get_funnel_assets',
  'generate_listing_image_brief','generate_listing_image','generate_main_image_title_plan',
  'generate_aplus_content_plan','generate_storefront_messaging_plan','generate_video_storyboard',
  'generate_ugc_ad_plan','refine_creative_plan','generate_brief','generate_signature',
  'generate_positioning_moves','generate_concepts','generate_canvas','design_test','publish_filter_check',
  'create_campaign','list_campaigns','update_campaign_status','get_campaign_metrics',
  'ingest_content_performance','ingest_campaign_analytics','get_experiment_lift',
  'create_email_sequence','add_email_step','get_sequence_template','list_sequences','get_sequence_performance',
  'run_marketing_audit','generate_audit_idea_map','record_assessment','log_asset','get_asset',
  'get_asset_history','list_assets','update_asset_status','update_test_milestone','remember','recall',
  'provide_context','get_context_status','submit_feedback','export_workbook','export_messaging_workbook',
  'run_onboarding','onboard_status','onboard_choose','onboard_panel','compute_trust_gap_lift','health',
  // Higgsfield execution vocabulary (host-side)
  'generate_image','generate_video','upscale_image','upscale_video','outpaint_image','reframe',
  'remove_background','motion_control','generate_audio',
]);

const FUNNEL = new Set([
  'paid_social_creative','organic_social_profile','influencer_ugc','amazon_main_image','seo_content',
  'founder_social','amazon_listing_copy','amazon_brand_story','shopify_pdp','brand_store_about',
  'displayed_reviews','founder_content','cart_checkout_flow','shipping_returns_policy',
  'trust_badges_social_proof','urgency_messaging','order_confirmation_email','shipping_email',
  'packaging_unboxing','insert_cards','welcome_series','winback_replenishment','support_voice',
  'review_request_flow','referral_program','ugc_repost_permissions','loyalty_community',
]);

function parseFm(raw, file) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) { problems.push(`${file}: missing/unparseable frontmatter`); return null; }
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) { problems.push(`${file}: bad frontmatter line: ${line}`); continue; }
    meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return { meta, body: m[2] };
}

const words = (s) => s.split(/\s+/).filter(Boolean).length;

function checkToolMentions(body, file) {
  // any backticked snake_case token that looks like a tool must be in TOOLS
  for (const m of body.matchAll(/`([a-z][a-z0-9]*(?:_[a-z0-9]+)+)`/g)) {
    const t = m[1];
    if (!TOOLS.has(t) && !FUNNEL.has(t)) {
      // frontmatter-ish tokens and metric names are fine unless they read as tools
      if (/^(get|run|generate|create|update|list|ingest|compute|export|set|build|refine|assess|identify|upsert|record|design|publish|audit|add|delete|remember|recall|provide|submit|log|onboard)_/.test(t)) {
        problems.push(`${file}: unknown tool \`${t}\``);
      }
    }
  }
}

function listDir(rel) {
  const dir = path.join(ROOT, rel);
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => [rel + '/' + f, fs.readFileSync(path.join(dir, f), 'utf8')]) : [];
}

/* ── blog ── */
const blogSlugs = new Set();
const blog = listDir('content/blog');
for (const [file, raw] of blog) {
  const p = parseFm(raw, file); if (!p) continue;
  const { meta, body } = p;
  for (const k of ['title','description','date','category','funnel','tools','keywords','slug'])
    if (!meta[k]) problems.push(`${file}: missing frontmatter "${k}"`);
  if (meta.slug) blogSlugs.add(meta.slug);
  if (meta.funnel && !FUNNEL.has(meta.funnel)) problems.push(`${file}: bad funnel "${meta.funnel}"`);
  if (meta.title && meta.title.length > 70) warn.push(`${file}: title ${meta.title.length} chars`);
  if (meta.description && (meta.description.length < 120 || meta.description.length > 175)) warn.push(`${file}: description ${meta.description.length} chars`);
  (meta.tools || '').split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => { if (!TOOLS.has(t)) problems.push(`${file}: frontmatter tool "${t}" not real`); });
  const n = words(body);
  if (n < 780 || n > 1700) warn.push(`${file}: body ${n} words (target 900-1400)`);
  if (/<\/?(table|img|div|span|script)\b/i.test(body)) problems.push(`${file}: raw HTML in body`);
  checkToolMentions(body, file);
}
// internal links resolve
for (const [file, raw] of blog) {
  for (const m of raw.matchAll(/\]\(\/blog\/([a-z0-9-]+)\/?\)/g)) {
    if (!blogSlugs.has(m[1])) problems.push(`${file}: broken internal link /blog/${m[1]}/`);
  }
}

/* ── storyboards ── */
const SB_FMT = new Set(['ugc_review','ugc_tryon','ugc_unboxing','problem_solution','founder_story','product_demo']);
for (const [file, raw] of listDir('content/storyboards')) {
  const p = parseFm(raw, file); if (!p) continue;
  const { meta, body } = p;
  for (const k of ['title','pain','funnel','tool','format','duration','aspect','persona'])
    if (!meta[k]) problems.push(`${file}: missing frontmatter "${k}"`);
  if (meta.pain && !['ctr','cvr','connection'].includes(meta.pain)) problems.push(`${file}: bad pain "${meta.pain}"`);
  if (meta.funnel && !FUNNEL.has(meta.funnel)) problems.push(`${file}: bad funnel "${meta.funnel}"`);
  if (meta.tool && !TOOLS.has(meta.tool)) problems.push(`${file}: featured tool "${meta.tool}" not real`);
  if (meta.format && !SB_FMT.has(meta.format)) problems.push(`${file}: bad format "${meta.format}"`);
  for (const h of ['## Strategy','## Hook variants','## Scene-by-scene','## Production notes (Higgsfield)','## CTA & measurement'])
    if (!body.includes(h)) problems.push(`${file}: missing section "${h}"`);
  const scenes = [...body.matchAll(/^\d+\.\s*\[/gm)].length;
  const want = meta.duration === '30s' ? [6, 8] : [4, 5];
  if (scenes < want[0] || scenes > want[1]) warn.push(`${file}: ${scenes} scenes for ${meta.duration}`);
  const sceneLines = [...body.matchAll(/^\d+\.\s*\[[^\]]*\][^\n]*$/gm)].map((m) => m[0]);
  for (const line of sceneLines) {
    if (!/VISUAL:/.test(line) || !/VO:/.test(line) || !/TEXT ON SCREEN:/.test(line))
      problems.push(`${file}: scene line missing VISUAL/VO/TEXT ON SCREEN: ${line.slice(0, 60)}…`);
  }
  checkToolMentions(body, file);
}

/* ── emails ── */
const seenWeekSend = new Set();
for (const [file, raw] of listDir('content/emails')) {
  const p = parseFm(raw, file); if (!p) continue;
  const { meta, body } = p;
  for (const k of ['subject','preview','week','send','theme','funnel','tools'])
    if (!meta[k]) problems.push(`${file}: missing frontmatter "${k}"`);
  if (meta.subject && meta.subject.length > 60) warn.push(`${file}: subject ${meta.subject.length} chars`);
  if (meta.funnel && !FUNNEL.has(meta.funnel)) problems.push(`${file}: bad funnel "${meta.funnel}"`);
  (meta.tools || '').split(',').map((t) => t.trim()).filter(Boolean).forEach((t) => { if (!TOOLS.has(t)) problems.push(`${file}: frontmatter tool "${t}" not real`); });
  const ws = `${meta.week}-${meta.send}`;
  if (seenWeekSend.has(ws)) problems.push(`${file}: duplicate week/send ${ws}`);
  seenWeekSend.add(ws);
  const n = words(body);
  if (n < 200 || n > 560) warn.push(`${file}: body ${n} words (target 250-450)`);
  const ctas = [...body.matchAll(/https:\/\/ideabrandcoach\.com\/[^\s)]*/g)].length;
  if (ctas === 0) problems.push(`${file}: no CTA link`);
  if (!/— The IDEA Brand Coach team/.test(body)) warn.push(`${file}: missing sign-off`);
  checkToolMentions(body, file);
}

const counts = {
  blog: blog.length,
  storyboards: listDir('content/storyboards').length,
  emails: listDir('content/emails').length,
};
console.log(`counts: ${JSON.stringify(counts)}`);
console.log(`problems: ${problems.length}, warnings: ${warn.length}`);
for (const p of problems) console.log(`  ERROR ${p}`);
for (const w of warn) console.log(`  warn  ${w}`);
process.exit(problems.length ? 1 : 0);
