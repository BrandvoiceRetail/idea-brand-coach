/**
 * Throwaway protocol self-test: drives the live gateway over streamable HTTP exactly
 * as a real MCP client (Claude Desktop) would — initialize → prompts/list →
 * prompts/get → onboard_choose for each path. NO auth header → anonymous caller.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = 'http://localhost:8787/mcp';
const ok = (b: boolean) => (b ? 'PASS' : 'FAIL');
let allPass = true;
const check = (label: string, cond: boolean) => {
  allPass = allPass && cond;
  console.log(`  [${ok(cond)}] ${label}`);
};

const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
const client = new Client({ name: 'onboard-selftest', version: '0.0.0' });
await client.connect(transport); // initialize handshake
console.log('initialize: connected (anonymous, no auth header)');

const { prompts } = await client.listPrompts();
check('prompts/list includes `onboard`', prompts.some((p) => p.name === 'onboard'));

const got = await client.getPrompt({ name: 'onboard' });
const surface = got.messages.map((m) => (m.content.type === 'text' ? m.content.text : '')).join('\n');
check('prompts/get is branded (IDEA Brand Coach)', surface.includes('IDEA Brand Coach'));
check('prompts/get has the heart/cart line', surface.includes('What captures the heart goes in the cart'));
check('prompts/get presents Simple Diagnostic', surface.includes('Simple Diagnostic'));
check('prompts/get presents Full Contextual Upload', surface.includes('Full Contextual Upload'));

const diag = await client.callTool({ name: 'onboard_choose', arguments: { path: 'diagnostic' } });
const up = await client.callTool({ name: 'onboard_choose', arguments: { path: 'upload' } });
const diagText = (diag.content as Array<{ type: string; text: string }>)[0].text;
const upText = (up.content as Array<{ type: string; text: string }>)[0].text;
check('onboard_choose diagnostic → distinct stub', diagText.includes('Trust Gap'));
check('onboard_choose upload → distinct stub', upText.includes('listings, reviews'));
check('the two stubs differ', diagText !== upText);

// MCP Apps interactive panel (io.modelcontextprotocol/ui)
const { resources } = await client.listResources();
check('resources/list includes ui://brand-coach/onboard', resources.some((r) => r.uri === 'ui://brand-coach/onboard'));
const read = await client.readResource({ uri: 'ui://brand-coach/onboard' });
const panel = read.contents[0] as { mimeType?: string; text?: string };
check('panel mimeType is text/html;profile=mcp-app', panel.mimeType === 'text/html;profile=mcp-app');
check('panel HTML is branded + handshake-ready', !!panel.text && panel.text.includes('IDEA Brand Coach') && panel.text.includes('ui/initialize') && panel.text.includes('onboard_choose'));
const { tools } = await client.listTools();
const panelTool = tools.find((t) => t.name === 'onboard_panel');
const pmeta = panelTool?._meta as { ui?: { resourceUri?: string } } | undefined;
check('onboard_panel tool advertises _meta.ui.resourceUri', pmeta?.ui?.resourceUri === 'ui://brand-coach/onboard');
const panelCall = await client.callTool({ name: 'onboard_panel', arguments: {} });
const cmeta = panelCall._meta as { ui?: { resourceUri?: string } } | undefined;
check('onboard_panel result links the UI resource', cmeta?.ui?.resourceUri === 'ui://brand-coach/onboard');

// Posture guardrails (no invented inputs)
const instr = client.getInstructions() ?? '';
check('server instructions carry the no-invented-inputs posture', /infer, default, or invent inputs/.test(instr) && instr.includes('coach, not a form'));
check('diagnostic path elicits one-at-a-time BEFORE scoring', /one at a time/i.test(diagText) && /before any scoring/i.test(diagText));
const tg = tools.find((t) => t.name === 'run_trust_gap');
check('run_trust_gap description gates on user-derived values', !!tg && /Only call AFTER the user has explicitly worked through all four/.test(tg.description ?? ''));

console.log('\n--- onboard surface (as rendered) ---\n' + surface);
console.log('\n--- diagnostic stub ---\n' + diagText);
console.log('\n--- upload stub ---\n' + upText);

await client.close();
console.log(`\nSELFTEST: ${allPass ? 'ALL PASS' : 'FAILURES PRESENT'}`);
process.exit(allPass ? 0 : 1);
