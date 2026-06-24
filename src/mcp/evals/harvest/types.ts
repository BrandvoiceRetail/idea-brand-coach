/**
 * Conversation harvest — types.
 *
 * The loop: log real conversations (MCP + in-app chat) → weekly sweep → classify each by ICP
 * → propose a candidate eval case → screen it (pass/fail) → failing ones become feature ideas
 * → aggregate ICP signal to grow the profiles over time. See ./harvest.ts + docs/evals/CONVERSATION_HARVEST_LOOP.md.
 *
 * Pure data — the sweep is deterministic + injectable so it unit-tests without a DB or model.
 */

export interface ConvTurn {
  role: 'user' | 'coach';
  text: string;
  /** Tools the coach turn invoked (if captured). */
  tools?: string[];
}

export interface Conversation {
  id: string;
  source: 'mcp' | 'chat';
  avatarId?: string;
  turns: ConvTurn[];
  /** Tools observed across the conversation (if captured out-of-band). */
  toolCalls?: string[];
  /** ISO timestamp the conversation was captured (passed in; the sweep never reads the clock). */
  capturedAt?: string;
}

export interface Classification {
  icpId?: string;
  persona?: 'P1' | 'P2';
  confidence: 'high' | 'medium' | 'low';
  signals: string[];
  toolsUsed: string[];
  endedWithAction: boolean;
  riskFlags: string[];
}

export interface ScreenCheck {
  id: string;
  passed: boolean;
  note: string;
}

export interface ScreenResult {
  passed: boolean;
  checks: ScreenCheck[];
  reasons: string[];
}

/** A proposed eval case mined from a real conversation. */
export interface CandidateCase {
  id: string;
  title: string;
  persona: 'P1' | 'P2' | 'edge';
  icpId?: string;
  sourceConvId: string;
  /** The opening user ask (the query the case replays). */
  query: string;
  observedTools: string[];
  screen: ScreenResult;
  status: 'candidate';
}

/** A failing conversation turned into a feature/development idea from a real customer. */
export interface FeatureIdea {
  fromConvId: string;
  userAsk: string;
  why: string;
  suggestedCapability: string;
}

/** Aggregated signal that grows an ICP profile over time. */
export interface IcpSignal {
  icpId: string;
  conversations: number;
  vocabulary: string[];
  problems: string[];
}

export interface SweepResult {
  total: number;
  candidates: CandidateCase[];
  passing: number;
  failing: number;
  featureIdeas: FeatureIdea[];
  icpSignals: IcpSignal[];
}
