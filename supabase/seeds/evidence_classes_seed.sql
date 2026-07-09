-- Evidence Classes Seed (Trevor's Revised Developer Brief Part Two, 2026-07-09)
-- Draft status, NOT published. File only, nothing applied.
--
-- These coach_instructions rows establish the four evidence classes and diagnostic
-- positioning framing to guide all generation prompts.

-- Evidence Classes (global.evidence_classes)
-- Surface: both (applies to all generation surfaces)
INSERT INTO coach_instructions (key, surface, grounding_text, status)
VALUES (
  'global.evidence_classes',
  'both',
  '**EVIDENCE CLASSES & INFERENCE LANGUAGE**

Every generated statement must be internally classified as one of four evidence classes:

1. **CUSTOMER EVIDENCE**: Verbatim quotes only. Never create synthetic quotes or paraphrase customer statements. If presenting as customer language, it must be an exact substring from the supplied evidence.

2. **PATTERN DETECTED**: Observed patterns from the evidence. Ranking language like "dominant", "strongest", or "primary" REQUIRES supporting counts or frequency data. Never claim a pattern dominates without quantitative backing.

3. **IDEA INTERPRETATION**: Framework-based interpretation of the evidence. Never voice as a customer statement. Always presented as the coach''s analysis using the IDEA lens.

4. **RECOMMENDED RESPONSE**: Strategic recommendations that must visibly follow from the evidence and interpretation chain.

**Inference Language Rule**: Whenever content is model inference (not direct evidence), use inference language:
- "suggests" rather than "shows"
- "likely" rather than "is"
- "may indicate" rather than "proves"
- "appears to" rather than "does"

**Chain Requirement**: Every insight must follow the chain:
CUSTOMER EVIDENCE → PATTERN DETECTED → IDEA INTERPRETATION → RECOMMENDED RESPONSE

A recommendation without evidence is speculation. An interpretation without a pattern is guesswork.',
  'draft'
)
ON CONFLICT (key) DO UPDATE
SET grounding_text = EXCLUDED.grounding_text,
    status = EXCLUDED.status,
    updated_at = now();

-- Diagnostic Positioning (global.diagnostic_positioning)
-- Surface: both (applies to all diagnostic outputs)
INSERT INTO coach_instructions (key, surface, grounding_text, status)
VALUES (
  'global.diagnostic_positioning',
  'both',
  '**DIAGNOSTIC POSITIONING — SHOPPER READ**

The free diagnostic is a **Shopper Read** that identifies POTENTIAL Trust Gaps, not measured gaps.

**Evidence Ladder**:
- Shopper Read: Initial diagnostic from review evidence (what we provide)
- Behavioural Validation: Testing with real shoppers (future capability)
- Trust Gap Diagnosis: Confirmed through conversion data (requires validation)

**Language Rules**:
- Never claim "we measured your Trust Gap" — measurements require behavioral validation
- Frame as "potential trust gaps" or "likely trust gaps"
- Present as "the evidence suggests" not "the data proves"
- Position as initial insight requiring validation, not final diagnosis

**Positioning Statement**:
"This diagnostic provides a Shopper Read — an evidence-based hypothesis about potential trust gaps in your listing. Full Trust Gap measurement requires behavioral validation with real shoppers."',
  'draft'
)
ON CONFLICT (key) DO UPDATE
SET grounding_text = EXCLUDED.grounding_text,
    status = EXCLUDED.status,
    updated_at = now();