// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  loadAppSkills,
  appArchitecture,
  appSkillsByTier,
  tier1AlwaysInContext,
  internalOnlySkills,
  getAppSkill,
  appSkillGrounding,
  appGroundingPreamble,
} from '../skills/appSkills.js';
import { registerRunTrustGapTool } from '../tools/runTrustGap.js';
import { registerBuildAvatarStageTool } from '../tools/buildAvatarStage.js';
import { registerGenerateConceptsTool } from '../tools/generateConcepts.js';
import { registerGenerateBriefTool } from '../tools/generateBrief.js';
import { registerRunDiagnosticEvidenceTool } from '../tools/runDiagnosticEvidence.js';

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

const nums = (skills: { number: string }[]) => skills.map((s) => s.number).sort();

describe('appSkills — IDEA Brand Coach App Skill Architecture (IDEA-APP-SKILLS-001 v1.0)', () => {
  it('loads exactly 20 skills across 4 tiers, each with a number, name, file and title', () => {
    const skills = loadAppSkills();
    expect(skills).toHaveLength(20);
    expect(skills.every((s) => /^\d{2}$/.test(s.number))).toBe(true);
    expect(skills.every((s) => s.name.length > 0)).toBe(true);
    expect(skills.every((s) => s.file.endsWith('.md'))).toBe(true);
    expect(skills.every((s) => s.title.length > 0)).toBe(true);
    expect(nums(skills)).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
      '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
    ]);
  });

  it('matches the spec tier membership', () => {
    expect(nums(appSkillsByTier(1))).toEqual(['01', '02', '03']);
    expect(nums(appSkillsByTier(2))).toEqual(['04', '05', '06', '07', '08']);
    expect(nums(appSkillsByTier(3))).toEqual(['09', '10', '11', '12', '13', '14']);
    expect(nums(appSkillsByTier(4))).toEqual(['15', '16', '17', '18', '19', '20']);
  });

  it('exposes the architecture header (doc ref, totals, hard rules)', () => {
    const arch = appArchitecture();
    expect(arch).not.toBeNull();
    expect(arch?.docRef).toBe('IDEA-APP-SKILLS-001 v1.0');
    expect(arch?.totals).toEqual({ skills: 20, tiers: 4 });
    // the load-bearing hard rule: buyer-state names never surface to the user
    expect(arch?.hardRules.some((r) => /Assessor.*Protector.*Expresser.*Connector/i.test(r))).toBe(true);
  });

  it('marks Tier 1 (01-03) as always-in-context and the engine-only skills as internal', () => {
    expect(nums(tier1AlwaysInContext())).toEqual(['01', '02', '03']);
    // internal-only = Skill 05 (Four Buyer States Engine) + the whole Tier-4 science engine
    expect(nums(internalOnlySkills())).toEqual(['05', '15', '16', '17', '18', '19', '20']);
  });

  it('records pipeline dependencies (Skill 05 before 06/09; 09 needs 05/06/07)', () => {
    expect(getAppSkill('05')?.dependsOn.sort()).toEqual(['04', '06', '07']);
    expect(getAppSkill('09')?.dependsOn.sort()).toEqual(['05', '06', '07']);
    // 04 forensic portrait depends on 07 corpus analysis
    expect(getAppSkill('04')?.dependsOn).toContain('07');
  });

  it('maps the core coach tools to >=1 authoritative app skill each', () => {
    for (const tool of [
      'run_trust_gap',
      'run_diagnostic_evidence',
      'build_avatar_stage',
      'generate_concepts',
      'generate_brief',
    ]) {
      expect(appSkillGrounding(tool).length).toBeGreaterThan(0);
    }
    expect(appSkillGrounding('not_a_tool')).toHaveLength(0);
    expect(appGroundingPreamble('not_a_tool')).toBe('');
  });

  it('builds a model-facing preamble that cites the doc ref + skills and reasserts the internal-only rule', () => {
    const pre = appGroundingPreamble('build_avatar_stage');
    expect(pre).toContain('IDEA-APP-SKILLS-001 v1.0');
    expect(pre).toContain('04 Avatar 2.0: Forensic Portrait');
    expect(pre.toLowerCase()).toContain('internal');
  });

  it('grounds the Alpha tool descriptions in the App Skill Architecture', () => {
    const t = capture();
    registerRunTrustGapTool(t.server);
    expect(t.calls.find((c) => c.name === 'run_trust_gap')?.config.description ?? '').toContain(
      appGroundingPreamble('run_trust_gap').trim(),
    );

    const a = capture();
    registerBuildAvatarStageTool(a.server);
    expect(a.calls.find((c) => c.name === 'build_avatar_stage')?.config.description ?? '').toContain(
      appGroundingPreamble('build_avatar_stage').trim(),
    );

    const c = capture();
    registerGenerateConceptsTool(c.server, {} as never);
    expect(c.calls.find((x) => x.name === 'generate_concepts')?.config.description ?? '').toContain(
      appGroundingPreamble('generate_concepts').trim(),
    );

    const b = capture();
    registerGenerateBriefTool(b.server);
    expect(b.calls.find((x) => x.name === 'generate_brief')?.config.description ?? '').toContain(
      appGroundingPreamble('generate_brief').trim(),
    );

    const d = capture();
    registerRunDiagnosticEvidenceTool(d.server);
    expect(d.calls.find((x) => x.name === 'run_diagnostic_evidence')?.config.description ?? '').toContain(
      appGroundingPreamble('run_diagnostic_evidence').trim(),
    );
  });
});
