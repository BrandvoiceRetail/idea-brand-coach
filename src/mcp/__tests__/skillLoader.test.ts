// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  loadIdeaSkills,
  toolSkillGrounding,
  groundingPreamble,
} from '../skills/skillLoader.js';
import { registerRunTrustGapTool } from '../tools/runTrustGap.js';
import { registerBuildAvatarStageTool } from '../tools/buildAvatarStage.js';
import { registerGenerateConceptsTool } from '../tools/generateConcepts.js';

/** Minimal fake MCP server that captures registerTool(name, config, handler) calls. */
function capture() {
  const calls: Array<{ name: string; config: { description?: string } }> = [];
  const server = {
    registerTool(name: string, config: { description?: string }) {
      calls.push({ name, config });
    },
  };
  return { server: server as never, calls };
}

describe('skillLoader', () => {
  it('loads the full skill library with parsed front-matter', () => {
    const skills = loadIdeaSkills();
    expect(skills.length).toBeGreaterThanOrEqual(150);
    // every skill has a stable traceability key + a parsed chapter
    expect(skills.every((s) => s.relPath.length > 0)).toBe(true);
    expect(skills.every((s) => s.chapter.length > 0)).toBe(true);
  });

  it('maps the core coach tools to >=1 grounding skill each', () => {
    for (const tool of ['run_trust_gap', 'build_avatar_stage', 'generate_concepts']) {
      expect(toolSkillGrounding(tool).length).toBeGreaterThan(0);
    }
    expect(toolSkillGrounding('not_a_tool')).toHaveLength(0);
  });

  it('grounds run_trust_gap in the IDEA-framework chapter (traceable to a real skill)', () => {
    const mapped = toolSkillGrounding('run_trust_gap');
    const pre = groundingPreamble('run_trust_gap');
    expect(pre.length).toBeGreaterThan(0);
    // the citation is derived from a real mapped skill's front-matter chapter
    expect(mapped.some((s) => s.chapter && pre.includes(s.chapter))).toBe(true);

    const { server, calls } = capture();
    registerRunTrustGapTool(server);
    const desc = calls.find((c) => c.name === 'run_trust_gap')?.config.description ?? '';
    expect(desc).toContain('What Captures the Heart Goes in the Cart');
    expect(desc).toContain(pre.trim());
  });

  it('grounds build_avatar_stage and generate_concepts descriptions too', () => {
    const avatar = capture();
    registerBuildAvatarStageTool(avatar.server);
    expect(
      avatar.calls.find((c) => c.name === 'build_avatar_stage')?.config.description ?? '',
    ).toContain(groundingPreamble('build_avatar_stage').trim());

    // generate_concepts also takes an EdgeFnClient; grounding is applied at
    // registration, so a stub client is sufficient to inspect the description.
    const concepts = capture();
    registerGenerateConceptsTool(concepts.server, {} as never);
    expect(
      concepts.calls.find((c) => c.name === 'generate_concepts')?.config.description ?? '',
    ).toContain(groundingPreamble('generate_concepts').trim());
  });
});
