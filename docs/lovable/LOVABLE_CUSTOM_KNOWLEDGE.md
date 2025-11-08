# IDEA Brand Coach - Custom Knowledge for Lovable

## Project Overview

**Project Name:** IDEA Brand Coach
**Type:** AI-powered brand consulting SaaS application
**Status:** P0 Beta Launch (~83% complete, verified 2025-11-08)
**Phase:** Final Implementation & Testing
**Purpose:** Help businesses build strong brands using the IDEA framework (Identify, Discover, Execute, Analyze)

**Core Value Proposition:**
- Anonymous brand diagnostic assessment (6 questions)
- AI-powered brand consultant with personalized advice
- Document analysis and brand strategy recommendations

## Tech Stack

**Frontend:**
- React 18 with TypeScript
- Vite (build tool)
- shadcn-ui component library
- Tailwind CSS for styling
- React Router for navigation

**Backend:**
- Supabase (Authentication, Database, Edge Functions)
- LangChain for RAG (Retrieval-Augmented Generation)
- GPT-4 for AI consultant responses

**Testing:**
- Vitest for unit/component tests
- @testing-library/react for component testing
- Target: ≥85% code coverage

## User Flow

### 1. Anonymous Diagnostic Flow
1. User lands on homepage → clicks "Start Free Diagnostic"
2. Completes 6-question IDEA framework assessment (anonymous)
3. Receives preliminary results
4. Prompted to create account to save results and access Brand Coach
5. Account created → diagnostic data saved to Supabase

### 2. Authenticated Experience
1. User signs in (email/password or Google OAuth)
2. Access to Brand Coach GPT interface
3. Chat with AI consultant about brand strategy
4. Upload documents for analysis
5. View diagnostic history and progress

### 3. Brand Coach Interaction
1. AI provides personalized responses based on diagnostic scores
2. Suggested prompts appear based on user's brand weaknesses
3. Chat history persisted to Supabase
4. Document upload for deeper analysis (PDF, DOCX support)

## Design Guidelines

### UI/UX Principles
- **Mobile-first design** - All components must be fully responsive
- **Accessibility** - WCAG AA compliance minimum
- **Consistent spacing** - Use Tailwind spacing scale (4px base)
- **Loading states** - Always show loading indicators for async operations
- **Error handling** - User-friendly error messages with actionable guidance

### Component Library
- Use shadcn-ui components from `src/components/ui/`
- Customize with Tailwind classes, never inline styles
- Follow shadcn-ui patterns for consistency

### Color Scheme
- Primary: Blue/Indigo tones (from Tailwind palette)
- Accent: Complementary colors for CTAs
- Neutral: Gray scale for backgrounds and text
- Semantic: Green (success), Red (error), Yellow (warning)

### Typography
- Headings: Font weight 600-700
- Body: Font weight 400
- Use Tailwind typography utilities

## Coding Conventions

### Best Practices Framework
**Reference:** This project follows [@matthewkerns/software-development-best-practices-guide](https://github.com/MatthewKerns/software-development-best-practices-guide)

**Core Principles (MANDATORY):**

1. **Readability First** (`01-foundations/CODE_FORMATTING.md`)
   - Code is read 10x more than written - optimize for readability
   - Self-documenting code: Clear names > comments
   - One logical concept per line
   - Vertical spacing to separate logical sections
   - Consistent indentation (2 spaces for JS/TS)

2. **Single Responsibility Principle** (`03-clean-architecture/SOLID_PRINCIPLES.md`)
   - Each function/component does ONE thing well
   - If you use "and" to describe it, split it
   - Components: Single UI concern
   - Hooks: Single data/behavior concern
   - Utils: Single transformation/calculation

3. **DRY - Don't Repeat Yourself** (CRITICAL)
   - **BEFORE writing new code:** Search codebase for existing implementations
   - Use GitHub search, grep, or IDE find to locate similar patterns
   - **Checklist before creating new code:**
     ```
     [ ] Searched for similar function names (e.g., "format", "validate", "fetch")
     [ ] Checked utils/ directory for existing helpers
     [ ] Checked hooks/ directory for existing data logic
     [ ] Reviewed components/ for similar UI patterns
     [ ] If found similar code: Refactor to shared utility/hook instead of duplicating
     ```
   - Extract common patterns to utilities/hooks immediately
   - 3 strikes rule: If pattern appears 3x, refactor to shared code
   - When refactoring for reuse: Update all call sites, add TODO in P1 features

### TypeScript Rules
- **Strict mode enabled** - No implicit any
- **Explicit return types** for all functions
- **No `any` types** - Use `unknown` with type guards
- **Interface over type** for object shapes
- **Props interfaces** - Define for all components

### React Conventions
- **Functional components only** with hooks
- **Custom hooks** for reusable logic (prefix with `use`)
- **Props destructuring** with TypeScript interfaces
- **Context API** for global state (avoid prop drilling)
- **Memoization** only when performance issues identified

### Component Structure Pattern (Single Responsibility)
```typescript
// 1. Imports (React, external libs, internal)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useBrandData } from '@/hooks/useBrandData'; // Reuse existing hook

// 2. Type definitions/interfaces
interface ComponentProps {
  title: string;
  onAction: (id: string) => void;
}

// 3. Component definition (ONE responsibility: display brand title with action)
export function Component({ title, onAction }: ComponentProps): JSX.Element {
  // Hooks first
  const [state, setState] = useState<Type>(initialValue);

  // Event handlers (single responsibility: coordinate action)
  const handleAction = (id: string): void => {
    onAction(id);
  };

  // Render (if >50 lines, extract sub-components)
  return <div>{title}</div>;
}

// 4. Helper functions
// ❌ BAD: Keep complex logic in component
// ✅ GOOD: Extract to utils/ if >5 lines or reusable
```

**Readability Guidelines:**
```typescript
// ❌ BAD: Dense, hard to parse
const x=users.filter(u=>u.active&&u.verified).map(u=>({id:u.id,name:u.name})).sort((a,b)=>a.name.localeCompare(b.name));

// ✅ GOOD: Readable, clear intent
const activeUsers = users.filter(user => user.active && user.verified);
const userSummaries = activeUsers.map(user => ({
  id: user.id,
  name: user.name,
}));
const sortedUsers = userSummaries.sort((a, b) =>
  a.name.localeCompare(b.name)
);

// ✅ BETTER: Extract to reusable function (DRY if used elsewhere)
const sortedUsers = getActiveUserSummaries(users);
```

### Naming Conventions (Readability)
**Principle:** Names should reveal intent without needing comments

```typescript
// ❌ BAD: Cryptic, requires comments
const d = 7; // days
const getData = () => {}; // What data?
const temp = user.n; // temp what? n what?

// ✅ GOOD: Self-documenting
const TRIAL_PERIOD_DAYS = 7;
const getBrandDiagnosticScores = () => {};
const userName = user.name;
```

**Conventions:**
- **Components:** PascalCase, noun phrase (`BrandDiagnostic.tsx`, `UserProfileCard.tsx`)
- **Hooks:** camelCase, `use` prefix, verb phrase (`useBrandData.ts`, `useFetchDiagnostic.ts`)
- **Utilities:** camelCase, verb phrase (`formatDate.ts`, `calculateScore.ts`)
- **Constants:** UPPER_SNAKE_CASE (`API_ENDPOINTS`, `MAX_FILE_SIZE_MB`)
- **Types/Interfaces:** PascalCase, noun (`BrandProfile`, `DiagnosticResponse`)
- **Event handlers:** `handle` prefix + verb (`handleSubmit`, `handleScoreChange`)
- **Boolean props:** `is/has/can/should` prefix (`isLoading`, `hasError`, `canEdit`, `shouldValidate`)

### File Organization
```
src/
├── components/        # React components
│   ├── ui/           # shadcn-ui components (DO NOT MODIFY)
│   ├── brand/        # Brand-specific components
│   └── research/     # Research tool components
├── contexts/         # React Context providers
├── hooks/            # Custom React hooks
├── integrations/     # External services (Supabase)
├── lib/              # Utility libraries
├── pages/            # Route pages
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
└── test/             # Test setup and utilities
```

## Backend & Data Models

### Supabase Integration

**Authentication:**
- Email/password sign-up and sign-in
- Google OAuth (optional)
- Session management via Supabase Auth
- Protected routes via `ProtectedRoute` component

**Database Tables:**
- `profiles` - User profile data
- `diagnostic_responses` - Brand diagnostic results
- `chat_history` - Brand Coach conversation history
- `documents` - Uploaded documents for analysis

**Edge Functions:**
- `idea-framework-consultant` - GPT-4 consultant with LangChain RAG
- Document processing and embeddings generation

**Client Usage:**
```typescript
import { supabase } from '@/integrations/supabase/client';

// Always handle errors
const { data, error } = await supabase
  .from('table')
  .select('*');

if (error) {
  console.error('Database error:', error);
  toast.error('Failed to load data');
  return null;
}
```

### Data Access Patterns
- Use Supabase client from `src/integrations/supabase/client.ts`
- Type-safe queries with generated types: `src/integrations/supabase/types.ts`
- **Never modify generated types manually**
- Handle errors gracefully with user-friendly messages
- Use toast notifications for user feedback (sonner library)

## Security & Privacy

### Data Protection
- Never log sensitive user data (emails, passwords, personal info)
- Use environment variables for all secrets
- Validate all user inputs with Zod schemas
- Sanitize data before database operations

### Authentication
- Supabase handles token management
- Protected routes enforce authentication
- Session refresh handled automatically
- Logout clears all client-side data

### API Security
- Edge functions require authentication headers
- Rate limiting on API endpoints
- Input validation on all Edge Functions

## Error Handling Standards

### User-Facing Errors
```typescript
import { toast } from 'sonner';

// Good: Clear, actionable message
toast.error('Failed to save your response. Please try again.');

// Bad: Technical jargon
toast.error('Error: SUPABASE_AUTH_TOKEN_INVALID');
```

### Error Logging
```typescript
try {
  // operation
} catch (error) {
  // Log full details for debugging
  console.error('Operation failed:', error);

  // Show user-friendly message
  toast.error('Something went wrong. Please try again.');

  // Return safe fallback
  return null;
}
```

### Loading & Error States
- Always show loading indicators for async operations
- Handle network failures gracefully
- Provide retry mechanisms for failed operations
- Show skeleton loaders for better UX

## Testing Requirements

### Coverage Target
- Minimum 85% code coverage for all new code
- Focus on critical user paths first

### Test Types
- **Unit tests:** Pure functions, utilities, hooks
- **Component tests:** UI behavior with @testing-library/react
- **Integration tests:** Multiple components/features working together

### Test Structure
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('Component', () => {
  it('should render correctly', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Testing Guidelines
- Test user behavior, not implementation details
- Use accessible queries (`getByRole`, `getByLabelText`)
- Mock Supabase client in tests
- Test error states and loading states

## Performance Guidelines

### React Performance
- Lazy load routes: `React.lazy()` for route components
- Memoize expensive computations with `useMemo`
- Use `useCallback` for event handlers passed as props
- Avoid unnecessary re-renders (check with React DevTools)

### Bundle Optimization
- Code split at route level
- Tree-shakeable imports (named imports)
- Optimize images (WebP format, lazy loading)
- Monitor bundle size after builds

### Loading Performance
- Show loading skeletons for better perceived performance
- Prefetch critical data on route entry
- Cache Supabase queries when appropriate

## P0 Beta Launch Features (ACTIVE PRIORITY)

### 1. Brand Diagnostic Flow (~85% Complete)
- Route: `/free-diagnostic`
- Component: `FreeDiagnostic.tsx`
- **Status:** Mostly complete ✅
- ✅ 6-question IDEA framework assessment
- ✅ Anonymous access before account creation
- ✅ Score calculation with IDEA framework
- ✅ Database: `diagnostic_submissions` table with RLS policies
- ✅ Service layer: `SupabaseDiagnosticService` with `syncFromLocalStorage()`
- ✅ Hook: `useDiagnostic` with React Query integration
- ✅ Comprehensive tests for service and hook
- ❌ **TODO:** Replace BetaTesterCapture with auth modal (minor UI change)
- ❌ **TODO:** End-to-end testing of full flow

### 2. Authentication System (~90% Complete)
- **Status:** Nearly complete ✅
- ✅ Email/password sign-up and sign-in
- ✅ Google OAuth backend (`signInWithOAuth` method implemented)
- ✅ Profile auto-creation via database trigger
- ✅ Session management with Supabase Auth
- ✅ Protected route implementation via `ProtectedRoute`
- ✅ Password reset flow
- ✅ Validation with Zod schemas
- ✅ Service layer: `SupabaseAuthService`
- ✅ Hook: `useAuth`
- ✅ Comprehensive tests
- ❌ **TODO:** Add Google OAuth button to Auth.tsx UI (backend ready)
- ❌ **TODO:** Polish error messages and UX

### 3. Brand Coach GPT with RAG (~75% Complete)
- Route: `/brand-coach`
- Component: `BrandCoach.tsx`
- Edge Function: `brand-coach-gpt`
- **Status:** Core RAG system operational ✅
- ✅ Full chat UI with conversation history
- ✅ Database: `chat_messages` table with RLS policies
- ✅ Database: `user_knowledge_chunks` table with pgvector extension
- ✅ RAG implementation in Edge Function:
  - ✅ Embedding generation (text-embedding-ada-002)
  - ✅ Vector search (`match_user_documents` RPC)
  - ✅ Context retrieval and injection
- ✅ Service layer: `SupabaseChatService`
- ✅ Hook: `useChat` with React Query
- ✅ Persistent chat history in Supabase
- ✅ Diagnostic-based suggested prompts
- ✅ Edge Function: `sync-diagnostic-to-embeddings`
- ✅ GPT-4 integration with IDEA framework system prompt
- ✅ Comprehensive tests
- ❌ **TODO:** Document upload integration (UI exists, needs wiring)
- ❌ **TODO:** Advanced RAG prompting strategies
- ❌ **TODO:** Performance optimization for large chat histories

## P1 Features (DEFERRED - Post-Launch)

**IMPORTANT:** P1 features exist in the codebase but are LOW PRIORITY. Do NOT work on these unless explicitly requested.

### P1.1 - Advanced IDEA Framework Modules
**Routes:** `/idea/*` (insight, distinctive, empathy, authenticity)
**Components:** `IdeaInsight.tsx`, `IdeaDistinctive.tsx`, `IdeaEmpathy.tsx`, `IdeaAuthenticity.tsx`
**Status:** Exists but deferred to post-launch

### P1.2 - Avatar & Customer Research Tools
**Routes:** `/avatar`, `/research-learning`
**Components:** `AvatarBuilder.tsx`, `SurveyBuilder.tsx`, `CustomerReviewAnalyzer.tsx`
**Status:** Exists but deferred to post-launch

### P1.3 - Brand Canvas & Visual Tools
**Routes:** `/canvas`, `/value-lens`
**Components:** `BrandCanvas.tsx`, `ValueLens.tsx`
**Status:** Exists but deferred to post-launch

### P1.4 - Beta Journey & Feedback Flows
**Routes:** Various beta-specific flows
**Status:** Exists but deferred to post-launch

### TODO Protocol for P1 Features

When updating shared code (interfaces, utilities, hooks) that P1 features depend on:

**Example:**
```typescript
// src/hooks/useBrandData.ts (updated for P0 feature)
export function useBrandData() {
  // New implementation with improved error handling
  return { data, isLoading, error };
}

// src/components/research/CustomerReviewAnalyzer.tsx (P1 feature - DEFERRED)
function CustomerReviewAnalyzer() {
  // TODO: Update to use new useBrandData hook (see src/hooks/useBrandData.ts)
  // TODO: Replace manual error handling with new pattern
  // Old implementation - refactor when working on P1
  const [data, setData] = useState(null);
  // ... old code
}
```

**Rules:**
- Add TODO comments in P1 code when shared interfaces/utilities change
- Include reference to updated file/pattern
- Do NOT spend time implementing P1 features
- Keep TODOs actionable for future work

## External References

**Best Practices Guide:**
This project follows [@matthewkerns/software-development-best-practices-guide](https://github.com/MatthewKerns/software-development-best-practices-guide) installed via npm.

**Key Reference Guides (in node_modules):**
- Variable naming: `01-foundations/VARIABLE_NAMING.md`
- Function design: `01-foundations/FUNCTIONS_AND_ROUTINES.md`
- Error handling: `01-foundations/ERROR_HANDLING.md`
- TDD workflow: `04-quality-through-testing/TDD_WORKFLOW.md`
- SOLID principles: `03-clean-architecture/SOLID_PRINCIPLES.md`

**Project Documentation (Read these files from repository):**
- Roadmap: `P0_BETA_LAUNCH_ROADMAP.md`
- P0 Features: `docs/P0_FEATURES.md`
- P1 Features: `docs/P1_FEATURES.md`
- Architecture: `docs/TECHNICAL_ARCHITECTURE.md`
- Implementation: `docs/P0_IMPLEMENTATION_PLAN.md`

**Additional References in Repository:**
- DRY Checklist: `docs/lovable/DRY_CHECKLIST.md` (Pre-implementation checklist)
- Coding Conventions: `docs/lovable/02_CODING_CONVENTIONS.md` (Detailed TypeScript/React rules)
- Supabase Patterns: `docs/lovable/03_SUPABASE_PATTERNS.md` (Database patterns)
- UI Design System: `docs/lovable/04_UI_DESIGN_SYSTEM.md` (shadcn-ui + Tailwind)

**Note:** Lovable can read all files in your repository. When you need detailed guidance, prompt:
- "Read `docs/lovable/DRY_CHECKLIST.md` for DRY compliance checklist"
- "Check `docs/P1_FEATURES.md` for list of deferred features"
- "Reference `docs/TECHNICAL_ARCHITECTURE.md` for data flow patterns"

## Important Constraints

### What NOT to Do
- ❌ Never modify shadcn-ui components in `src/components/ui/` directly
- ❌ Never use inline styles - always use Tailwind classes
- ❌ Never use `any` type in TypeScript
- ❌ Never log sensitive user data
- ❌ Never commit environment variables or secrets
- ❌ Never modify generated Supabase types manually
- ❌ Never skip error handling for async operations
- ❌ **NEVER create duplicate code** - this is the most expensive mistake
- ❌ Never write code without searching for existing implementations first
- ❌ Never create functions >50 lines (split into smaller functions)
- ❌ Never create components with multiple responsibilities

### Best Practices to Follow (Priority Order)

**1. DRY - Search Before Creating (HIGHEST PRIORITY)**
```bash
# Before creating new function/component/hook, search:
grep -r "functionName" src/
# OR use IDE: Cmd+Shift+F (VS Code) / Cmd+Shift+O (cursor)

# Common search patterns:
grep -r "format" src/utils/          # Find existing formatters
grep -r "validate" src/utils/        # Find existing validators
grep -r "fetch" src/hooks/           # Find existing data fetchers
grep -r "use.*Data" src/hooks/       # Find existing data hooks
```

**2. Single Responsibility**
- ✅ One function = one task (if name has "and", split it)
- ✅ One component = one UI concern
- ✅ One hook = one data/behavior concern
- ✅ Extract logic >15 lines to separate function

**3. Readability**
- ✅ Meaningful names that explain purpose
- ✅ Vertical spacing between logical sections
- ✅ Extract complex conditionals to named variables
- ✅ One logical concept per line
- ✅ Comments explain WHY, not WHAT

**4. Code Quality Standards**
- ✅ Always use TypeScript with explicit types
- ✅ Always handle errors with user-friendly messages
- ✅ Always show loading states for async operations
- ✅ Always write tests for new features (≥85% coverage)
- ✅ Always use shadcn-ui components for UI consistency
- ✅ Always make components mobile-responsive
- ✅ Always use Supabase client for data operations

## Git Commit Guidelines

Follow Conventional Commits format:
```
type(scope): subject

body (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring (DRY improvements, extract to utils/hooks)
- `test`: Adding tests
- `docs`: Documentation updates
- `style`: Formatting changes
- `chore`: Maintenance tasks

**Examples:**
```
feat(diagnostic): add 6-question IDEA framework flow
fix(auth): resolve OAuth redirect issue
refactor(hooks): extract brand data logic to useBrandData hook (DRY)
refactor(utils): consolidate date formatting functions (reduce duplication)
test(components): add tests for BrandDiagnostic component
```

**When Refactoring for DRY:**
```
refactor(utils): extract duplicate validation logic to validateBrandInput

- Found 3 instances of similar validation logic
- Extracted to src/utils/validation.ts
- Updated call sites: FreeDiagnostic.tsx, BrandProfile.tsx
- Added TODO in CustomerReviewAnalyzer.tsx (P1 feature)
```

## Common Patterns in Codebase

### Form Handling
- React Hook Form for form state management
- Zod for validation schemas
- shadcn-ui Form components

### Data Fetching
```typescript
const { data, error, isLoading } = useQuery({
  queryKey: ['brand-data'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (error) throw error;
    return data;
  }
});
```

### State Management
- Local state: `useState` for component state
- Global state: `BrandContext` for brand-related data
- Server state: React Query for API data

### Toast Notifications
```typescript
import { toast } from 'sonner';

toast.success('Changes saved!');
toast.error('Failed to save changes');
toast.loading('Saving...');
```

## First Prompt Recommendation

Before making any changes, start with:
```
"Please review this Custom Knowledge and confirm you understand:
1. Tech stack: React 18, TypeScript, Vite, Supabase, shadcn-ui
2. P0 features: FreeDiagnostic, Auth, Brand Coach (NOT P1 features)
3. Best practices: Readability, Single Responsibility, DRY
4. MANDATORY: Search codebase before creating new functions/components
5. Coding conventions: TypeScript strict mode, naming patterns
6. Error handling and testing requirements (≥85% coverage)

Key workflow: Before creating ANY new code:
- Search for existing implementations (grep, IDE find)
- Check utils/ hooks/ components/ for similar patterns
- Reuse or refactor existing code instead of duplicating

Additional resources available in repository:
- Read `docs/lovable/DRY_CHECKLIST.md` for pre-implementation DRY checklist
- Read `docs/P1_FEATURES.md` for complete list of deferred P1 features
- Read `docs/TECHNICAL_ARCHITECTURE.md` for data flow and architecture

Then let me know if you have any questions before we begin."
```

---

**Last Updated:** 2025-11-08 (Comprehensive codebase audit completed)
**Project Phase:** P0 Beta Launch (Final Implementation & Testing)
**Overall Completion:** ~83% ✅

**Completion Breakdown:**
- Brand Diagnostic: 85% ✅ (UI ✅, Supabase ✅, syncFromLocalStorage ✅, tests ✅)
- Authentication: 90% ✅ (Auth ✅, OAuth backend ✅, service layer ✅, tests ✅)
- Brand Coach RAG: 75% ✅ (UI ✅, RAG operational ✅, embeddings ✅, chat persistence ✅)

**Already Implemented (contrary to roadmap docs):**
- ✅ Data Access Layer (complete service architecture with interfaces)
- ✅ RAG System (vector embeddings + semantic search operational)
- ✅ Database Schema (all tables created: diagnostic_submissions, chat_messages, user_knowledge_chunks)
- ✅ pgvector extension enabled
- ✅ Auth Integration (syncFromLocalStorage method exists and tested)
- ✅ Service Layer (all services implement interfaces, fully tested)

**Remaining Work (~17%):**
- Google OAuth UI button (backend ready)
- Replace BetaTesterCapture with modern auth modal
- Document upload wiring
- End-to-end integration testing
- Performance optimization
- Production deployment configuration
