---
stepsCompleted: ["step-01-init", "step-02-discovery"]
inputDocuments: [
  "claude-code-os-implementation/02-operations/project-management/active-projects/idea-brand-coach/PROJECT-OVERVIEW.md",
  "claude-code-os-implementation/02-operations/project-management/active-projects/idea-brand-coach/02-28-26-update/project-status.md",
  "/Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/src/types/profile.ts",
  "/Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/src/types/diagnostic.ts"
]
workflowType: 'prd'
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 4
classification:
  projectType: "SaaS B2B"
  domain: "Ecommerce/Brand Strategy"
  complexity: "Medium"
  projectContext: "brownfield"
---

# Product Requirements Document - ai-agency-development-os

**Author:** Matthew
**Date:** 2026-02-28

## Success Criteria

**Business Success Metrics:**
- **Primary Goal:** 1000 Monthly Active Users (MAU) within 6 months of launch
- **Engagement:** Average 3+ avatars created per active user
- **Session Time:** Average 25+ minutes per coaching session
- **Conversion:** 40% of users complete at least one full avatar through the entire IDEA framework
- **Retention:** 60% monthly user retention rate

**ROI Validation Metrics:**
- **Testimonials:** 10+ verified ROI testimonials within first 3 months
  - Documenting: Initial avatar → Campaign deployment → Performance metrics
  - Examples: "Tested 3 avatars, Avatar B generated 2.3x ROAS on Facebook"
- **Performance Tracking:** 75% of users manually log performance metrics after deploying assets
- **Success Stories:** 5+ case studies showing measurable brand transformation

**Technical Success Criteria:**
- **Performance:** Chat response time < 2 seconds
- **Reliability:** 99.5% uptime
- **Data Integrity:** Zero data loss for avatar profiles
- **Cross-Platform:** Seamless experience between mobile and desktop
- **Accessibility:** WCAG 2.1 AA compliance

## Product Scope

**MVP Scope (Phase 1 - 3 months):**
1. **Multi-Avatar Management**
   - Create unlimited avatars per brand
   - Switch between avatars seamlessly
   - Avatar templates for quick starts
   - Avatar comparison side-by-side view

2. **Book-Guided Chat Workflow**
   - Linear progression following IDEA book chapters
   - Chapter-by-chapter avatar development
   - Smart questions based on book sections
   - Progress tracking through framework

3. **Manual Field Editing**
   - Left panel field editor (desktop)
   - Bottom sheet field editor (mobile)
   - Auto-save with conflict resolution
   - Field validation and suggestions

4. **Voice-to-Text Input**
   - Text input foundation (voice-ready architecture)
   - Fast typing workflow optimization
   - Multi-line input support
   - Draft/submit pattern

5. **Performance Tracking**
   - Manual metric entry per avatar
   - Deployment channel tracking (Facebook, Email, TikTok, etc.)
   - Before/after performance comparison
   - ROI calculator

**Growth Scope (Phase 2 - 6 months):**
1. **System Knowledge Base**
   - Full IDEA book indexed and searchable
   - Contextual book excerpts during chat
   - Smart recommendations based on avatar progress

2. **User Knowledge Base**
   - Upload brand documents (PDFs, docs)
   - Extract brand voice from existing materials
   - Cross-avatar learning and suggestions

3. **Advanced Analytics**
   - Avatar performance dashboard
   - A/B testing recommendations
   - Trend analysis across avatars
   - ROI attribution modeling

4. **Collaboration Features**
   - Share avatars with team members
   - Comments and annotations
   - Version history and rollback
   - Export to client presentations

**Vision Scope (12+ months):**
1. **AI-Powered Optimization**
   - Predictive avatar performance scoring
   - Automated avatar generation from campaign data
   - Machine learning based on successful avatars

2. **Platform Integrations**
   - Direct Facebook Ads integration
   - Shopify customer data sync
   - Email platform connectivity
   - Analytics platform webhooks

3. **Enterprise Features**
   - Multi-brand workspaces
   - Team collaboration workflows
   - Custom branding/white-label
   - API access for automation

### Out of Scope
- Native mobile apps (web-responsive only)
- Real-time voice transcription (text input only in MVP)
- Automatic campaign deployment to ad platforms
- Payment processing (handled externally)
- Video content generation
- Direct CRM integrations in MVP

### Feature Prioritization Matrix

| Feature | User Value | Technical Effort | Priority |
|---------|-----------|------------------|----------|
| Multi-avatar management | High | Medium | P0 |
| Book-guided chat flow | High | Medium | P0 |
| Manual field editing | High | Low | P0 |
| Performance tracking | High | Low | P0 |
| Voice-to-text foundation | Medium | Low | P1 |
| System KB integration | High | High | P0 |
| User document upload | High | High | P0 |
| Analytics dashboard | Medium | High | P2 |
| Team collaboration | Low | High | P3 |

## User Journey Mapping

### Primary User Personas

**1. Sarah - The Brand Strategist**
- **Role:** Independent brand consultant
- **Goal:** Test multiple avatar hypotheses for client brands
- **Pain Point:** Spending hours creating detailed personas manually
- **Success:** Generate 3-5 validated avatars in under 2 hours

**2. Marcus - The Ecommerce Owner**
- **Role:** DTC brand owner with $2M annual revenue
- **Goal:** Optimize Facebook/TikTok ad targeting
- **Pain Point:** Ads performing poorly, unsure which audience to target
- **Success:** Identify winning avatar that improves ROAS by 50%+

**3. Emily - The Marketing Manager**
- **Role:** In-house marketing lead for growing brand
- **Goal:** Align team around customer understanding
- **Pain Point:** Team has different ideas about target customer
- **Success:** Create shared avatar documentation team agrees on

### Critical User Journey: First-Time Avatar Creation

**Journey Name:** "From Zero to First Avatar"
**Persona:** Marcus (Ecommerce Owner)
**Duration:** 30-45 minutes

**Detailed Steps:**

1. **Entry (0-2 min)**
   - Lands on mobile web app from Trevor's email
   - Sees simple onboarding message: "Let's define your ideal customer"
   - Creates account with email/Google

2. **Brand Setup (2-5 min)**
   - Names brand: "Outdoor Adventure Gear"
   - Uploads logo (optional)
   - Inputs website URL
   - Uploads additional available brand documentation (PDFs, brand guides, etc.)
   - Sees first avatar tab ready

3. **Avatar Initialization (5-8 min)**
   - Names avatar: "Weekend Warrior"
   - Selects template or starts from scratch
   - Chat introduces the IDEA framework and book structure

4. **Book-Guided Discovery (8-35 min)**

   Based on the actual 11 chapters from Trevor's book:

   **Stage 1: Foundation (Chapters 1-2)**
   - Chat explores trust erosion and differentiation needs
   - "What's happening in your market that's making it harder to stand out?"
   - "How are your customers' expectations changing?"
   - **Fields populated:** Market context, Competitive landscape
   - **Manual refinement pause:** User reviews and adjusts market understanding

   **Stage 2: Avatar 2.0 Development (Chapter 3)**
   - Deep dive into behavioral psychology
   - "Describe your customer's daily life and routines..."
   - "What subconscious emotions drive their purchases?"
   - **Fields populated:** Demographics, Psychographics, Behavioral triggers, Emotional drivers
   - **Manual refinement pause:** User fine-tunes avatar details

   **Stage 3: IDEA Framework Application (Chapters 2, 4-5)**
   - **Insight-Driven:** "What hidden truth about your customer have you discovered?"
   - **Distinctive:** "What makes your brand unmistakably different?"
   - **Empathetic:** "How do you mirror your customer's emotions?"
   - **Authentic:** "What's your genuine brand story?"
   - **Fields populated:** Brand positioning, Value propositions, Emotional connections
   - **Manual refinement pause:** User adjusts brand-avatar alignment

   **Stage 4: Brand Voice & Messaging (Chapter 6)**
   - "How would your brand talk to this specific avatar?"
   - "What emotional signals resonate with them?"
   - **Fields populated:** Tone of voice, Key messages, Content themes
   - **Manual refinement pause:** User customizes voice attributes

   **Stage 5: Customer Journey Mapping (Chapter 8)**
   - "Walk me through how this avatar discovers and buys from you..."
   - Maps awareness → consideration → purchase → advocacy
   - **Fields populated:** Touchpoints, Channels, Conversion triggers
   - **Manual refinement pause:** User updates journey specifics

5. **Manual Refinement Checkpoints (Throughout)**
   - After each stage, fields become visible and editable
   - Manual edits always take priority over AI suggestions
   - System saves both AI and manual versions for reference
   - Visual indicator shows which fields were manually edited

6. **Document Generation (35-38 min)**
   - Generates comprehensive strategy doc incorporating all 11 book chapters
   - Includes relevant book excerpts and frameworks
   - Prioritizes manually edited fields in final output

7. **Performance Tracking Setup (38-45 min)**
   - Selects deployment channels
   - Sets baseline metrics
   - Schedules follow-up reminders

### Improved Field Synchronization Approach

**Principle: Manual Edits Are Sacred**
- Once a user manually edits a field, it's marked with a "user-edited" flag
- AI suggestions for that field become "suggestions" not overwrites
- User can explicitly request AI to update a manually edited field

**Progressive Field Visibility:**
```
Chat Stage 1 Complete → Show Stage 1 Fields → User Edits → Continue to Stage 2
                          ↓
                    Manual edits locked in
                          ↓
            AI respects these in future responses
```

**Visual Feedback:**
- 🤖 AI-generated field (can be overwritten by chat)
- ✏️ User-edited field (protected from AI overwrites)
- 💡 AI has a suggestion for your edited field (optional to accept)

### Mobile-Specific User Journey

**Journey Name:** "Quick Avatar on the Go"
**Persona:** Emily (Marketing Manager)
**Device:** iPhone 14
**Duration:** 15 minutes

**Stage-by-Stage Mobile Flow:**
1. Complete chat stage on mobile
2. Swipe up to see populated fields
3. Tap any field to edit inline
4. Edits auto-save and lock
5. Swipe down to continue chat
6. Next stage respects all edits

### Error & Recovery Journeys

**Scenario 1: Incomplete Avatar**
- User exits mid-creation
- Returns to see progress saved
- Chat remembers context
- Continues from last question

**Scenario 2: Field Data Prioritization**
- User manually edits a field after AI population
- System immediately marks field as "user-edited"
- Future AI responses adapt to respect manual edits
- AI might suggest: "I see you've customized the age range. Based on that, you might also want to adjust..."
- No conflicts - manual always wins

**Scenario 3: Poor Performance Results**
- Avatar campaigns fail
- User logs poor metrics
- System suggests refinements
- Guides through optimization

### Journey Success Metrics

| Journey | Success Metric | Target | Measurement |
|---------|---------------|--------|-------------|
| First Avatar Creation | Completion Rate | 70% | Users who finish first avatar |
| Multi-Avatar Testing | Avatars per User | 3+ | Average avatars created |
| Book Progression | Chapter Completion | 60% | Users reaching Chapter 8+ content |
| Manual Refinement | Edit Rate | 40%+ | Fields manually adjusted |
| Document Export | Export Rate | 80% | Completed avatars exported |

### Book Content Integration Map

| Book Chapter | Chat Workflow Stage | Key Questions | Fields Populated |
|--------------|-------------------|---------------|------------------|
| Ch 1: Evolving Landscape | Stage 1 | Market changes, AI impact | Market context |
| Ch 2: IDEA Framework | Stage 3 | Four pillars exploration | Brand positioning |
| Ch 3: Avatar 2.0 | Stage 2 | Behavioral psychology | Full avatar profile |
| Ch 4: Authentically Human | Stage 3 | Genuine connection | Brand personality |
| Ch 5: Brand Canvas | Stage 3 | Strategy systemization | Value props |
| Ch 6: Brand Voice | Stage 4 | Emotional signaling | Messaging |
| Ch 7: Training AI | (Future) | Custom GPT setup | AI parameters |
| Ch 8: Customer Journey | Stage 5 | Path to purchase | Journey map |
| Ch 9: Product Development | (Growth phase) | Alignment with needs | Product strategy |
| Ch 10: Personal Branding | (Optional) | Founder story | Personal brand |
| Ch 11: Research Guide | Throughout | Competitor analysis | Market research |

## Technical Considerations

### Migration & Compatibility

**Database Migration Strategy**
- **Approach:** Additive migrations only - no breaking changes
- **New Tables:** Add brands, avatars, performance_metrics tables
- **Existing Data:** Current users continue working unaffected
- **Migration Path:**
  ```sql
  -- Phase 1: Add new tables (non-breaking)
  CREATE TABLE IF NOT EXISTS brands...
  CREATE TABLE IF NOT EXISTS avatars...

  -- Phase 2: Optional data migration
  -- Create default brand for existing users
  -- Migrate existing chat sessions to first avatar
  ```

**Feature Flag Rollout**
```typescript
// Use existing useFeatureFlag hook
const { isEnabled } = useFeatureFlag('v2-multi-avatar');

// Gradual rollout
if (isEnabled) {
  return <V2Interface />;
} else {
  return <V1Interface />;
}
```

### Book Content Integration (Existing RAG Solution)

**Already Implemented:**
- ✅ **Trevor's book in OpenAI Vector Store** (ID: `vs_6948707b318c81918a90e9b44970a99e`)
- ✅ **System KB always enabled** via 'idea-framework-consultant-test' edge function
- ✅ **OpenAI Responses API with file_search** for semantic search
- ✅ **5+5 Vector Store Architecture** (5 system KBs + 5 user KBs per user)

**How Chat Accesses Book Content:**
```typescript
// Edge function automatically searches book based on user queries
const response = await supabase.functions.invoke('idea-framework-consultant-test', {
  body: {
    message: userMessage,
    chat_history: recentMessages,
    // System KB search happens automatically inside edge function
  }
});
```

**V2 Enhancement - Linear Book Progression:**
```typescript
interface AvatarBookProgress {
  currentChapter: number;  // 1-11
  completedStages: string[];
  lastExcerpts: string[];  // Recent book references
}

// Track progress per avatar
const chatMetadata = {
  avatarId: currentAvatarId,
  currentChapter: avatar.bookProgress.currentChapter,
  // Edge function uses this to focus book search on relevant chapters
};
```

### Performance Optimization

**Chat Response Streaming**
- **Challenge:** Multiple avatars = multiple chat histories
- **Solution:** Lazy load chat history, stream responses
```typescript
// Only load active avatar's chat
const { data: messages } = useQuery({
  queryKey: ['chat', avatarId],
  enabled: avatarId === currentAvatarId,
  staleTime: 5 * 60 * 1000 // 5 minutes
});
```

**Field Updates & Debouncing**
- **Challenge:** Frequent field edits causing excessive saves
- **Solution:** Already handled by usePersistedField
```typescript
// Existing hook already has debouncing
usePersistedField({
  debounceDelay: 500, // Already implemented
  syncInterval: 30000 // Background sync every 30s
});
```

**Mobile Performance**
- **Challenge:** Limited resources on mobile devices
- **Solution:** Progressive enhancement
```typescript
// Reduce animations on low-end devices
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lazy load heavy components
const FieldEditor = lazy(() => import('./FieldEditor'));
```

### State Management Without Additional Libraries

**Multi-Avatar State Using Existing Patterns**
```typescript
// Simple Context + React Query approach
const AvatarProvider = ({ children }) => {
  // UI State (local)
  const [currentAvatarId, setCurrentAvatarId] = useState();
  const [compareMode, setCompareMode] = useState(false);

  // Server State (React Query)
  const avatarsQuery = useQuery(['avatars']);
  const currentAvatar = avatarsQuery.data?.find(a => a.id === currentAvatarId);

  // Field edits use existing usePersistedField
  // No additional state management needed!

  return (
    <AvatarContext.Provider value={{
      avatars: avatarsQuery.data,
      currentAvatar,
      switchAvatar: setCurrentAvatarId
    }}>
      {children}
    </AvatarContext.Provider>
  );
};
```

### Security Considerations

**Row-Level Security (RLS)**
```sql
-- Ensure users only see their own data
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own brands" ON brands
  FOR ALL USING (user_id = auth.uid());

-- Avatars inherit brand permissions
CREATE POLICY "Access avatars through brands" ON avatars
  FOR ALL USING (
    brand_id IN (
      SELECT id FROM brands WHERE user_id = auth.uid()
    )
  );
```

**Input Validation**
```typescript
// Validate all user inputs before saving
const validateAvatarField = (field: string, value: any) => {
  switch(field) {
    case 'age_range':
      return /^\d{1,3}-\d{1,3}$/.test(value);
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    // ... other validations
  }
};
```

### Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| **OpenAI API Rate Limits** | Chat becomes unavailable | Implement exponential backoff, queue requests, cache responses |
| **Large Chat Histories** | Performance degradation | Pagination, virtual scrolling, summarize old messages |
| **Concurrent Edits** | Data conflicts | Optimistic locking, last-write-wins with history |
| **Mobile Data Usage** | High bandwidth costs | Compress images, lazy load, offline mode |

### Development Environment Setup

**Required Environment Variables**
```env
# Existing (already configured)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_OPENAI_API_KEY=

# New for V2
VITE_ENABLE_V2_INTERFACE=false
```

**Local Development Workflow**
```bash
# Use existing setup
npm run dev          # Start dev server
npm run test:watch   # Run tests
npm run build        # Production build

# Database migrations
npx supabase migration new add_avatars
npx supabase db push
```

### Testing Strategy

**Unit Tests (Existing Vitest Setup)**
```typescript
// Test avatar state management
describe('AvatarContext', () => {
  it('switches between avatars', () => {
    // Test avatar switching
  });

  it('preserves field edits when switching', () => {
    // Test field persistence
  });
});
```

**Integration Tests**
```typescript
// Test chat-to-field flow
it('extracts fields from chat response', async () => {
  const response = "The customer is 25-35 years old";
  const fields = await extractFields(response);
  expect(fields.age_range).toBe("25-35");
});
```

### Monitoring & Analytics

**Key Metrics to Track**
```typescript
// Using existing PostHog/Mixpanel integration
track('avatar_created', {
  avatar_id: avatarId,
  completion_time: duration,
  fields_filled: fieldCount,
  chat_messages: messageCount
});

track('performance_metric_logged', {
  avatar_id: avatarId,
  channel: 'facebook',
  roas: 2.3
});
```

### Deployment Considerations

**Incremental Rollout Plan**
1. **Week 1:** Internal testing with feature flag
2. **Week 2:** 10% of users (beta testers)
3. **Week 3:** 50% rollout
4. **Week 4:** 100% with v1 fallback option

**Rollback Strategy**
- Feature flags allow instant rollback
- Database changes are additive (non-breaking)
- Keep v1 interface available for 30 days

## AI & Automation Strategy

### Core AI Capabilities

#### 1. Intelligent Chat Orchestration

**Book-Guided Conversation Flow**
- AI determines next question based on current chapter (1-11)
- Adapts to fields already populated and user response patterns
- Dynamic progression through IDEA framework concepts
- Smart skip/revisit logic for incomplete sections

**Dynamic Question Generation**
- Industry-specific adaptation
- References uploaded brand documents
- Pulls relevant book excerpts via existing RAG
- Suggests follow-ups based on profile gaps

#### 2. Field Extraction & Population

**Natural Language Processing Pipeline**
```
User Input → Entity Recognition → Field Mapping → Validation → Database Update
```

**Smart Extraction Examples**
- "Our customers are mostly millennials" → age_range: "25-40"
- "They care about sustainability" → values: ["environmental", "ethical"]
- "Budget conscious but quality-focused" → price_sensitivity: "medium"

**Confidence Scoring**
- High (>90%): Auto-populate field
- Medium (60-90%): Populate with suggestion indicator
- Low (<60%): Ask clarifying question

#### 3. Avatar Intelligence

**Avatar Comparison & Insights**
- Identify similarities and differences
- Recommend optimizations
- Detect conflicting attributes
- Suggest A/B testing strategies

**Performance Prediction (Future)**
- Historical data analysis
- Success likelihood scoring
- ROI forecasting

#### 4. Document Intelligence

**Brand Document Analysis**
- Extract brand voice automatically
- Identify value propositions
- Detect inconsistencies
- Auto-populate relevant fields

**Smart Document Referencing**
- AI cites uploaded documents during chat
- Cross-references with IDEA book content
- Maintains consistency across avatars

#### 5. Content Generation

**Avatar-Specific Copy**
- Tailored to avatar psychographics
- Matches brand voice
- Multiple format support (email, ad, social)
- Tone adaptation per avatar

**Strategy Document Generation**
- Comprehensive per-avatar strategies
- Book excerpt integration
- Document citations
- Actionable recommendations

### AI Enhancement Layers

**Layer 1: Conversation Intelligence (MVP)**
- Book-guided chat progression
- Smart field extraction
- Context-aware questions
- Basic avatar insights

**Layer 2: Deep Analysis (Growth)**
- Performance predictions
- Competitive differentiation
- Pattern recognition
- Advanced document understanding

**Layer 3: Predictive Intelligence (Vision)**
- ROI forecasting
- Market trend integration
- Automated optimization
- Campaign performance prediction

### AI Safety & Quality Control

**Hallucination Prevention**
- Ground responses in IDEA book content
- Reference user documents only
- Verify against avatar data
- No unsourced claims

**Response Validation**
- Field value verification
- Citation accuracy checks
- Consistency maintenance
- Low-confidence flagging

### Prompt Engineering Strategy

**System Prompt Structure**
- Current avatar context
- Book chapter position
- Completed fields tracking
- Brand context integration

**Dynamic Prompt Adjustment**
- Expertise level adaptation
- Complexity scaling
- Industry-specific examples
- Previous avatar referencing

### AI-Powered Workflows

**Rapid Avatar Creation (15 min)**
1. Business description input
2. AI suggests 3 templates
3. Template selection
4. 60% auto-fill from context
5. Targeted refinement chat

**Avatar Optimization**
1. Performance metric logging
2. Underperformance analysis
3. Field adjustment suggestions
4. Improvement hypothesis
5. Results tracking

**Competitive Differentiation**
1. Competitor description
2. Differentiation analysis
3. Avatar modifications
4. Distinctive messaging

### AI Cost Optimization

**Token Management**
- Cache book excerpts (24hr TTL)
- Summarize old messages
- Use GPT-4o-mini for extraction
- GPT-4 for complex generation only
- Request batching

**Response Caching**
- Book search results
- Industry templates
- Extraction patterns
- Generated documents

### AI Performance Metrics

| Metric | Target | Measurement |
|--------|--------|------------|
| Field Extraction Accuracy | >85% | Manual corrections |
| Chat Response Relevance | >90% | User ratings |
| Avatar Completion Time | <25 min | 80% complete |
| Book Citation Accuracy | 100% | Verified |
| Document Reference Rate | >60% | Usage percentage |

### Ethical AI Considerations

**Transparency**
- Indicate AI-generated content
- Show confidence levels
- User override capability
- Recommendation explanations

**Privacy**
- No model training on user data
- Private document isolation
- No cross-user learning
- Clear retention policies

**Bias Prevention**
- Regular audit cycles
- Diverse templates
- Industry-agnostic prompts
- User final control

## Risk Assessment

### Risk Matrix Overview

| Risk Category | Likelihood | Impact | Overall Risk | Priority |
|---------------|------------|--------|--------------|----------|
| Technical Debt | High | Medium | High | 1 |
| User Adoption | Medium | High | High | 2 |
| AI Reliability | Medium | High | High | 3 |
| Data Migration | Low | High | Medium | 4 |
| Performance | Medium | Medium | Medium | 5 |
| Security | Low | Very High | Medium | 6 |

### 1. Technical Debt Risk (HIGH) - WITH REFACTORING ASSESSMENT

**Risk Description:**
- Building on existing v1 codebase without full refactoring
- Mixed patterns between v1 and v2 implementations
- Accumulated code smells in critical paths

**PRE-IMPLEMENTATION REFACTORING ASSESSMENT**

Based on `~/workspace/software-development-best-practices-guide`:

**Phase 0: Code Smell Assessment (Before V2 Implementation)**

**High-Priority Refactorings for V2:**

| Code Smell | Location | Impact on V2 | Refactoring | Effort |
|------------|----------|--------------|-------------|--------|
| Long Functions | ChatService.sendMessage() | Hard to add avatar context | Extract Method | 2 hrs |
| Primitive Obsession | Field types using strings | Type safety for avatars | Replace with Value Objects | 4 hrs |
| Feature Envy | Components accessing services | Coupling prevents isolation | Move Method | 3 hrs |
| Duplicated Code | Chat/Field sync logic | Multiple avatar sync issues | Extract Shared Service | 6 hrs |
| Large Class | AIAssistant component | Hard to extend for avatars | Split into smaller components | 8 hrs |

**Mitigation Strategies:**
- **Week 0:** 1-week dedicated refactoring sprint before V2
- **Test Coverage:** Ensure >70% on critical paths
- **Boy Scout Rule:** Clean code as you touch it
- **Technical Debt Register:** Track and prioritize issues

**Success Metrics:**
- Code complexity reduced by 30%
- Test coverage increased to 70%+
- No critical smells in V2 paths
- Estimated ROI: 50% reduction in V2 implementation time

### 2. User Adoption Risk (HIGH)

**Potential Impact:**
- Low adoption rates (<30%)
- Increased support burden
- Revenue impact if users churn

**Mitigation Strategies:**
- Feature flag rollout with opt-in
- Interactive onboarding tour
- Maintain v1 access for 60 days
- Share ROI testimonials prominently
- Dedicated v2 help resources

### 3. AI Reliability Risk (HIGH)

**Potential Impact:**
- User frustration and abandonment
- Invalid avatar data
- Loss of trust in AI recommendations

**Mitigation Strategies:**
- Fallback mechanisms during outages
- Confidence indicators for extractions
- Manual override always available
- Citation verification for book references
- Response caching to reduce API dependency

### 4. Data Migration Risk (MEDIUM)

**Potential Impact:**
- User data loss
- System downtime
- Corrupted avatar profiles

**Mitigation Strategies:**
- Additive migrations only (no breaking changes)
- Automated testing of migration scripts
- Full backup before migration
- Instant rollback capability
- Phased migration in small batches

### 5. Performance Risk (MEDIUM)

**Potential Impact:**
- Poor user experience
- Increased infrastructure costs
- Mobile users abandon app

**Mitigation Strategies:**
- Lazy loading (only active avatar data)
- Pagination for chat history
- Compression for payloads
- CDN usage for static assets
- Performance budget: <3s page load

### 6. Security Risk (MEDIUM)

**Potential Impact:**
- Data breach
- Compliance violations (GDPR/CCPA)
- Reputation damage

**Mitigation Strategies:**
- RLS enforcement (row-level security)
- Input sanitization for all user inputs
- Prompt injection prevention
- File upload scanning
- Penetration testing before launch

### Risk Response Planning

| Risk Trigger | Response Plan | Owner | Timeline |
|--------------|--------------|-------|----------|
| API errors >1% | Activate fallback mode | Dev Team | Immediate |
| Adoption <30% | Launch user research | Product | Week 1 |
| Performance >3s | Emergency optimization | Dev Team | 24 hours |
| Security incident | Incident response protocol | Security | Immediate |

### Go/No-Go Criteria

**Launch Requirements:**
- [ ] Week 0 refactoring complete
- [ ] All P0 features functional
- [ ] Performance <3s page load
- [ ] Security audit passed
- [ ] 70%+ test coverage for critical paths
- [ ] Trevor's approval on beta

## Detailed Requirements

### Functional Requirements

#### FR1: Multi-Avatar Management

**FR1.1 Avatar Creation**
- System SHALL allow users to create unlimited avatars per brand
- System SHALL provide avatar templates based on common ecommerce personas
- System SHALL auto-generate unique avatar names if not provided
- System SHALL support avatar duplication for variation testing
- System SHALL maintain avatar creation history with timestamps

**FR1.2 Avatar Switching**
- System SHALL display avatar tabs on mobile (bottom) and desktop (top)
- System SHALL indicate active avatar with visual highlight
- System SHALL ask the user whether to preserve chat context when switching between avatars
- System SHALL show avatar completion percentage in tab

**FR1.3 Avatar Comparison**
- System SHALL provide side-by-side avatar comparison view
- System SHALL highlight field differences between avatars
- System SHALL allow bulk field editing across avatars
- System SHALL export comparison reports

#### FR2: Book-Guided Chat System

**FR2.1 Chat Workflow**
- System SHALL follow the 11-chapter progression of "What Captures The Heart Goes In The Cart"
- System SHALL present stage-appropriate questions based on current book chapter
- System SHALL allow users to skip or revisit any stage
- System SHALL show current position in book progression (Chapter 3 of 11)
- System SHALL provide chapter summaries before each stage

**FR2.2 Field Population**
- System SHALL extract field values from natural language chat responses
- System SHALL populate relevant fields in real-time during conversation
- System SHALL show field update animations when values change
- System SHALL maintain mapping between chat responses and field values
- System SHALL respect manual edits as higher priority than AI suggestions

**FR2.3 Context Awareness**
- System SHALL reference previously populated fields in subsequent questions
- System SHALL adapt questions based on brand documentation uploaded
- System SHALL remember conversation context across sessions, keeping context across avatars separated by default
- System SHALL provide conversation search and history

#### FR3: Manual Field Editing

**FR3.1 Field Editor Interface**
- System SHALL provide inline field editing on all platforms
- System SHALL auto-save field changes within 2 seconds
- System SHALL validate field inputs based on type (email, URL, number ranges)
- System SHALL provide field-specific help text and examples
- System SHALL support rich text for long-form fields

**FR3.2 Edit Prioritization**
- System SHALL mark manually edited fields with visual indicator (✏️)
- System SHALL preserve manual edits when AI suggests updates (offer to the user to approve or reject updates)
- System SHALL ask permission before overwriting manual edits
- System SHALL maintain edit history for each field per avatar
- System SHALL allow reverting to previous field values per avatar

**FR3.3 Bulk Operations**
- System SHALL support copying fields between avatars
- System SHALL allow resetting fields to defaults
- System SHALL provide field templates for common values
- System SHALL support find-and-replace across fields
- System SHALL support auto-populating fields common across avatars based on brand documentation provided

#### FR4: Document Management

**FR4.1 Document Upload**
- System SHALL accept PDF, DOCX, TXT file formats
- System SHALL support image processing (and image file formats)
- System SHALL extract text from uploaded documents
- System SHALL parse brand guides for voice and positioning
- System SHALL limit file size to 20MB per document
- System SHALL store documents per brand (shared across avatars)

**FR4.2 Strategy Document Generation**
- System SHALL generate concise, practical brand strategy documents per avatar
- System SHALL respect manual field edits in generation
- System SHALL provide multiple export formats (PDF, Markdown)
- System SHALL maintain document version history

#### FR5: Performance Tracking

**FR5.1 Metrics Entry**
- System SHALL provide manual metric entry forms per avatar
- System SHALL support common metrics (CTR, CPA, ROAS, Conversion Rate)
- System SHALL allow custom metric definitions
- System SHALL track metrics by deployment channel
- System SHALL support bulk metric import via CSV

**FR5.2 ROI Calculation**
- System SHALL calculate performance lift vs baseline
- System SHALL generate ROI reports per avatar
- System SHALL identify winning avatars based on performance
- System SHALL provide performance trend visualizations
- System SHALL support testimonial generation from results

### Non-Functional Requirements

#### NFR1: Performance

**NFR1.1 Response Times**
- Chat responses SHALL appear within 2 seconds (95th percentile)
- Field saves SHALL complete within 500ms
- Avatar switching SHALL complete within 300ms
- Document generation SHALL complete within 5 seconds
- Page load SHALL complete within 3 seconds on 4G

**NFR1.2 Scalability**
- System SHALL support 1000+ concurrent users
- System SHALL handle 100+ avatars per user
- System SHALL process 10,000+ chat messages per minute
- Database SHALL scale to 1M+ avatar records

#### NFR2: Reliability

**NFR2.1 Availability**
- System SHALL maintain 99.5% uptime
- System SHALL provide graceful degradation during outages
- System SHALL implement automatic failover for critical services
- System SHALL provide offline mode for field editing

**NFR2.2 Data Integrity**
- System SHALL prevent data loss with automatic backups
- System SHALL implement optimistic locking for concurrent edits
- System SHALL maintain data consistency across all interfaces
- System SHALL provide data export capabilities

#### NFR3: Usability

**NFR3.1 Mobile Optimization**
- Interface SHALL be fully functional on screens ≥375px wide
- Touch targets SHALL be minimum 44x44px
- System SHALL support common mobile gestures
- Forms SHALL use appropriate mobile keyboards

**NFR3.2 Accessibility**
- System SHALL meet WCAG 2.1 AA standards
- System SHALL provide keyboard navigation for all features
- System SHALL support screen readers
- System SHALL provide high contrast mode option

#### NFR4: Security

**NFR4.1 Authentication**
- System SHALL support email/password authentication
- System SHALL enforce password complexity requirements
- System SHALL implement rate limiting for auth attempts

**NFR4.2 Data Protection**
- System SHALL encrypt data at rest (AES-256)
- System SHALL use TLS 1.3 for data in transit
- System SHALL implement row-level security for multi-tenancy
- System SHALL comply with GDPR and CCPA requirements

#### NFR5: Integration

**NFR5.1 External Services**
- System SHALL integrate with OpenAI GPT-5.3 for chat
- System SHALL support Supabase for data persistence
- System SHALL implement Stripe for payments (future)
- System SHALL provide webhook endpoints for events

**NFR5.2 Analytics**
- System SHALL track user behavior via Posthog/Mixpanel
- System SHALL measure feature adoption rates
- System SHALL monitor performance metrics
- System SHALL generate usage reports

### Technical Requirements

#### TR1: Architecture
- Frontend: React 18+ with TypeScript
- State Management: React Query + Context (existing patterns)
- Field Persistence: usePersistedField hook (existing)
- Styling: Tailwind CSS with Shadcn/ui components
- Backend: Supabase (PostgreSQL + Auth + Realtime)
- AI: OpenAI API with streaming responses
- Hosting: Vercel or Netlify
- UI Layout: Two-panel responsive design (simplified from three-panel)

#### TR2: Browser Support
- Chrome 90+ (primary)
- Safari 14+ (iOS critical)
- Firefox 88+
- Edge 90+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)

#### TR3: Development Standards
- Code coverage: Minimum 70% for critical paths
- Lighthouse scores: Performance >85, Accessibility >95
- Bundle size: <500KB initial, <200KB per route
- TypeScript strict mode enabled
- ESLint + Prettier configuration

## Implementation Roadmap

### Roadmap Overview

```
Week 0: Refactoring Sprint
Week 1-2: Foundation & Infrastructure
Week 3-4: Core Multi-Avatar Features
Week 5-6: Advanced Features & Polish
Week 7-8: Testing & Beta Preparation
Week 9-10: Beta Launch & Iteration
```

### Phase 0: Pre-Implementation Refactoring Sprint (Week 0)

**Goal:** Clean technical debt blocking V2 implementation

**Day 1-2: Assessment & Planning**
- Run code smell analysis on critical paths
- Identify top 10 blockers for V2
- Create refactoring backlog
- Add characterization tests for legacy code
- Set up metrics baseline

**Day 3-4: Critical Path Refactoring**
- SupabaseChatService.ts - Extract methods
- usePersistedField.ts - Type safety improvements
- AIAssistant.tsx - Split components
- Extract shared sync service

**Day 5: Validation**
- Run full test suite
- Measure complexity reduction
- Document changes
- Merge to main

**Success Metrics:**
- Complexity reduced: 30%+
- Test coverage: 70%+
- Code smells eliminated: 50%+

### Phase 1: Foundation & Infrastructure (Weeks 1-2)

**Week 1: Database & Core Setup**
- Create brands, avatars, metrics tables
- Implement RLS policies
- Build Brand/Avatar services
- Create AvatarContext with React Query
- Set up testing foundation

**Week 2: UI Foundation**
- Adapt to TwoPanelTemplate
- Create AvatarTabSwitcher
- Implement responsive layouts
- Set up /v2/* routes
- Configure feature flags

### Phase 2: Core Multi-Avatar Features (Weeks 3-4)

**Week 3: Avatar Management**
- Avatar CRUD operations
- Avatar templates
- Field editor with inline editing
- Auto-save with debouncing
- Manual edit prioritization

**Week 4: Chat Integration**
- Book-guided chat flow
- Chapter progression tracking
- Field extraction pipeline
- Confidence scoring
- Real-time field sync

### Phase 3: Advanced Features (Weeks 5-6)

**Week 5: Performance Tracking**
- Metrics entry forms
- Channel selection
- ROI calculation
- Avatar comparison
- Export reports

**Week 6: Document Generation & Polish**
- Strategy document generation
- PDF/Markdown export
- UI polish and animations
- Mobile optimization
- Performance tuning

### Phase 4: Testing & Beta Prep (Weeks 7-8)

**Week 7: Testing Sprint**
- Unit tests: 80% coverage
- Integration tests
- E2E tests
- Performance testing
- Security audit
- Bug fixes

**Week 8: Beta Preparation**
- User documentation
- Video tutorials
- Feature flags setup
- Analytics configuration
- Error monitoring
- Beta tester recruitment

### Phase 5: Beta Launch (Weeks 9-10)

**Week 9: Beta Launch**
- Internal testing (Days 1-2)
- 10% rollout (Days 3-5)
- Monitor metrics
- Gather feedback

**Week 10: Beta Iteration**
- Priority bug fixes
- UI/UX improvements
- Performance optimizations
- ROI testimonial collection
- Production preparation

### Resource Allocation

| Phase | Frontend | Backend | QA | Design | PM |
|-------|----------|---------|----|---------|----|
| Refactoring | 100% | 100% | 50% | 0% | 20% |
| Foundation | 60% | 80% | 20% | 40% | 40% |
| Core | 80% | 60% | 40% | 20% | 30% |
| Advanced | 70% | 40% | 60% | 30% | 40% |
| Testing | 40% | 40% | 100% | 10% | 50% |
| Beta | 60% | 60% | 80% | 20% | 80% |

### Critical Path Items

**Must Have for Beta:**
1. Avatar creation and switching
2. Book-guided chat flow
3. Field extraction and editing
4. Performance metric tracking
5. Document generation

**Can Defer Post-Beta:**
1. Advanced analytics
2. Team collaboration
3. Voice input
4. API integrations

### Go-Live Checklist

**Technical:**
- [ ] All P0 features complete
- [ ] Performance <3s load time
- [ ] 80% test coverage
- [ ] Security audit passed

**Business:**
- [ ] Trevor's approval
- [ ] 10+ beta testers
- [ ] 3+ ROI testimonials
- [ ] Support docs ready

**Operational:**
- [ ] Monitoring configured
- [ ] Feature flags ready
- [ ] Rollback plan tested