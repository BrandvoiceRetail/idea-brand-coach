# Claude Code Instructions - IDEA Brand Coach

React/TypeScript/Vite application for AI-powered brand consulting using IDEA framework (Identify, Discover, Execute, Analyze). Built with shadcn-ui, Supabase, and LangChain RAG.

## Project Overview

**Tech Stack:** React 18, TypeScript, Vite, Supabase, shadcn-ui, Tailwind CSS, LangChain
**Architecture:** Frontend SPA with Supabase backend (Auth, Database, Edge Functions)
**Status:** P0 Beta Launch (~60% complete) - See `P0_BETA_LAUNCH_ROADMAP.md`

## Development Environment

```bash
# Setup
npm install

# Development server
npm run dev

# Build
npm run build

# Preview production build
npm run preview

# Linting
npm run lint

# Testing
npm test
```

## Best Practices Reference

This project follows **[@matthewkerns/software-development-best-practices-guide](https://github.com/MatthewKerns/software-development-best-practices-guide)** (installed via GitHub Packages).

### Key Guides Referenced

**Core Foundations:**
- Variable naming: `node_modules/@matthewkerns/software-development-best-practices-guide/01-foundations/VARIABLE_NAMING.md`
- Function design: `node_modules/@matthewkerns/software-development-best-practices-guide/01-foundations/FUNCTIONS_AND_ROUTINES.md`
- Error handling: `node_modules/@matthewkerns/software-development-best-practices-guide/01-foundations/ERROR_HANDLING.md`
- Code formatting: `node_modules/@matthewkerns/software-development-best-practices-guide/01-foundations/CODE_FORMATTING.md`

**Testing & Quality:**
- TDD workflow: `node_modules/@matthewkerns/software-development-best-practices-guide/04-quality-through-testing/TDD_WORKFLOW.md`
- Unit testing: `node_modules/@matthewkerns/software-development-best-practices-guide/04-quality-through-testing/UNIT_TESTING_PRINCIPLES.md`
- Test design patterns: `node_modules/@matthewkerns/software-development-best-practices-guide/04-quality-through-testing/TEST_DESIGN_PATTERNS.md`

**Design & Architecture:**
- SOLID principles: `node_modules/@matthewkerns/software-development-best-practices-guide/03-clean-architecture/SOLID_PRINCIPLES.md`
- Component principles: `node_modules/@matthewkerns/software-development-best-practices-guide/03-clean-architecture/COMPONENT_PRINCIPLES.md`
- Class design: `node_modules/@matthewkerns/software-development-best-practices-guide/02-design-in-code/CLASS_DESIGN.md`

**Quick References (Daily Use):**
- `node_modules/@matthewkerns/software-development-best-practices-guide/99-reference/VARIABLE_NAMING_CHECKLIST.md`
- `node_modules/@matthewkerns/software-development-best-practices-guide/99-reference/FUNCTION_DESIGN_CHECKLIST.md`
- `node_modules/@matthewkerns/software-development-best-practices-guide/99-reference/CODE_REVIEW_CHECKLIST.md`
- `node_modules/@matthewkerns/software-development-best-practices-guide/99-reference/TDD_QUICK_REFERENCE.md`

## Code Quality Standards

### TypeScript Guidelines
- Strict mode enabled
- Explicit return types for all functions
- No `any` types (use `unknown` with type guards)
- Interface over type for object shapes
- Prefer functional components with hooks

### React Best Practices
- Functional components with TypeScript
- Custom hooks for reusable logic (prefix with `use`)
- Props destructuring with TypeScript interfaces
- Avoid prop drilling - use Context API when needed
- Memoization (`useMemo`, `useCallback`) only when necessary

### Component Structure
```typescript
// 1. Imports (React, external libs, internal modules)
// 2. Type definitions/interfaces
// 3. Component definition
// 4. Helper functions (if small, otherwise extract to utils/)
// 5. Export

interface ComponentProps {
  title: string;
  onAction: (id: string) => void;
}

export function Component({ title, onAction }: ComponentProps): JSX.Element {
  // Hooks first
  const [state, setState] = useState<Type>(initialValue);

  // Event handlers
  const handleAction = (id: string): void => {
    onAction(id);
  };

  // Render
  return <div>{title}</div>;
}
```

### Naming Conventions
- Components: PascalCase (`BrandDiagnostic.tsx`)
- Hooks: camelCase with `use` prefix (`useBrandData.ts`)
- Utilities: camelCase (`formatDate.ts`)
- Constants: UPPER_SNAKE_CASE (`API_ENDPOINTS.ts`)
- Types/Interfaces: PascalCase (`BrandProfile`)

### File Organization
```
src/
├── components/        # React components
│   ├── ui/           # shadcn-ui components
│   ├── brand/        # Brand-specific components
│   └── research/     # Research tools
├── contexts/         # React Context providers
├── hooks/            # Custom React hooks
├── integrations/     # External service integrations (Supabase)
├── lib/              # Utility libraries
├── pages/            # Route pages
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
└── test/             # Test setup and utilities
```

## Testing Requirements

### Test Coverage
- Target: ≥85% coverage for all new code
- Unit tests for utilities and hooks
- Component tests for UI logic
- Integration tests for data flows

### Test Structure
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Component } from './Component';

describe('Component', () => {
  it('should render with title', () => {
    render(<Component title="Test" onAction={() => {}} />);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should call onAction when clicked', () => {
    const mockAction = vi.fn();
    render(<Component title="Test" onAction={mockAction} />);
    fireEvent.click(screen.getByRole('button'));
    expect(mockAction).toHaveBeenCalledTimes(1);
  });
});
```

### Test Markers
- Unit tests: Pure logic, no external dependencies
- Component tests: UI behavior with @testing-library/react
- Integration tests: Multiple components/services working together

**Run tests:**
```bash
npm test           # Run all tests
npm run test:ui    # Run with Vitest UI
```

## Supabase Integration

### Database Access Pattern
- Use Supabase client from `src/integrations/supabase/client.ts`
- Type-safe queries with generated types from `src/integrations/supabase/types.ts`
- Handle errors gracefully with user-friendly messages

### Authentication
- Supabase Auth for email/password and OAuth
- Protected routes via `ProtectedRoute` component
- Session management with `BrandContext`

### Edge Functions
- LangChain-based RAG in `idea-framework-consultant` function
- Document processing and embeddings
- GPT-4 consultant responses

## DRY Compliance & Code Reuse

**MANDATORY: Search before implementing**
- Check existing components before creating new ones
- Reuse shadcn-ui components from `src/components/ui/`
- Extract repeated patterns to custom hooks or utilities
- No duplicate logic - refactor immediately

**Common patterns already implemented:**
- Form handling: React Hook Form + Zod validation
- Data fetching: Supabase client with error handling
- UI components: shadcn-ui + Tailwind CSS
- State management: React Context (BrandContext)

## Error Handling

### Frontend Error Patterns
```typescript
// API calls
try {
  const { data, error } = await supabase
    .from('table')
    .select('*');

  if (error) throw error;
  return data;
} catch (error) {
  console.error('Operation failed:', error);
  toast.error('Failed to load data. Please try again.');
  return null;
}

// Component error boundaries
// Use React Error Boundary for component-level errors
```

### User-Facing Errors
- Use `sonner` toast for notifications
- Clear, actionable error messages
- No technical jargon in user messages
- Log detailed errors to console for debugging

## Git Workflow & Commits

### Commit Message Format
Follow Conventional Commits:
```
type(scope): subject

body (optional)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `test`: Adding tests
- `docs`: Documentation
- `style`: Formatting, no code change
- `chore`: Maintenance tasks

**Examples:**
```bash
git commit -m "feat(diagnostic): add 6-question IDEA framework flow

- Implement FreeDiagnostic component
- Add question validation
- Save responses to Supabase
- Trigger account creation on completion

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Branch Strategy
- `main`: Production-ready code
- `feature/[name]`: New features
- `fix/[name]`: Bug fixes
- `refactor/[name]`: Code improvements

## Project-Specific Patterns

### P0 Beta Launch Features
Current focus (see `P0_BETA_LAUNCH_ROADMAP.md`):
1. **Brand Diagnostic Flow** - 6-question IDEA assessment
2. **Authentication System** - Email/password + Google OAuth
3. **Brand Coach GPT with RAG** - AI consultant with personalized responses

### Data Flow Architecture
See `docs/TECHNICAL_ARCHITECTURE.md` for complete data flow:
- Repository Pattern for data access
- LangChain RAG pipeline for AI responses
- Supabase for persistence and auth

### shadcn-ui Component Usage
- All UI components in `src/components/ui/`
- Customizable with Tailwind classes
- Follow shadcn-ui patterns for consistency

## Development Workflow

### Adding New Features
1. Read relevant best practices guides (see references above)
2. Check existing implementations for reusable patterns
3. Create component/hook with TypeScript types
4. Write tests (TDD preferred)
5. Implement feature with proper error handling
6. Update documentation if needed
7. Commit with conventional commit message

### Code Review Checklist
Reference: `node_modules/@matthewkerns/software-development-best-practices-guide/99-reference/CODE_REVIEW_CHECKLIST.md`
- TypeScript types defined and correct
- No `any` types
- Error handling implemented
- Tests written and passing
- No duplicate code (DRY compliant)
- Component follows React best practices
- Accessible UI (ARIA labels where needed)

## Performance Considerations

### React Performance
- Lazy load routes with `React.lazy()`
- Memoize expensive computations
- Avoid unnecessary re-renders
- Use `useCallback` for event handlers passed as props

### Bundle Size
- Code splitting at route level
- Tree-shakeable imports
- Optimize images and assets
- Monitor bundle size with `npm run build`

## Security & Privacy

### Data Handling
- Never log sensitive user data
- Use environment variables for secrets
- Validate all user inputs (Zod schemas)
- Sanitize data before database operations

### Authentication
- Supabase handles session management
- Protected routes for authenticated content
- Refresh tokens handled automatically

## Documentation Requirements

### Component Documentation
- JSDoc comments for complex components
- Props interface with descriptions
- Usage examples for shared components

### Update Documentation When
- Adding new features (update roadmap docs)
- Changing architecture (update TECHNICAL_ARCHITECTURE.md)
- Modifying data flows
- Adding new integrations

## Common Commands

```bash
# Development
npm run dev                  # Start dev server (Vite)
npm run build                # Production build
npm run preview              # Preview production build

# Quality
npm run lint                 # ESLint check
npm test                     # Run tests
npm run test:ui              # Vitest UI

# Type checking
npx tsc --noEmit            # Type check without build
```

## References

- **Project Roadmap:** `P0_BETA_LAUNCH_ROADMAP.md`
- **Technical Architecture:** `docs/TECHNICAL_ARCHITECTURE.md`
- **P0 Features:** `docs/P0_FEATURES.md`
- **Implementation Plan:** `docs/P0_IMPLEMENTATION_PLAN.md`
- **Best Practices Guide:** `node_modules/@matthewkerns/software-development-best-practices-guide/`

## Quick Tips

- Use shadcn-ui components from `src/components/ui/` for consistency
- Check `BrandContext` before adding new global state
- Supabase types are auto-generated - don't modify manually
- Follow existing patterns in codebase for consistency
- When in doubt, reference the best practices guide
- Test locally before committing
- Keep components focused and single-responsibility

---

**Remember:** Write code that is readable, maintainable, and follows the established patterns in this codebase. Consult the best practices guide for detailed guidance on specific topics.
