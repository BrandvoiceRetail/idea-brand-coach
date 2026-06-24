// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { redactText, redactConversation } from '../evals/harvest/redact.js';
import { harvestSweep } from '../evals/harvest/harvest.js';
import type { Conversation } from '../evals/harvest/types.js';

describe('redactText', () => {
  it('masks an email, a phone, an ASIN, and a $ amount but KEEPS a percentage', () => {
    const out = redactText(
      'Email jane@acme.co, call 0207 946 0958, hero ASIN B0CABCDEFG selling for $1,299.50 with a 23% margin.',
    );
    expect(out).toContain('[email]');
    expect(out).not.toContain('jane@acme.co');
    expect(out).toContain('[phone]');
    expect(out).not.toContain('0207 946 0958');
    expect(out).toContain('[asin]');
    expect(out).not.toContain('B0CABCDEFG');
    expect(out).toContain('[amount]');
    expect(out).not.toContain('$1,299.50');
    // percentage is diagnostic signal — kept verbatim
    expect(out).toContain('23%');
  });

  it('masks a self-introduced person name', () => {
    expect(redactText("Hi, I'm Jane Doe and I run a brand.")).toContain("I'm [name]");
    expect(redactText('my name is John Smith')).toBe('my name is [name]');
    expect(redactText("I'm Jane Doe and I run a brand.")).not.toContain('Jane Doe');
  });
});

describe('redactConversation', () => {
  const conv: Conversation = {
    id: 'r1',
    source: 'chat',
    toolCalls: ['run_trust_gap'],
    turns: [
      { role: 'user', text: "I'm Maria Lopez, email maria@brand.io, my hero ASIN B0DEADBEEF is at $899." },
      { role: 'coach', text: 'Here is your trust gap brief.', tools: ['run_trust_gap'] },
    ],
  };

  it('does not mutate the input', () => {
    const before = structuredClone(conv);
    const out = redactConversation(conv);
    expect(conv).toEqual(before); // input untouched
    expect(out).not.toBe(conv);
    expect(out.turns).not.toBe(conv.turns);
    expect(out.turns[0]).not.toBe(conv.turns[0]);
    // redacted clone carries the masks
    expect(out.turns[0].text).toContain('[email]');
    expect(out.turns[0].text).toContain('[asin]');
    expect(out.turns[0].text).toContain('[amount]');
    expect(out.turns[0].text).not.toContain('maria@brand.io');
    expect(out.turns[0].text).not.toContain('B0DEADBEEF');
    // tools array is cloned, not shared
    expect(out.turns[1].tools).not.toBe(conv.turns[1].tools);
    expect(out.toolCalls).not.toBe(conv.toolCalls);
  });
});

describe('harvestSweep redaction', () => {
  it('produces candidates whose query/title carry no raw email or ASIN', () => {
    const piiConv: Conversation = {
      id: 'pii1',
      source: 'mcp',
      turns: [
        {
          role: 'user',
          text: "I'm Sam Carter — email sam@store.com. Score my hero SKU ASIN B0FEEDFACE, it sells for $1,499 at a 31% margin.",
        },
        { role: 'coach', text: "Here's your Trust Gap score and a design brief.", tools: ['run_trust_gap'] },
      ],
    };
    const sweep = harvestSweep([piiConv]);
    expect(sweep.total).toBe(1);
    const candidate = sweep.candidates.find((c) => c.sourceConvId === 'pii1')!;
    expect(candidate).toBeDefined();

    for (const field of [candidate.query, candidate.title]) {
      expect(field).not.toContain('sam@store.com');
      expect(field).not.toContain('B0FEEDFACE');
      expect(field).not.toContain('$1,499');
      expect(field).not.toContain('Sam Carter');
    }
    // the redaction markers survive into the mined candidate
    expect(candidate.query).toContain('[email]');
    expect(candidate.query).toContain('[asin]');
    // diagnostic percentage is preserved
    expect(candidate.query).toContain('31%');

    // no feature idea carries raw PII either
    for (const idea of sweep.featureIdeas) {
      expect(idea.userAsk).not.toContain('sam@store.com');
      expect(idea.userAsk).not.toContain('B0FEEDFACE');
    }
  });
});
