/**
 * Feature Gating Examples
 *
 * Demonstrates various patterns for using the feature gating system
 * in the IDEA Brand Coach application.
 */

import { ReactNode } from 'react';
import FeatureGate from '@/components/FeatureGate';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import {
  isFeatureAvailable,
  getCurrentPhase,
  getNavigationFeatures,
  type FeatureId
} from '@/config/features';
import { Link } from 'react-router-dom';

// ============================================================================
// Example 1: Basic Route Protection with FeatureGate
// ============================================================================

/**
 * Protect an entire page with phase-based gating
 * Shows "Coming Soon" automatically when feature is disabled
 */
export function BrandCanvasPage() {
  return (
    <FeatureGate feature="BRAND_CANVAS">
      <div>
        <h1>Brand Canvas</h1>
        <p>Visual brand strategy builder</p>
        {/* Your canvas implementation */}
      </div>
    </FeatureGate>
  );
}

// ============================================================================
// Example 2: Custom Coming Soon Page
// ============================================================================

/**
 * Provide custom messaging and CTA for disabled features
 */
export function TeamCollaborationPage() {
  return (
    <FeatureGate
      feature="TEAM_COLLABORATION"
      comingSoonConfig={{
        title: 'Team Collaboration Coming Soon',
        description: 'Invite your team to collaborate on brand strategy. Share insights, documents, and consultant conversations.',
        icon: 'sparkles',
        estimatedRelease: 'Q2 2026',
        showCTA: true,
        ctaText: 'Join Waitlist',
        onCTAClick: () => {
          // Track waitlist signup
          console.log('User signed up for waitlist');
          // Show modal, redirect, etc.
        },
      }}
    >
      <div>
        <h1>Team Collaboration</h1>
        {/* Your collaboration implementation */}
      </div>
    </FeatureGate>
  );
}

// ============================================================================
// Example 3: Conditional UI Elements
// ============================================================================

/**
 * Show/hide specific UI elements based on phase
 */
export function BrandDashboard() {
  const currentPhase = getCurrentPhase();

  return (
    <div>
      <h1>Brand Dashboard</h1>

      {/* Always visible in P0+ */}
      <DiagnosticCard />
      <ConsultantCard />
      <CanvasCard />
      <AvatarCard />

      {/* Only in P1+ */}
      {isFeatureAvailable('FRAMEWORK_SUBMISSIONS', currentPhase) && (
        <SubmissionsCard />
      )}

      {/* Only in P2+ */}
      {isFeatureAvailable('BRAND_ANALYTICS', currentPhase) && (
        <AnalyticsCard />
      )}
    </div>
  );
}

function DiagnosticCard() {
  return <div>Brand Diagnostic Card</div>;
}

function ConsultantCard() {
  return <div>Brand Coach Card</div>;
}

function CanvasCard() {
  return <div>Brand Canvas Card</div>;
}

function AvatarCard() {
  return <div>Brand Avatar Card</div>;
}

function SubmissionsCard() {
  return <div>Framework Submissions Card</div>;
}

function AnalyticsCard() {
  return <div>Brand Analytics Card</div>;
}

// ============================================================================
// Example 4: Dynamic Navigation
// ============================================================================

/**
 * Automatically show/hide navigation items based on phase
 */
export function Navigation() {
  const navFeatures = getNavigationFeatures(getCurrentPhase());

  return (
    <nav>
      {navFeatures.map(feature => (
        <Link key={feature.id} to={feature.route}>
          <feature.icon className="w-5 h-5" />
          <span>{feature.name}</span>
        </Link>
      ))}
    </nav>
  );
}

// ============================================================================
// Example 5: Dynamic Feature Flags with useFeatureFlag
// ============================================================================

/**
 * Use dynamic flags for gradual rollouts and A/B testing
 */
export function BrandAnalyticsPage() {
  // Phase-based gating for the entire page
  return (
    <FeatureGate feature="BRAND_ANALYTICS">
      <BrandAnalyticsContent />
    </FeatureGate>
  );
}

function BrandAnalyticsContent() {
  // Dynamic flag for gradual rollout of advanced features
  const isAdvancedEnabled = useFeatureFlag('advanced_analytics', false);
  const isExportEnabled = useFeatureFlag('analytics_export', false);

  return (
    <div>
      <h1>Brand Analytics</h1>

      {/* Always shown in P2+ */}
      <BasicAnalytics />

      {/* Gradual rollout: 10% → 50% → 100% */}
      {isAdvancedEnabled && (
        <div>
          <h2>Advanced Analytics</h2>
          <AdvancedInsights />
          <PredictiveModeling />
        </div>
      )}

      {/* Feature flag for export functionality */}
      {isExportEnabled && (
        <button>Export Analytics Report</button>
      )}
    </div>
  );
}

function BasicAnalytics() {
  return <div>Basic analytics dashboard</div>;
}

function AdvancedInsights() {
  return <div>Advanced insights</div>;
}

function PredictiveModeling() {
  return <div>Predictive modeling</div>;
}

// ============================================================================
// Example 6: Combined Phase + Dynamic Gating
// ============================================================================

/**
 * Use both phase-based and dynamic gating together
 * Phase controls major feature (P0), dynamic flag controls sub-features
 */
export function BrandCanvasWithExport() {
  const isExportEnabled = useFeatureFlag('brand_canvas_export', false);

  return (
    <FeatureGate feature="BRAND_CANVAS">
      <div>
        <h1>Brand Canvas</h1>
        <CanvasEditor />

        {/* Export feature rolled out gradually via dynamic flag */}
        {isExportEnabled && (
          <div>
            <button>Export to PDF</button>
            <button>Export to Image</button>
          </div>
        )}
      </div>
    </FeatureGate>
  );
}

function CanvasEditor() {
  return <div>Canvas editor implementation</div>;
}

// ============================================================================
// Example 7: Feature Status Badge
// ============================================================================

/**
 * Show feature status in UI
 */
export function FeatureCard({ featureId }: { featureId: FeatureId }) {
  const currentPhase = getCurrentPhase();
  const available = isFeatureAvailable(featureId, currentPhase);

  return (
    <div>
      <h3>Feature Name</h3>
      <p>Feature description</p>
      {!available && (
        <span className="badge">Coming Soon</span>
      )}
      {available && (
        <span className="badge badge-success">Available</span>
      )}
    </div>
  );
}

// ============================================================================
// Example 8: Conditional Rendering with Multiple Conditions
// ============================================================================

/**
 * Complex conditional rendering based on multiple factors
 */
export function ConsultantChat() {
  const currentPhase = getCurrentPhase();
  const isDocumentUploadEnabled = isFeatureAvailable('DOCUMENT_UPLOAD', currentPhase);
  const isConversationHistoryEnabled = isFeatureAvailable('CONVERSATION_HISTORY', currentPhase);

  // Dynamic flags for A/B testing
  const useEnhancedUI = useFeatureFlag('consultant_enhanced_ui', false);
  const enableVoiceInput = useFeatureFlag('consultant_voice_input', false);

  return (
    <div className={useEnhancedUI ? 'enhanced-ui' : 'standard-ui'}>
      <h1>Brand Coach GPT</h1>

      {/* Core chat always available */}
      <ChatInterface />

      {/* Document upload available in P0+ */}
      {isDocumentUploadEnabled && (
        <DocumentUploadPanel />
      )}

      {/* Conversation history available in P0+ */}
      {isConversationHistoryEnabled && (
        <ConversationHistoryPanel />
      )}

      {/* Voice input: gradual rollout */}
      {enableVoiceInput && (
        <VoiceInputButton />
      )}
    </div>
  );
}

function ChatInterface() {
  return <div>Chat interface</div>;
}

function DocumentUploadPanel() {
  return <div>Document upload panel</div>;
}

function ConversationHistoryPanel() {
  return <div>Conversation history panel</div>;
}

function VoiceInputButton() {
  return <button>🎤 Voice Input</button>;
}

// ============================================================================
// Example 9: Feature Preview Banner
// ============================================================================

/**
 * Show preview banner for upcoming features
 */
export function FeaturePreviewBanner({ featureId }: { featureId: FeatureId }) {
  const currentPhase = getCurrentPhase();
  const available = isFeatureAvailable(featureId, currentPhase);

  if (available) return null;

  return (
    <div className="preview-banner">
      <p>
        🚀 This feature is coming soon!
        <Link to="/roadmap">View our roadmap</Link>
      </p>
    </div>
  );
}

// ============================================================================
// Example 10: Admin Feature Flag Controls
// ============================================================================

/**
 * Admin UI for managing dynamic feature flags
 */
export function AdminFeatureFlagPanel() {
  const { useAllFeatureFlags } = require('@/hooks/useFeatureFlag');
  const allFlags = useAllFeatureFlags();

  return (
    <div>
      <h2>Feature Flags</h2>
      {allFlags.map(flag => (
        <div key={flag.id}>
          <h3>{flag.name}</h3>
          <p>{flag.description}</p>
          <label>
            <input
              type="checkbox"
              checked={flag.enabled}
              onChange={(e) => {
                // Update flag in Supabase
                console.log('Toggle flag:', flag.name, e.target.checked);
              }}
            />
            Enabled
          </label>
          <pre>{JSON.stringify(flag.targeting_rules, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Example 11: Feature Unavailable Inline Message
// ============================================================================

/**
 * Show inline message for unavailable features instead of full page
 */
export function BrandAnalyticsButton() {
  const currentPhase = getCurrentPhase();
  const available = isFeatureAvailable('BRAND_ANALYTICS', currentPhase);

  if (!available) {
    return (
      <div className="feature-locked">
        <button disabled>
          📊 Analytics (Coming Q3 2026)
        </button>
      </div>
    );
  }

  return (
    <Link to="/analytics">
      <button>📊 Analytics</button>
    </Link>
  );
}

// ============================================================================
// Example 12: Feature Wrapper Component
// ============================================================================

/**
 * Reusable wrapper for consistently handling feature access
 */
interface FeatureWrapperProps {
  featureId: FeatureId;
  children: ReactNode;
  fallback?: ReactNode;
  showBadge?: boolean;
}

export function FeatureWrapper({
  featureId,
  children,
  fallback,
  showBadge = false
}: FeatureWrapperProps) {
  const currentPhase = getCurrentPhase();
  const available = isFeatureAvailable(featureId, currentPhase);

  if (!available) {
    return <>{fallback || <span>Feature coming soon</span>}</>;
  }

  return (
    <div>
      {children}
      {showBadge && <span className="badge">New</span>}
    </div>
  );
}

// Usage:
export function ExampleUsage() {
  return (
    <FeatureWrapper
      featureId="BRAND_CANVAS"
      fallback={<p>Canvas coming soon!</p>}
      showBadge
    >
      <CanvasEditor />
    </FeatureWrapper>
  );
}
