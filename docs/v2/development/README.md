# V2 Development Documentation

## Overview

Developer documentation for building and maintaining the IDEA Brand Coach v2 system.

## Quick Start for Developers

### Week 0: Start Here
1. 🔨 **[Refactoring Plan](./REFACTORING_PLAN.md)** - Clean technical debt first
2. 📋 Review code smell assessment
3. 🧪 Ensure 70% test coverage
4. ✅ Complete refactoring checklist

### Development Setup
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run tests
npm test

# Check code quality
npm run analyze:all
```

## Documentation Index

### Core Development Docs

#### 🔨 [Refactoring Plan](./REFACTORING_PLAN.md)
Week 0 sprint to clean technical debt before v2 implementation.

#### 🧩 Component Library (Coming Soon)
UI component catalog and usage guidelines.

#### 🔄 State Management (Coming Soon)
React hooks and context patterns for v2.

#### 🧪 Testing Strategy (Coming Soon)
70% coverage requirement and testing approaches.

#### 🚩 Feature Flags (Coming Soon)
Progressive rollout configuration.

## Development Standards

### Code Quality Requirements
- **Test Coverage**: Minimum 70% for critical paths
- **TypeScript**: Strict mode enabled, no `any` types
- **Components**: <150 lines per component
- **Functions**: <50 lines per function
- **Complexity**: Cyclomatic complexity <8

### Git Workflow
```bash
# Create feature branch
git checkout -b refactor/week-0-cleanup

# Make changes with clear commits
git commit -m "refactor: extract ChatService methods"

# Push and create PR
git push origin refactor/week-0-cleanup
```

### Testing Requirements
```typescript
// Every new feature needs:
describe('Feature', () => {
  it('has unit tests', () => {});
  it('has integration tests', () => {});
  it('handles errors gracefully', () => {});
  it('performs within targets', () => {});
});
```

## Refactoring Priorities

### Priority 1: Must Complete (Week 0)
- [ ] `SupabaseChatService.ts` - Extract methods
- [ ] `AIAssistant.tsx` - Split into smaller components
- [ ] `usePersistedField.ts` - Add type safety
- [ ] `fieldSync.ts` - Extract shared service

### Priority 2: Should Complete
- [ ] `BrandDashboard.tsx` - Reduce complexity
- [ ] `DocumentService.ts` - Improve abstractions
- [ ] `useChat.ts` - Separate concerns
- [ ] `BrandContext.tsx` - Optimize rerenders

## Performance Benchmarks

### Current Metrics (v1)
| Metric | Current | Target |
|--------|---------|--------|
| Bundle Size | 850KB | <600KB |
| Initial Load | 4.2s | <3s |
| Re-render | 32ms | <16ms |
| Test Coverage | 45% | 70% |

### Tools & Commands

```bash
# Code Analysis
npm run analyze:complexity     # Check cyclomatic complexity
npm run analyze:duplicates    # Find duplicate code
npm run bundle-analyze        # Analyze bundle size

# Testing
npm test                      # Run all tests
npm test -- --coverage       # With coverage report
npm run test:watch           # Watch mode

# Code Quality
npm run lint                 # ESLint check
npm run lint:fix            # Auto-fix issues
npm run format              # Prettier format
```

## Architecture Patterns

### Repository Pattern
```typescript
interface IAvatarRepository {
  create(avatar: Avatar): Promise<Result<Avatar>>;
  update(id: string, data: Partial<Avatar>): Promise<Result<Avatar>>;
  findById(id: string): Promise<Result<Avatar>>;
  findByBrand(brandId: string): Promise<Result<Avatar[]>>;
}
```

### Use Case Pattern
```typescript
class CreateAvatarUseCase {
  constructor(private repository: IAvatarRepository) {}

  async execute(data: CreateAvatarDto): Promise<Result<Avatar>> {
    // Business logic here
  }
}
```

### Result Pattern
```typescript
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error };
```

## Common Issues & Solutions

### Issue: Long Functions
**Solution**: Extract methods following single responsibility principle

### Issue: Prop Drilling
**Solution**: Use Context API or component composition

### Issue: Type Safety
**Solution**: Replace primitives with value objects

### Issue: Test Coverage
**Solution**: Write characterization tests before refactoring

## Resources

### Internal
- [V2 Architecture](../architecture/)
- [V2 Features](../features/)
- [Migration Guide](../migration/)

### External
- [React Best Practices](https://react.dev/learn/thinking-in-react)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Testing Library](https://testing-library.com/docs/)
- [Supabase Docs](https://supabase.com/docs)

---

**Status**: Week 0 - Refactoring Sprint
**Last Updated**: February 28, 2026