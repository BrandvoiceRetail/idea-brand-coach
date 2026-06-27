/**
 * V4Tools — the /v4/tools trust-signals page.
 *
 * Renders the IDEA Brand Coach tool registry: every tool the coach can run,
 * grouped (Diagnose / Avatar 2.0 / Outputs / Funnel / Ledger / Sessions &
 * Feedback / Coming next), with first-shipped date, version, reviews, and
 * status. Data is GENERATED — never hand-edited — by
 * `scripts/build-tool-registry.ts` (sourced from the MCP tool surface + git
 * history). Regenerate with `npm run build:tool-registry`.
 *
 * Self-contained dark theme (black bg / gold accents, v23 palette) so it reads
 * as a standalone trust page rather than inheriting the warm app shell.
 */
import {
  TOOL_REGISTRY,
  TOOL_REGISTRY_TOTAL,
  TOOL_REGISTRY_AVAILABLE,
  TOOL_REGISTRY_GENERATED_AT,
  type RegistryTool,
} from '@/data/toolRegistry.generated';

function StatusBadge({ status }: { status: RegistryTool['status'] }): JSX.Element {
  if (status === 'Available') {
    return (
      <span className="inline-block whitespace-nowrap rounded-full bg-[#FEF5DC] px-2.5 py-0.5 text-xs font-semibold text-[#7a5300]">
        Available
      </span>
    );
  }
  return (
    <span className="inline-block whitespace-nowrap rounded-full border border-[#2a2a2a] bg-[#232323] px-2.5 py-0.5 text-xs font-semibold text-[#9a9a9a]">
      Roadmap
    </span>
  );
}

export default function V4Tools(): JSX.Element {
  const roadmap = TOOL_REGISTRY_TOTAL - TOOL_REGISTRY_AVAILABLE;
  const generatedDate = TOOL_REGISTRY_GENERATED_AT.slice(0, 10);

  return (
    <div className="min-h-screen bg-[#111111] font-[Helvetica_Neue,Helvetica,Arial,sans-serif] text-white">
      <div className="mx-auto max-w-5xl px-5 pb-20 pt-12">
        <header className="border-b border-[#2a2a2a] pb-6">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            IDEA Brand Coach <span className="text-[#D4960A]">Tool Registry</span>
          </h1>
          <p className="mt-2 max-w-[60ch] text-[#9a9a9a]">
            Every tool the coach can run for you — what it does, when it first shipped, and
            whether it's live today. Reviews are shown honestly; nothing is fabricated.
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Stat n={TOOL_REGISTRY_TOTAL} label="Tools" />
            <Stat n={TOOL_REGISTRY_AVAILABLE} label="Available now" />
            <Stat n={roadmap} label="Coming next" />
          </div>
        </header>

        {TOOL_REGISTRY.map((g) => (
          <section key={g.group} className="mt-10">
            <h2 className="mb-3 flex items-center gap-2.5 text-lg font-semibold">
              {g.group}
              <span className="rounded-full bg-[#D4960A] px-2.5 py-0.5 text-xs font-semibold text-[#111111]">
                {g.tools.length}
              </span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-[#2a2a2a]">
              <table className="w-full min-w-[720px] border-collapse">
                <thead>
                  <tr className="bg-[#161616]">
                    {['Tool', 'What it does', 'First shipped', 'Version', 'Reviews', 'Status'].map(
                      (h) => (
                        <th
                          key={h}
                          className="border-b border-[#2a2a2a] px-3.5 py-3 text-left text-[11px] uppercase tracking-wider text-[#9a9a9a]"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {g.tools.map((t) => (
                    <tr key={t.name} className="hover:bg-[#161616]">
                      <td className="border-b border-[#2a2a2a] px-3.5 py-3 align-top">
                        <code className="whitespace-nowrap text-[13px] text-[#D4960A]">
                          {t.name}
                        </code>
                      </td>
                      <td className="border-b border-[#2a2a2a] px-3.5 py-3 align-top text-sm text-[#d8d8d8]">
                        {t.description}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#2a2a2a] px-3.5 py-3 align-top text-sm text-[#cfcfcf]">
                        {t.firstShipped}
                      </td>
                      <td className="whitespace-nowrap border-b border-[#2a2a2a] px-3.5 py-3 align-top text-sm text-[#cfcfcf]">
                        {t.version}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-3.5 py-3 align-top text-sm text-[#9a9a9a]">
                        {t.reviews}
                      </td>
                      <td className="border-b border-[#2a2a2a] px-3.5 py-3 align-top">
                        <StatusBadge status={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <footer className="mt-12 border-t border-[#2a2a2a] pt-5 text-xs text-[#9a9a9a]">
          Generated {generatedDate} from the live MCP tool surface + git history. This page is
          regeneratable — run <code className="text-[#cfcfcf]">npm run build:tool-registry</code>.
        </footer>
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }): JSX.Element {
  return (
    <div className="rounded-[10px] border border-[#2a2a2a] bg-[#161616] px-4 py-3">
      <div className="text-[22px] font-bold text-[#D4960A]">{n}</div>
      <div className="text-xs uppercase tracking-wider text-[#9a9a9a]">{label}</div>
    </div>
  );
}
