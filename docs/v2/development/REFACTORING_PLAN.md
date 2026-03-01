# Week 0: Refactoring Sprint Plan

## Purpose
Clean critical technical debt blocking v2 implementation before starting new feature development.

## Audience
Development team preparing for v2 implementation.

## Prerequisites
- Access to codebase
- Understanding of v2 architecture requirements
- Testing environment setup

## Overview

The v2 implementation requires a clean foundation. This refactoring sprint addresses code smells that would complicate multi-avatar implementation and the two-panel responsive design.

## Code Smell Assessment

### Critical Refactorings for V2

| Code Smell | Location | Impact on V2 | Refactoring | Effort |
|------------|----------|--------------|-------------|--------|
| **Long Functions** | `ChatService.sendMessage()` | Hard to add avatar context | Extract Method | 2 hrs |
| **Primitive Obsession** | Field types using strings | Type safety for avatars | Replace with Value Objects | 4 hrs |
| **Feature Envy** | Components accessing services directly | Coupling prevents isolation | Move Method | 3 hrs |
| **Duplicated Code** | Chat/Field sync logic | Multiple avatar sync issues | Extract Shared Service | 6 hrs |
| **Large Class** | `AIAssistant` component | Hard to extend for avatars | Split into smaller components | 8 hrs |
| **Tight Coupling** | Direct Supabase calls in components | Testing difficulty | Repository Pattern | 6 hrs |
| **Missing Abstractions** | No field validation layer | Inconsistent validation | Create Validation Service | 4 hrs |

## Day-by-Day Plan

### Day 1-2: Assessment & Planning

**Day 1 Morning (4 hrs)**
```typescript
// Run code analysis
npm run analyze:complexity
npm run analyze:duplicates
npm run test:coverage

// Document current metrics
- Cyclomatic complexity per file
- Test coverage percentage
- Duplication percentage
```

**Day 1 Afternoon (4 hrs)**
- Identify top 10 blockers for v2
- Create refactoring backlog in priority order
- Add characterization tests for legacy code
- Set up metrics baseline

**Day 2 Morning (4 hrs)**
- Write tests for code to be refactored
- Ensure 100% coverage on refactoring targets
- Document expected behavior

**Day 2 Afternoon (4 hrs)**
- Create branch: `refactor/week-0-v2-prep`
- Set up CI to track complexity metrics
- Configure code quality gates

### Day 3-4: Critical Path Refactoring

**Day 3: Service Layer Refactoring**

```typescript
// BEFORE: Long function with mixed concerns
class SupabaseChatService {
  async sendMessage(message: string) {
    // 200+ lines of mixed logic
    // - validation
    // - avatar context
    // - field extraction
    // - database operations
    // - error handling
  }
}

// AFTER: Separated concerns
class SupabaseChatService {
  constructor(
    private validator: MessageValidator,
    private fieldExtractor: FieldExtractor,
    private repository: ChatRepository
  ) {}

  async sendMessage(message: string, avatarId: string) {
    const validated = await this.validator.validate(message);
    const context = await this.getAvatarContext(avatarId);
    const enriched = await this.enrichWithBookContent(validated, context);
    const fields = await this.fieldExtractor.extract(enriched);
    return await this.repository.save(enriched, fields);
  }

  private async getAvatarContext(avatarId: string) { /* ... */ }
  private async enrichWithBookContent(message: Message, context: Context) { /* ... */ }
}
```

**Day 3: Component Refactoring**

```typescript
// BEFORE: Large component with multiple responsibilities
const AIAssistant = () => {
  // 500+ lines
  // - chat logic
  // - field management
  // - UI rendering
  // - state management
};

// AFTER: Separated components
const AIAssistant = () => {
  return (
    <ChatProvider>
      <FieldProvider>
        <TwoPanelLayout
          left={<FieldEditor />}
          right={<ChatInterface />}
        />
      </FieldProvider>
    </ChatProvider>
  );
};
```

**Day 4: State Management Refactoring**

```typescript
// BEFORE: Prop drilling and scattered state
function App() {
  const [brand, setBrand] = useState();
  const [avatar, setAvatar] = useState();
  const [fields, setFields] = useState();
  // props passed down 5+ levels
}

// AFTER: Centralized state with context
const AvatarProvider = ({ children }) => {
  const [currentAvatarId, setCurrentAvatarId] = useState();
  const avatarsQuery = useQuery(['avatars']);

  return (
    <AvatarContext.Provider value={{
      avatars: avatarsQuery.data,
      currentAvatar: avatarsQuery.data?.find(a => a.id === currentAvatarId),
      switchAvatar: setCurrentAvatarId
    }}>
      {children}
    </AvatarContext.Provider>
  );
};
```

### Day 5: Validation & Documentation

**Morning (4 hrs)**
- Run full test suite
- Verify all tests pass
- Check performance benchmarks
- Measure complexity reduction

**Afternoon (4 hrs)**
- Document architectural changes
- Update development guidelines
- Create migration notes
- Merge to main branch

## Success Metrics

### Code Quality Metrics

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| **Cyclomatic Complexity** | >15 avg | <8 avg | TBD |
| **Test Coverage** | 45% | 70% | TBD |
| **Code Duplication** | 18% | <5% | TBD |
| **Largest Function** | 200+ lines | <50 lines | TBD |
| **Largest Component** | 500+ lines | <150 lines | TBD |

### Performance Metrics

| Metric | Before | Target | Actual |
|--------|--------|--------|--------|
| **Bundle Size** | 850KB | <600KB | TBD |
| **Initial Load** | 4.2s | <3s | TBD |
| **Re-render Time** | 32ms | <16ms | TBD |

## Risk Mitigation

### Potential Issues & Solutions

| Risk | Mitigation |
|------|------------|
| **Breaking existing features** | 100% test coverage before refactoring |
| **Merge conflicts** | Feature freeze during sprint |
| **Performance regression** | Benchmark before/after each change |
| **Incomplete refactoring** | Time-boxed with clear priorities |

## Specific Files to Refactor

### Priority 1 (Must Complete)
```
src/services/SupabaseChatService.ts
src/components/AIAssistant.tsx
src/hooks/usePersistedField.ts
src/utils/fieldSync.ts
```

### Priority 2 (Should Complete)
```
src/components/BrandDashboard.tsx
src/services/DocumentService.ts
src/hooks/useChat.ts
src/contexts/BrandContext.tsx
```

### Priority 3 (Nice to Have)
```
src/components/ui/field-editor.tsx
src/utils/validation.ts
src/services/MetricsService.ts
```

## Testing Strategy

### Before Refactoring
1. Add characterization tests to capture current behavior
2. Ensure 100% coverage on target code
3. Create integration tests for critical paths

### During Refactoring
1. Run tests after each small change
2. Use TDD for new abstractions
3. Verify no behavior changes

### After Refactoring
1. Full regression test suite
2. Performance benchmarks
3. Manual testing of critical flows

## Tools & Commands

```bash
# Code analysis
npm run analyze:all

# Run specific analysis
npm run analyze:complexity -- src/services/SupabaseChatService.ts
npm run analyze:duplicates -- src/components

# Testing
npm test -- --coverage
npm run test:integration

# Performance
npm run benchmark
npm run bundle-analyze

# Linting & formatting
npm run lint:fix
npm run format
```

## Definition of Done

- [ ] All Priority 1 files refactored
- [ ] Test coverage ≥70% on refactored code
- [ ] No functions >50 lines
- [ ] No components >150 lines
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Merged to main branch

## Next Steps After Sprint

1. Begin Track B: UI Component Library
2. Begin Track C: State Management Layer
3. Start v2 feature implementation
4. Continue monitoring code quality metrics

---

**Sprint Start:** [Date]
**Sprint End:** [Date]
**Team:** [Names]
**Status:** Not Started