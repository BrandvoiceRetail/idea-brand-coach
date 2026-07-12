/**
 * Deterministic backstop for Trevor's Skill-02 no-dash red-line.
 *
 * The prompt rule ("never use em dashes") steers the model but does NOT guarantee it — live
 * verification showed the coach still slips an em dash roughly one reply in three, and Trevor
 * flagged the same "AI give-away" in prod. Prompt instructions are a strong suggestion, not a
 * guarantee; this is the guarantee. Every user-facing coach text passes through here.
 *
 * Strips the AI-tell dashes (em —, en –, double --) and replaces them with the comma / "to"
 * wording the rule prescribes. Single hyphens (trading-card, best-selling) are deliberately
 * left untouched. Pure + side-effect-free.
 */
export function stripAiDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2') // number ranges: 25–40 → 25 to 40
    .replace(/\s*(?:—|–|--)\s*/g, ', ')         // em / en / double dash → comma
    .replace(/ {2,}/g, ' ')                      // tidy any double space introduced
    .replace(/ +([,.;:!?])/g, '$1');             // tidy a space left before punctuation
}
