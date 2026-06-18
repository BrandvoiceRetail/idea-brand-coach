/**
 * Anthropic tool definitions for the MCP-backed tools the chat may call
 * (ADR Phase 2). These mirror the MCP host's tool surface; the model sees them
 * as ordinary tools and the loop dispatches them through registry.ts → mcpClient.
 *
 * Surface: the read tools (get_context_status, list_assets, run_trust_gap) plus the
 * generative/diagnostic/workbook + recall tools wired in the chat-tool-expansion slice
 * (generate_concepts, draft_asset, design_test, build_avatar_stage, run_diagnostic_evidence,
 * publish_filter_check, generate_canvas/brief/audit_idea_map, run_marketing_audit,
 * ingest_evidence, list/get_coach_conversation). The IV-OS asset-LEDGER tools
 * (get_asset/get_asset_history/log_asset/update_asset_status/record_assessment) are
 * intentionally NOT wired here — they degrade to available:false until IVOS_MCP_URL is set.
 * Descriptions carry the do-not-invent-inputs posture; only the four skillLoader-mapped
 * tools (run_trust_gap, run_diagnostic_evidence, build_avatar_stage, generate_concepts)
 * cite IDEA-book grounding — the rest are KB-grounded or deterministic.
 */

export interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const MCP_TOOL_DEFS: AnthropicToolDef[] = [
  {
    name: 'get_context_status',
    description:
      'Report what brand context the coach already has for this user (avatar fields, product/listing data, latest diagnostic) and what is still missing. Call this before running a diagnostic or generating anything, to decide what to ask for next. Read-only.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'list_assets',
    description:
      "List the user's logged brand assets from their own asset ledger (concepts, drafts, copy, tests) with their status. Read-only; use it to ground the conversation in what already exists rather than asking the user to re-state it.",
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Optional status filter (e.g. draft, approved).' },
        content_type: { type: 'string', description: 'Optional content-type filter.' },
      },
    },
  },
  {
    name: 'run_trust_gap',
    description:
      "Run the Trust Gap diagnostic across the four IDEA trust pillars (Insight-Driven, Distinctive, Empathetic, Authentic) and return the per-pillar read plus the primary gap. Grounded in the IDEA framework (book skill: framework/00-foundations/02-idea-framework) — apply that framework's definitions and do not invent guidance beyond it. Only call this once the user has shared real brand context; never invent the pillar inputs.",
    input_schema: {
      type: 'object',
      properties: {
        scores: {
          type: 'object',
          description:
            'The four IDEA pillar scores (each 0-25), keys: insight, distinctive, empathetic, authentic. Only pass values the user actually provided.',
        },
      },
    },
  },
  {
    name: "generate_concepts",
    description:
      "Generate N on-brand marketing concept candidates from a brief, composed through the existing brand-coach consultant engine. Call this once the user has shared a real brief (product, audience, objective) \u2014 never before they have given you genuine context. Generative, but does NOT persist anything (no asset is recorded; log_asset writes are deferred by capability). Grounded in the IDEA framework book \"What Captures the Heart Goes in the Cart\" (brand-voice + authentically-human sections); apply that source material and do not invent guidance beyond it. POSTURE: only call with inputs the user explicitly provided \u2014 do not infer, default, or invent the brief or channel. If the brief is missing or too thin, ASK the user for it; never fabricate it to avoid stalling.",
    input_schema: {
      "type": "object",
      "properties": {
        "brief": {
          "type": "string",
          "description": "What the concepts are for: product, audience, objective. Use only what the user actually told you (min 10 chars); ask if it's missing rather than inventing it."
        },
        "channel": {
          "type": "string",
          "description": "Optional target channel (e.g. amazon_listing, instagram, email). Only pass a channel the user specified."
        },
        "count": {
          "type": "integer",
          "minimum": 1,
          "maximum": 10,
          "description": "Optional number of concepts to produce (1-10, defaults to 3)."
        }
      },
      "required": [
        "brief"
      ]
    },
  },
  {
    name: "draft_asset",
    description:
      "Draft emotionally resonant brand copy (e.g. Amazon bullets, a product description, a social post) for one product via the brand-copy-generator engine, wrapped verbatim for output parity and grounded server-side in the caller's knowledge base. Generative + persists: on success the copy is auto-recorded into the IV-OS asset ledger (set record:false to skip); a degraded write never fails the draft. POSTURE: only call this once the user has explicitly provided the product name, category, features, target audience, emotional payoff, tone, and format \u2014 never infer, default, or invent these inputs; if any are missing, ask the user for them first.",
    input_schema: {
      "type": "object",
      "properties": {
        "productName": {
          "type": "string",
          "description": "The product the copy is for. Pass only what the user provided; do not invent it."
        },
        "category": {
          "type": "string",
          "description": "The product category. Pass only what the user provided."
        },
        "features": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "The product's features (at least one). Pass only features the user actually stated."
        },
        "targetAudience": {
          "type": "string",
          "description": "Who the copy is for. Pass only what the user provided."
        },
        "emotionalPayoff": {
          "type": "string",
          "description": "The emotional payoff the copy should land. Pass only what the user provided."
        },
        "tone": {
          "type": "string",
          "description": "The desired tone/voice. Pass only what the user provided."
        },
        "format": {
          "type": "string",
          "description": "Copy format, e.g. amazon_bullets, product_description, social_post. Pass only what the user provided."
        },
        "additionalContext": {
          "type": "string",
          "description": "Optional extra context for the draft."
        },
        "record": {
          "type": "boolean",
          "description": "Auto-record the produced copy into the IV-OS asset ledger (log_asset). Defaults to true; set false to draft without persisting."
        },
        "campaign_id": {
          "type": "string",
          "description": "Optional campaign to attribute the recorded asset to."
        }
      },
      "required": [
        "productName",
        "category",
        "features",
        "targetAudience",
        "emotionalPayoff",
        "tone",
        "format"
      ]
    },
  },
  {
    name: "design_test",
    description:
      "Compose drafted message/copy alternates into an A/B test spec: hypothesis, lettered variants with traffic split, a channel-appropriate primary metric, minimum sample per variant and a stopping rule. This is the final link in the owned asset chain (concept \u2192 publish-filter \u2192 draft \u2192 test). Generative \u2014 it produces a test design and (in chat) does not persist; auto-recording into the IV-OS test ledger is deferred, so log produced assets via log_asset meanwhile. Only call this with variants and inputs the user explicitly provided \u2014 never invent, default, or infer the variant content, test name, hypothesis, metric, or channel; if you are missing the two or more variants to test, ASK the user for them rather than fabricating.",
    input_schema: {
      "type": "object",
      "properties": {
        "name": {
          "type": "string",
          "description": "Name for the test (e.g. the asset or campaign being tested). Required; only use a name the user provided or agreed to."
        },
        "variants": {
          "type": "array",
          "description": "The 2-6 message/copy variants to test head-to-head. Only include variant content the user actually drafted or provided \u2014 never invent variants.",
          "minItems": 2,
          "maxItems": 6,
          "items": {
            "type": "object",
            "properties": {
              "label": {
                "type": "string",
                "description": "Optional human-readable label for this variant (defaults to Variant A/B/C\u2026)."
              },
              "content": {
                "type": "string",
                "description": "The variant's copy/message content. Required, non-empty."
              }
            },
            "required": [
              "content"
            ]
          }
        },
        "hypothesis": {
          "type": "string",
          "description": "Optional explicit hypothesis the user stated. Omit if not provided rather than inventing one (a default is derived)."
        },
        "primary_metric": {
          "type": "string",
          "description": "Optional primary metric the user specified (e.g. conversion_rate, click_through_rate). Omit if not provided; one is inferred from the channel."
        },
        "channel": {
          "type": "string",
          "description": "Optional channel/surface the test runs on (e.g. amazon listing, email, social ads). Used only to pick a default metric; omit if the user didn't say."
        }
      },
      "required": [
        "name",
        "variants"
      ]
    },
  },
  {
    name: "build_avatar_stage",
    description:
      "Run one Avatar 2.0 forensic stage (s1 vocabulary, s2 job map, s3 triggers, s4 objections) or the full s1\u2192s5 pipeline against the user's resolved customer reviews, and persist the result as an artifact. Call this once the user has shared real review/customer evidence and wants their avatar built out; it WRITES (persists an RLS-scoped artifact per stage) and requires an authenticated Supabase caller. Grounded in the IDEA framework book \"What Captures the Heart Goes in the Cart\" \u2014 Avatar 2.0 forensic method (book skill: framework/01-customer/00-avatar-2.0); apply that method's stage definitions and do not invent guidance beyond it. Generative/forensic: only call with inputs the user explicitly provided (their reviews/avatar scope); never infer, default, or fabricate the inputs \u2014 if the reviews context is missing it returns needs_input, so ask the user for it rather than guessing. The s5 Signature auto-feed is operator-gated: leave allow_signature false unless the user has explicitly signed off that the review vocabulary is the customer's words, not the founder's.",
    input_schema: {
      "type": "object",
      "properties": {
        "stage": {
          "type": "string",
          "enum": [
            "s1",
            "s2",
            "s3",
            "s4",
            "pipeline"
          ],
          "description": "Which to run: a single forensic stage 's1' (vocabulary), 's2' (job map), 's3' (triggers), 's4' (objections), or 'pipeline' for the full S1\u2192S5 chain. Only pass what the user asked for."
        },
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for the brand-level chain. Only pass an id the user provided."
        },
        "allow_signature": {
          "type": "boolean",
          "description": "D2/R-015 operator sign-off (defaults false). Only set true when the user has explicitly confirmed the review vocabulary is the customer's own words; only then does the pipeline auto-feed evidence into the S5 Signature engine."
        }
      },
      "required": [
        "stage"
      ]
    },
  },
  {
    name: "run_diagnostic_evidence",
    description:
      "Run the evidence-grounded Trust Gap diagnostic across the four IDEA trust pillars (Insight-Driven, Distinctive, Empathetic, Authentic): interpret the user's pillar scores against their listing copy and reviews, citing real evidence where it exists and flagging dimensions with no evidence as inference. Writes/persists \u2014 it saves a diagnostic_interpretation artifact RLS-scoped to the caller (requires an authenticated Supabase JWT). Use it (over the read-only run_trust_gap) once the user has actually taken the Trust Gap intake and you want the evidence-backed read. Grounded in the IDEA framework (book skill: framework/00-foundations/02-idea-framework) \u2014 apply that framework's definitions and do not invent guidance beyond it. Only call this with score values the user explicitly provided; never infer, default, or invent the pillar scores. If the scores are missing, ask the user \u2014 do not fabricate them.",
    input_schema: {
      "type": "object",
      "properties": {
        "scores": {
          "type": "object",
          "description": "The four IDEA pillar Trust Gap scores (each 0-25), keys: insight, distinctive, empathetic, authentic. Only pass values the user actually provided; never infer or default them.",
          "properties": {
            "insight": {
              "type": "number",
              "minimum": 0,
              "maximum": 25,
              "description": "Insight-Driven pillar score (0-25)."
            },
            "distinctive": {
              "type": "number",
              "minimum": 0,
              "maximum": 25,
              "description": "Distinctive pillar score (0-25)."
            },
            "empathetic": {
              "type": "number",
              "minimum": 0,
              "maximum": 25,
              "description": "Empathetic pillar score (0-25)."
            },
            "authentic": {
              "type": "number",
              "minimum": 0,
              "maximum": 25,
              "description": "Authentic pillar score (0-25)."
            }
          },
          "required": [
            "insight",
            "distinctive",
            "empathetic",
            "authentic"
          ]
        },
        "overall": {
          "type": "number",
          "minimum": 0,
          "maximum": 100,
          "description": "Optional overall score out of 100; derived from the four pillar scores if omitted."
        },
        "primary_gap": {
          "type": "string",
          "enum": [
            "insight",
            "distinctive",
            "empathetic",
            "authentic"
          ],
          "description": "Optional weakest pillar; derived from the scores if omitted."
        },
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for the brand-level chain."
        }
      },
      "required": [
        "scores"
      ]
    },
  },
  {
    name: "publish_filter_check",
    description:
      "Grade a drafted brand asset/copy against the deterministic brand publish filter (claims needing substantiation, medical/therapeutic claims, environmental claims, false urgency, all-caps shouting, and per-channel length caps) and return a verdict (pass | warn | fail) with a per-violation fix hint. Call this when the user wants a piece of copy checked for brand-safety/compliance before publishing. The check itself is read-only, BUT supplying `request_id` (with `record` left on) auto-records the verdict into the IV-OS asset ledger \u2014 that write requires an authenticated caller and is skipped/annotated otherwise. Only call with content the user actually provided; never invent, infer, or paraphrase the copy to be graded \u2014 if the content is missing, ask the user for it.",
    input_schema: {
      "type": "object",
      "properties": {
        "content": {
          "type": "string",
          "description": "The drafted asset/copy to grade (the exact text the user provided). Required."
        },
        "channel": {
          "type": "string",
          "description": "Optional channel for length rules (e.g. x, twitter, amazon_bullet, email_subject, instagram_caption)."
        },
        "request_id": {
          "type": "string",
          "description": "Optional IV-OS ledger request_id of the asset being graded \u2014 supply only when the user wants the assessment recorded against a logged asset (triggers an identity-gated write)."
        },
        "record": {
          "type": "boolean",
          "description": "Whether to record the assessment into the IV-OS ledger when request_id is given. Defaults to true; set false to opt out of the write."
        }
      },
      "required": [
        "content"
      ]
    },
  },
  {
    name: "generate_canvas",
    description:
      "Write tool: compile the Brand Canvas (gold Workbook A sheet 5) from the user's persisted artifact chain \u2014 the chosen Signature + the Avatar 2.0 S1-S4 forensic artifacts + the owner-intent slots (positioning, voice, target-customer beliefs) \u2014 by invoking the brand-canvas engine verbatim, validating the reply against the brand_canvas contract, and PERSISTING it as a brand_canvas artifact (RLS-scoped; requires an authenticated Supabase JWT). Call this only after the user has run the Avatar chain through S5 and persisted a chosen Signature; it takes no content inputs from you and reads everything from the persisted chain, so never fabricate, infer, or hand-author canvas fields. Returns needs_input (never runs ungrounded) when no chosen Signature exists \u2014 relay that ask to the user rather than guessing. Takes only an optional avatar_id to scope which chain to read; omit it for the brand-level chain.",
    input_schema: {
      "type": "object",
      "properties": {
        "avatar_id": {
          "type": "string",
          "description": "Avatar scope; omit for the brand-level chain. Only pass an avatar_id the user actually selected \u2014 do not invent one."
        }
      }
    },
  },
  {
    name: "generate_brief",
    description:
      "Write tool (PERSISTS an artifact): compile the Export Brief \u2014 title formula, 5 bullets, 7-slot image brief, and PPC tiers \u2014 from the user's persisted Brand Canvas, Avatar S1/S3/S4 work, and confirmed product-claims. It draws solely on persisted, user-provided context and takes no brand inputs from you \u2014 never infer or fabricate canvas, voice, or product-claim values to make it run. Only call this once the user has actually built their Brand Canvas and confirmed their product facts/policies. If the canvas is missing or the product-claims slot is not owner-confirmed, the tool returns needs_input asking the user for what's missing \u2014 relay that and ask; never hand-compute around it. A deterministic claim gate then re-scans the produced copy and BLOCKS persistence on any product/policy claim (capacity, compatibility, guarantee) the user has not confirmed, surfacing each as a per-claim confirmation question. Requires an authenticated Supabase JWT.",
    input_schema: {
      "type": "object",
      "properties": {
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for the brand-level chain. Only pass an avatar id the user is actually working in."
        }
      }
    },
  },
  {
    name: "generate_audit_idea_map",
    description:
      "Generate the Audit \u00d7 IDEA map (gold sheet 7): for each marketing-audit investment move, the without-IDEA baseline, the with-IDEA upgrade, and a LABELED lift-multiplier band. WRITE/PERSISTS: it synthesises over the user's already-persisted Brand Canvas + Export Brief (+ optional Marketing Audit rows), is evidence-grounded on that artifact chain (it cites the upstream canvas/brief as evidence refs), validates against the audit_x_idea contract, and saves an RLS-scoped artifact; requires an authenticated Supabase caller. Only call this once the user has genuinely worked through and built those upstream artifacts \u2014 never to fabricate a result; it does not take brand inputs as arguments (it resolves them server-side) and returns needs_input (never runs ungrounded) when the canvas/brief chain is incomplete. Lift figures are labeled estimate bands, never precise fabrications. Pass avatar_id only when the user is scoping to a specific avatar; omit it for the brand-level chain.",
    input_schema: {
      "type": "object",
      "properties": {
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for the brand-level chain. Only pass an avatar_id the user actually selected \u2014 never invent one."
        }
      }
    },
  },
  {
    name: "run_marketing_audit",
    description:
      "Write/persist tool: produce the marketing investment audit (gold Workbook B \u2014 a tiered Investment Matrix + 90-day rollout/phasing). Heavyweight; call ONLY on the user's explicit request to run the audit, not speculatively. It binds identity, then resolves the user's BUSINESS-FACT slots from the knowledge base server-side (revenue/margins/ad metrics [required], brand-asset states, channel states, inventory risk, cash timing, competitor set, product catalog) \u2014 you do NOT pass these as inputs. It NEVER invents numbers: if revenue is missing or stale it returns needs_input listing what to ask for, so do not fabricate or hand-compute figures to avoid stalling \u2014 surface the questions to the user. The matrix is calibrated deterministically from the marketing-move library (tiering, cash/effort, 1/3/6/12-month benefit bands at the user's revenue, cumulative-impact grid); the model only enriches prose, never the numbers. Grounded in the deterministic marketing-move library and the user's owner-stated business facts (grounding=evidence). Persists to marketing_audits plus marketing_audit + rollout_plan artifacts (RLS-scoped); requires an authenticated Supabase caller (anonymous is refused). The only argument is the optional avatar_id scope.",
    input_schema: {
      "type": "object",
      "properties": {
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for the brand-level chain. Only pass an avatar_id the user/context actually identifies \u2014 do not invent one."
        }
      }
    },
  },
  {
    name: "ingest_evidence",
    description:
      "Write tool: ingest real third-party EVIDENCE so the coach can quote it verbatim instead of inventing it. Pasted reviews are chunked into review objects and persisted as an evidence_snapshots row (and, when product_id is supplied, also written to user_product_reviews); pasted listing copy is frozen as that snapshot's listing. asin-scrape is NOT yet wired \u2014 it returns a clearly-marked stub note (no fabrication). Persists to the KB; requires an authenticated Supabase caller and is RLS-scoped to that user. Call this ONLY with evidence the user explicitly provided \u2014 paste at least one of reviews_text, listing_text, or asin; never infer, default, or invent the content, and if the user hasn't shared any evidence yet, ask them for it rather than fabricating.",
    input_schema: {
      "type": "object",
      "properties": {
        "reviews_text": {
          "type": "string",
          "description": "Pasted reviews verbatim (blank-line- or line-separated), exactly as the user supplied them. Chunked into review objects. Supply at least one of reviews_text, listing_text, or asin."
        },
        "listing_text": {
          "type": "string",
          "description": "Pasted listing copy (title/bullets/A+/description) exactly as the user supplied it. Frozen as the snapshot listing."
        },
        "asin": {
          "type": "string",
          "description": "Amazon ASIN the user gave. NOT YET WIRED \u2014 returns a stub note (no fabrication); prefer pasting the /dp/ listing + reviews via reviews_text/listing_text."
        },
        "source_label": {
          "type": "string",
          "description": "Optional human label for provenance (e.g. \"InfinityVault /dp/ paste 2026-06\"). Stored on the snapshot source."
        },
        "product_id": {
          "type": "string",
          "description": "Optional own-product id; when set, parsed reviews are ALSO written to user_product_reviews (the richer own-evidence store)."
        },
        "avatar_id": {
          "type": "string",
          "description": "Optional avatar scope; omit for a brand-level snapshot."
        }
      }
    },
  },
  {
    name: "list_coach_conversations",
    description:
      "Read tool: list the authenticated caller's own Brand-Coach chat threads (newest-active first), each annotated with its avatar (avatar_id + avatar_name; null = brand-level), conversation_type, field context, turn count, and timestamps. Pass avatar_id to scope to one avatar; omit to list every thread (each carries its own avatar_id so you can group per avatar). RLS-scoped to the caller; requires a Supabase bearer token. Use it to ground the conversation in what the user has already discussed instead of asking them to re-state it. Use get_coach_conversation for a thread's full transcript.",
    input_schema: {
      "type": "object",
      "properties": {
        "avatar_id": {
          "type": "string",
          "description": "Optional. Filter to one avatar's threads. Omit to list every coach thread (each carries its own avatar_id)."
        }
      }
    },
  },
  {
    name: "get_coach_conversation",
    description:
      "Read tool: fetch one of the user's past Brand-Coach chat threads by session_id and return its full transcript (each turn's role + content, oldest first) plus the thread's avatar scope (avatar_id + avatar_name; null = brand-level). Companion to list_coach_conversations \u2014 call that first to find a session_id, then call this to read the thread. Use it to ground the conversation in what was discussed before instead of asking the user to repeat themselves. Read-only and RLS-scoped to the caller (requires a Supabase bearer token); returns not found when the thread is not the caller's or does not exist.",
    input_schema: {
      "type": "object",
      "properties": {
        "session_id": {
          "type": "string",
          "description": "The conversation/session id to read (from list_coach_conversations)."
        }
      },
      "required": [
        "session_id"
      ]
    },
  },
  {
    name: 'get_asset',
    description:
      "Fetch one logged marketing asset by its request_id from the user's own asset ledger (content, type, status, approval status). Read-only. Only call with a request_id the user gave you or that came from list_assets — never invent one.",
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The asset request_id (e.g. from list_assets).' },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'get_asset_history',
    description:
      "Return one asset's append-only change log by request_id — logged → status changes → assessments, each with actor and timestamp. Read-only; use it to ground the conversation in what has already happened to an asset.",
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The asset request_id.' },
      },
      required: ['request_id'],
    },
  },
  {
    name: 'log_asset',
    description:
      "Record a marketing asset the user has produced or pasted into their own asset ledger; returns the new request_id. WRITES — only call with content the user actually provided; never invent the asset. Pass external_id (a stable key from the user's source) to make re-logging idempotent (reconciles instead of duplicating).",
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The asset body (copy/script/listing text). Use only what the user gave you.' },
        content_type: { type: 'string', description: 'blog | social | amazon | competitor | other' },
        status: { type: 'string', description: 'Optional production status: success | partial | failed | pending.' },
        campaign_id: { type: 'string', description: 'Optional campaign to attribute the asset to.' },
        external_id: { type: 'string', description: 'Optional idempotency/dedup key — re-logging the same external_id reconciles to the existing asset.' },
      },
      required: ['content', 'content_type'],
    },
  },
  {
    name: 'update_asset_status',
    description:
      "Move a logged asset through its approval lifecycle (draft → in_review → approved/rejected) by request_id; the transition is recorded in the asset's change log. WRITES — only call when the user explicitly asks to change an asset's status.",
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The asset request_id.' },
        approval_status: { type: 'string', description: 'draft | in_review | approved | rejected' },
        notes: { type: 'string', description: 'Optional note on the transition.' },
      },
      required: ['request_id', 'approval_status'],
    },
  },
  {
    name: 'record_assessment',
    description:
      "Record a brand/quality assessment of a logged asset (verdict + optional scores/summary/recommendations) in its change log, by request_id. Advisory — does NOT change the approval status. WRITES — only record a verdict you have actually reasoned to from the user's asset and context.",
    input_schema: {
      type: 'object',
      properties: {
        request_id: { type: 'string', description: 'The asset request_id.' },
        verdict: { type: 'string', description: 'pass | needs_work | fail' },
        summary: { type: 'string', description: 'Optional one-line rationale.' },
        scores: { type: 'object', description: 'Optional dimension→score map, e.g. {"distinctive": 18}.' },
        recommendations: { type: 'string', description: 'Optional concrete fixes.' },
      },
      required: ['request_id', 'verdict'],
    },
  },
];

/** Names of the MCP-backed tools (the registry registers a continue-entry per name). */
export const MCP_TOOL_NAMES: string[] = MCP_TOOL_DEFS.map((t) => t.name);
