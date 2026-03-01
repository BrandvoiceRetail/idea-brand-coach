# Claude Code Instructions - IDEA Brand Coach

> This file is mirrored across CLAUDE.md, AGENTS.md, and GEMINI.md so the same instructions load in any AI environment.

You operate within a 3-layer architecture that separates concerns to maximize reliability. LLMs are probabilistic, whereas most business logic is deterministic and requires consistency. This system fixes that mismatch.

## The 3-Layer Architecture

**Layer 1: Directive (What to do)**
- SOPs and instructions written in Markdown
- Define the goals, inputs, tools/scripts to use, outputs, and edge cases
- Natural language instructions, like you'd give a mid-level employee

**Layer 2: Orchestration (Decision making)**
- This is you. Your job: intelligent routing.
- Read directives, call execution tools in the right order, handle errors, ask for clarification
- You're the glue between intent and execution

**Layer 3: Execution (Doing the work)**
- Deterministic scripts and services
- Handle API calls, data processing, file operations, database interactions
- Reliable, testable, fast. Use scripts instead of manual work.

**Why this works:** if you do everything yourself, errors compound. 90% accuracy per step = 59% success over 5 steps. The solution is push complexity into deterministic code. That way you just focus on decision-making.

## Operating Principles

**1. Check for existing tools first**
Before writing new code, check existing components, hooks, and utilities. Only create new ones if none exist.

**2. Self-anneal when things break**
- Read error message and stack trace
- Fix the issue and test again
- Update documentation with what you learned (API limits, timing, edge cases)

**3. Update documentation as you learn**
When you discover constraints, better approaches, common errors, or timing expectations—update the relevant docs. Documentation is a living resource.

## Self-Annealing Loop

Errors are learning opportunities. When something breaks:
1. Fix it
2. Update the code/tool
3. Test to make sure it works
4. Update documentation to include new learnings
5. System is now stronger

---

## Project Overview

React/TypeScript/Vite application for AI-powered brand consulting using IDEA framework (Identify, Discover, Execute, Analyze). Built with shadcn-ui, Supabase, and LangChain RAG.

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
│   ├── ai/           # AI assistant components
│   └── research/     # Research tools
├── contexts/         # React Context providers
├── hooks/            # Custom React hooks
├── integrations/     # External service integrations (Supabase)
├── lib/              # Utility libraries
│   └── sync/         # Sync service utilities
├── pages/            # Route pages
├── services/         # Business logic services
│   ├── chat/         # Chat-specific services
│   └── interfaces/   # Service interfaces
├── types/            # TypeScript type definitions
├── utils/            # Helper functions
└── test/             # Test setup and utilities
```

## Refactoring Patterns

These patterns were established during the Pre-Implementation Refactoring Sprint (Task 017) and should be followed when refactoring existing code.

### Service Extraction Pattern

**When to apply:** Services exceeding 300 lines or handling multiple responsibilities

**Pattern:**
1. Extract specialized services for distinct responsibilities
2. Keep orchestration in the main service
3. Use dependency injection for service composition
4. Each service implements a focused interface

**Example: SupabaseChatService Refactoring**
```typescript
// Before: 583-line monolithic service
class SupabaseChatService {
  // Message CRUD + Session CRUD + Title generation + Orchestration
}

// After: Extracted to focused services (each ~200-270 lines)
class ChatMessageService {
  // Only message CRUD operations
  async saveMessage(message: Message): Promise<MessageResult<Message>>
  async getRecentMessages(limit: number): Promise<MessageResult<Message[]>>
  async getSessionMessages(sessionId: string): Promise<MessageResult<Message[]>>
}

class ChatSessionService {
  // Only session CRUD operations
  async createSession(userId: string): Promise<SessionResult<Session>>
  async getSessions(userId: string): Promise<SessionResult<Session[]>>
  async updateSession(sessionId: string, data: Partial<Session>): Promise<SessionResult<Session>>
}

class ChatTitleService {
  // Only title generation logic
  async maybeUpdateSessionTitle(sessionId: string): Promise<TitleResult<void>>
  async generateSessionTitle(messages: Message[]): Promise<TitleResult<string>>
}

// Orchestrator delegates to specialized services (351 lines)
class SupabaseChatService implements IChatService {
  constructor(
    private messageService: ChatMessageService,
    private sessionService: ChatSessionService,
    private titleService: ChatTitleService
  ) {}

  async sendMessage(message: string): Promise<void> {
    // Coordinate message save, edge function call, title generation
    await this.messageService.saveMessage(message);
    const response = await this.callEdgeFunction(message);
    await this.messageService.saveAssistantMessage(response);
    await this.titleService.maybeUpdateSessionTitle(this.currentSessionId);
  }
}
```

**Results:**
- SupabaseChatService reduced from 583 to 351 lines (40% reduction)
- Each service has a single, clear responsibility
- Easier to test and maintain
- Better code reusability

### Field Sync Architecture

**When to apply:** Managing local-first persistence with backend sync

**Pattern:**
1. Extract shared sync logic to a service (FieldSyncService)
2. Create generic hooks with type parameters
3. Separate concerns: state management vs. sync logic
4. Use singleton pattern for sync service to avoid multiple instances

**Example: Field Persistence Refactoring**
```typescript
// Before: 464-line hook with mixed concerns
function usePersistedField(key: string) {
  // State + IndexedDB + Sync + Singleton management all mixed together
}

// After: Extracted architecture

// 1. Shared sync service (singleton, 327 lines)
class FieldSyncService {
  private static instance: FieldSyncService;

  async saveField<T>(key: string, value: T): Promise<void>
  async loadField<T>(key: string): Promise<T | null>
  registerConnectionListener(callback: (isOnline: boolean) => void): void
  cleanup(): void
}

// 2. Generic sync hook (344 lines)
interface UseFieldSyncConfig<T> {
  key: string;
  defaultValue: T;
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
}

function useFieldSync<T>(config: UseFieldSyncConfig<T>) {
  const [value, setValue] = useState<T>(config.defaultValue);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Uses FieldSyncService for persistence
  // Returns: { value, setValue, isSyncing, isOnline }
}

// 3. Specialized hooks using generics
function usePersistedField<T = string>(
  key: string,
  defaultValue: T,
  serialize?: (value: T) => string,
  deserialize?: (value: string) => T
): UsePersistedFieldResult<T>

// 4. Extracted type-specific hooks (separate files)
// src/hooks/usePersistedArrayField.ts
function usePersistedArrayField<T>(
  key: string,
  defaultValue: T[]
): UsePersistedArrayFieldResult<T>
```

**Type Safety with Generics:**
```typescript
// String field (default)
const [name, setName] = usePersistedField<string>('name', '');

// Array field
const [tags, setTags] = usePersistedArrayField<string>('tags', []);

// Object field with custom serialization
const [profile, setProfile] = usePersistedField<UserProfile>(
  'profile',
  defaultProfile,
  (obj) => JSON.stringify(obj),
  (str) => JSON.parse(str)
);
```

**Results:**
- Clear separation between sync service and state hooks
- Type-safe with TypeScript generics
- Reusable sync logic across all field types
- Better testability and maintainability
- Reduced complexity by splitting concerns

### Component Composition Pattern

**When to apply:** Components exceeding 100 lines or handling multiple UI concerns

**Pattern:**
1. Extract focused sub-components for distinct UI responsibilities
2. Use composition to build the full component
3. Expose imperative handles with `forwardRef` when needed
4. Keep props interfaces minimal and focused

**Example: AIAssistant Component Split**
```typescript
// Before: 115-line component with mixed concerns
function AIAssistant({ prompt, onAccept }) {
  // Button UI + Loading state + Edge function invocation + Suggestion preview
}

// After: Extracted composition

// 1. Focused button component (37 lines)
interface AIButtonProps {
  onGenerate: () => void;
  isLoading: boolean;
}

export function AIButton({ onGenerate, isLoading }: AIButtonProps): JSX.Element {
  return (
    <Button onClick={onGenerate} disabled={isLoading}>
      {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
      Generate
    </Button>
  );
}

// 2. Suggestion handler component (105 lines)
export interface AISuggestionHandlerRef {
  generate: () => Promise<void>;
  isLoading: boolean;
}

interface AISuggestionHandlerProps {
  prompt: string;
  onAccept: (value: string) => void;
  onReject?: () => void;
}

export const AISuggestionHandler = forwardRef<AISuggestionHandlerRef, AISuggestionHandlerProps>(
  ({ prompt, onAccept, onReject }, ref) => {
    const [isLoading, setIsLoading] = useState(false);
    const [pendingSuggestion, setPendingSuggestion] = useState<string | null>(null);

    const handleGenerate = async (): Promise<void> => {
      setIsLoading(true);
      try {
        const result = await invokeEdgeFunction({ prompt });
        setPendingSuggestion(result);
      } finally {
        setIsLoading(false);
      }
    };

    useImperativeHandle(ref, () => ({
      generate: handleGenerate,
      isLoading
    }));

    return pendingSuggestion ? (
      <AISuggestionPreview
        suggestion={pendingSuggestion}
        onAccept={() => {
          onAccept(pendingSuggestion);
          setPendingSuggestion(null);
        }}
        onReject={() => {
          onReject?.();
          setPendingSuggestion(null);
        }}
      />
    ) : null;
  }
);

// 3. Composed orchestrator component (54 lines)
export function AIAssistant({ prompt, onAccept }: AIAssistantProps): JSX.Element {
  const handlerRef = useRef<AISuggestionHandlerRef>(null);

  return (
    <div>
      <AIButton
        onGenerate={() => handlerRef.current?.generate()}
        isLoading={handlerRef.current?.isLoading ?? false}
      />
      <AISuggestionHandler ref={handlerRef} prompt={prompt} onAccept={onAccept} />
    </div>
  );
}
```

**Results:**
- AIAssistant reduced from 115 to 54 lines (53% reduction)
- AIButton is reusable across different contexts
- AISuggestionHandler can be used independently
- Clear separation of concerns: UI vs. state vs. orchestration
- Better testability (each component can be tested in isolation)

### Refactoring Checklist

**Before starting a refactor:**
- [ ] Identify single responsibility violations (file > 300 lines is a red flag)
- [ ] Look for duplicated logic that can be extracted
- [ ] Check for mixed concerns (UI + business logic, state + sync, etc.)
- [ ] Verify existing tests to ensure backward compatibility
- [ ] Document current behavior before changes

**During refactoring:**
- [ ] Extract one responsibility at a time
- [ ] Add TypeScript types and generics for type safety
- [ ] Maintain backward compatibility (re-export from original location if needed)
- [ ] Write or update tests for extracted code
- [ ] Add comprehensive JSDoc documentation
- [ ] Run tests frequently to catch regressions early

**After refactoring:**
- [ ] Verify all tests pass
- [ ] Check TypeScript compilation (`npx tsc --noEmit`)
- [ ] Run linter (`npm run lint`)
- [ ] Verify bundle size hasn't increased significantly
- [ ] Update documentation (CLAUDE.md, component docs)
- [ ] Create migration guide if breaking changes are unavoidable

### Code Smell Indicators

Watch for these patterns that indicate refactoring is needed:

**Service Smells:**
- File exceeds 300 lines
- More than 10 public methods
- Private methods that could be separate services
- Multiple concerns in method names (e.g., `saveAndSyncAndNotify`)
- God object pattern (service knows too much)
- Duplicate code across methods

**Hook Smells:**
- File exceeds 200 lines
- Managing multiple independent pieces of state
- Mixing singleton logic with hook logic
- No generic type parameters for reusable data structures
- Multiple `useEffect` hooks with unrelated dependencies
- Complex conditional logic inside effects

**Component Smells:**
- File exceeds 150 lines
- Multiple `useEffect` hooks with different concerns
- Deeply nested JSX (> 3 levels)
- Business logic mixed with UI rendering
- Props drilling through multiple levels
- Large prop interfaces (> 10 props)

### Service Organization Pattern

When creating new services or refactoring existing ones:

**Directory Structure:**
```
src/services/
├── interfaces/           # Service contracts
│   ├── IChatService.ts
│   └── IAuthService.ts
├── chat/                # Chat domain services
│   ├── ChatMessageService.ts
│   ├── ChatSessionService.ts
│   └── ChatTitleService.ts
├── SupabaseChatService.ts   # Main orchestrator
└── SupabaseAuthService.ts   # Single-responsibility service
```

**Service Interface Pattern:**
```typescript
// Define contract first
export interface IChatService {
  sendMessage(message: string): Promise<void>;
  getChatHistory(limit?: number): Promise<Message[]>;
  clearChatHistory(): Promise<void>;
}

// Implement with composition
export class SupabaseChatService implements IChatService {
  constructor(
    private messageService: ChatMessageService,
    private sessionService: ChatSessionService,
    private titleService: ChatTitleService,
    private supabaseClient: SupabaseClient
  ) {}

  // Orchestrate specialized services
  async sendMessage(message: string): Promise<void> {
    // Delegate to specialized services
  }
}
```

**Benefits:**
- Clear contracts via interfaces
- Easy to test with mocks
- Can swap implementations
- Single Responsibility Principle (SRP)
- Open/Closed Principle (OCP)

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
