# Quick Start - Custom Knowledge for Lovable

> **Tip from Lovable Docs:** "Start small. Even a few lines can make a meaningful difference."

## Project Overview (Copy & Paste First)

```
IDEA Brand Coach - AI-powered brand consulting SaaS
Status: P0 Beta Launch (~60% complete)
Stack: React 18 + TypeScript + Vite + Supabase + shadcn-ui + Tailwind CSS

P0 Features (ACTIVE PRIORITY - Beta Launch):
1. Anonymous brand diagnostic (6 questions via FreeDiagnostic)
2. Authentication (email/password + Google OAuth)
3. AI Brand Coach with RAG (LangChain + GPT-4 via /brand-coach)

P1 Features (DEFERRED - Post-Launch):
- Advanced IDEA modules (/idea/insight, /idea/distinctive, etc.)
- Avatar Builder (/avatar)
- Research tools (SurveyBuilder, CustomerReviewAnalyzer)
- Brand Canvas (/canvas)
- Value Lens (/value-lens)
- Beta Journey flows

IMPORTANT: P1 features exist in codebase but are LOW PRIORITY.
When updating shared code (interfaces, utilities, hooks):
- Leave TODO comments in P1 feature code if updates needed
- Example: "// TODO: Update to use new useBrandData hook (see src/hooks/useBrandData.ts)"
- Do NOT spend time implementing P1 features unless explicitly requested

Purpose: Help businesses build brands using IDEA framework (Identify, Discover, Execute, Analyze)
```

## Coding Conventions (Essential Rules)

```
TypeScript:
- Strict mode, explicit return types, NO any types
- Interface over type for objects
- Props interfaces for all components

React:
- Functional components only with hooks
- Custom hooks: use prefix (useBrandData)
- No prop drilling - use BrandContext
- PascalCase: Components (BrandDiagnostic.tsx)
- camelCase: hooks (useBrandData.ts), utils (formatDate.ts)

Components Structure:
1. Imports
2. Type definitions
3. Component definition (hooks first, then handlers, then render)
4. Export

File Organization:
- src/components/ui/ = shadcn-ui (DO NOT MODIFY)
- src/components/brand/ = brand-specific
- src/hooks/ = custom hooks
- src/contexts/ = Context providers
```

## Supabase Patterns

```typescript
// Always use this pattern:
const { data, error } = await supabase
  .from('table')
  .select('*');

if (error) {
  console.error('Error:', error);
  toast.error('User-friendly message here');
  return null;
}

// Key points:
- Import from: src/integrations/supabase/client.ts
- Types from: src/integrations/supabase/types.ts (DO NOT MODIFY)
- Always show loading states
- Always handle errors with toast notifications
```

## Design Guidelines

```
Mobile-First: All components must be responsive
Accessibility: WCAG AA minimum
Component Library: shadcn-ui from src/components/ui/
Styling: Tailwind classes only (NO inline styles)
Colors: Blue/Indigo primary, semantic colors for states
Loading: Always show loading indicators/skeletons
Errors: User-friendly messages (no technical jargon)
```

## Testing Requirements

```
Coverage: ≥85% for new code
Test Types:
- Unit: pure functions, hooks, utilities
- Component: @testing-library/react
- Integration: multiple features together

Pattern:
describe('Component', () => {
  it('should render correctly', () => {
    render(<Component title="Test" />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

## Security Rules

```
❌ NEVER:
- Log sensitive data (emails, passwords)
- Commit secrets or .env files
- Modify shadcn-ui components directly
- Use any type in TypeScript
- Skip error handling on async operations
- Create duplicate code
- Work on P1 features unless explicitly requested

✅ ALWAYS:
- Validate inputs with Zod
- Use environment variables for secrets
- Handle errors with user-friendly messages
- Check existing code before creating new
- Use TypeScript with explicit types
- Focus on P0 features (Diagnostic, Auth, Brand Coach)
- Add TODOs in P1 code when updating shared interfaces/utilities
```

## User Flow Summary (P0 Only)

```
P0 FLOW (FOCUS ON THIS):
Anonymous → FreeDiagnostic (6 questions) → Create Account → Brand Coach GPT

1. Anonymous Diagnostic (P0):
   - Route: /free-diagnostic
   - Component: FreeDiagnostic.tsx
   - 6 IDEA framework questions
   - Results preview
   - Prompt to create account

2. Authenticated (P0):
   - Sign in (email or Google)
   - Access Brand Coach GPT at /brand-coach
   - Upload documents (if implemented)
   - View diagnostic history

3. Brand Coach (P0):
   - Route: /brand-coach
   - Component: IdeaFrameworkConsultant.tsx
   - AI responses based on diagnostic scores
   - Suggested prompts for weaknesses
   - Persistent chat history
   - Edge function: idea-framework-consultant

P1 ROUTES (EXISTS BUT DEFERRED - ADD TODOs IF UPDATING SHARED CODE):
- /idea/* - Advanced IDEA modules
- /avatar - Avatar Builder
- /canvas - Brand Canvas
- /value-lens - Value Lens
- /research-learning - Research tools
```

## Common Patterns Already Implemented

```
Forms: React Hook Form + Zod validation
State: BrandContext for global brand state
Routing: React Router with ProtectedRoute
Notifications: sonner toast library
Auth: Supabase Auth with session management

WHEN UPDATING SHARED CODE (hooks, utilities, interfaces):
Example - If you update a hook used by both P0 and P1 features:

// src/hooks/useBrandData.ts (P0 feature)
export function useBrandData() {
  // Updated implementation
  return { data, isLoading, error };
}

// src/components/research/CustomerReviewAnalyzer.tsx (P1 feature - DEFERRED)
function CustomerReviewAnalyzer() {
  // TODO: Update to use new useBrandData hook (see src/hooks/useBrandData.ts)
  // Old implementation still here - refactor when working on P1
  const [data, setData] = useState(null);
  ...
}
```

## First Prompt Recommendation

```
Before writing code, please confirm you understand:
1. Tech stack: React 18, TypeScript, Vite, Supabase, shadcn-ui
2. P0 focus: Diagnostic flow, Auth, AI Brand Coach
3. Coding rules: Strict TypeScript, mobile-first, ≥85% test coverage
4. Patterns: Supabase client, toast errors, shadcn-ui components

Any questions before we start?
```

## Quick References

```
Docs:
- Roadmap: P0_BETA_LAUNCH_ROADMAP.md
- Features: docs/P0_FEATURES.md
- Architecture: docs/TECHNICAL_ARCHITECTURE.md

Best Practices (installed via npm):
- @matthewkerns/software-development-best-practices-guide
- Located in node_modules/@matthewkerns/software-development-best-practices-guide/
```

---

**Last Updated:** 2025-11-08
**Remember:** Start small, update as project evolves!
