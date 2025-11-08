# DRY Compliance Checklist

Use this checklist BEFORE creating any new function, component, or hook.

## Pre-Implementation DRY Check

### Step 1: Search Existing Codebase (2-5 minutes)

**Search Commands:**
```bash
# General search for similar functionality
grep -r "keywordInFunctionName" src/

# Specific directories
grep -r "format" src/utils/          # Formatters
grep -r "validate" src/utils/        # Validators
grep -r "calculate" src/utils/       # Calculations
grep -r "fetch" src/hooks/           # Data fetching
grep -r "use.*Data" src/hooks/       # Data hooks
grep -r "use.*Form" src/hooks/       # Form hooks
grep -r "Modal\|Dialog" src/components/  # Modal patterns
grep -r "Card" src/components/       # Card patterns
```

**IDE Search:**
- VS Code: `Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Windows)
- Search for: function names, keywords, patterns

### Step 2: Review Common Patterns

**Check these locations for existing implementations:**

```
src/utils/
├── validation.ts        # Input validation functions
├── formatting.ts        # Date, number, string formatting
├── calculations.ts      # Score calculations, math operations
└── helpers.ts          # General helper functions

src/hooks/
├── useBrandData.ts     # Brand data fetching/management
├── useAuth.ts          # Authentication state
└── useSupabase.ts      # Supabase queries

src/contexts/
└── BrandContext.tsx    # Global brand state

src/components/ui/      # shadcn-ui components (REUSE, DON'T MODIFY)
```

### Step 3: Decision Tree

```
Found similar code?
├── YES → Option A: Reuse as-is
│   └── Import and use existing function/component
│
├── YES (needs modification) → Option B: Refactor for reuse
│   ├── Extract common logic to utility/hook
│   ├── Add parameters for variations
│   └── Update all call sites (including P1 with TODOs)
│
└── NO similar code found → Option C: Create new
    └── Proceed with implementation
```

## Common DRY Violations (Watch For)

### 1. Duplicate Validation Logic

**❌ BAD: Copy-pasted validation**
```typescript
// FreeDiagnostic.tsx
if (!email || !email.includes('@')) {
  toast.error('Invalid email');
  return;
}

// BrandProfile.tsx
if (!email || !email.includes('@')) {
  toast.error('Invalid email');
  return;
}
```

**✅ GOOD: Shared validator**
```typescript
// src/utils/validation.ts
export function validateEmail(email: string): boolean {
  return email.length > 0 && email.includes('@');
}

// Both components
if (!validateEmail(email)) {
  toast.error('Invalid email');
  return;
}
```

### 2. Duplicate Data Fetching

**❌ BAD: Same Supabase query in multiple places**
```typescript
// Component A
const { data } = await supabase.from('profiles').select('*').single();

// Component B
const { data } = await supabase.from('profiles').select('*').single();
```

**✅ GOOD: Shared hook**
```typescript
// src/hooks/useProfile.ts
export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Both components
const { data: profile } = useProfile();
```

### 3. Duplicate UI Patterns

**❌ BAD: Similar card layouts everywhere**
```typescript
// Multiple components with same structure
<div className="border rounded-lg p-6 shadow-sm">
  <h3 className="text-lg font-semibold mb-2">{title}</h3>
  <p className="text-muted-foreground">{description}</p>
</div>
```

**✅ GOOD: Reusable component**
```typescript
// src/components/InfoCard.tsx
interface InfoCardProps {
  title: string;
  description: string;
}

export function InfoCard({ title, description }: InfoCardProps) {
  return (
    <Card className="p-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
```

### 4. Duplicate Error Handling

**❌ BAD: Same error pattern everywhere**
```typescript
// Multiple places
try {
  // operation
} catch (error) {
  console.error('Failed:', error);
  toast.error('Something went wrong');
}
```

**✅ GOOD: Error handling utility**
```typescript
// src/utils/errorHandling.ts
export function handleError(error: unknown, userMessage: string): void {
  console.error('Operation failed:', error);
  toast.error(userMessage);
}

// Usage
try {
  // operation
} catch (error) {
  handleError(error, 'Failed to save profile');
}
```

## Refactoring Workflow

When you find duplicate code:

### 1. Extract to Utility/Hook
```typescript
// Before (duplicate in 3 files)
const sortedUsers = users
  .filter(u => u.active)
  .sort((a, b) => a.name.localeCompare(b.name));

// After: Extract to src/utils/userHelpers.ts
export function getActiveUsersSorted(users: User[]): User[] {
  return users
    .filter(user => user.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

### 2. Update All Call Sites

**P0 Features (Active):**
```typescript
// Update immediately
import { getActiveUsersSorted } from '@/utils/userHelpers';

const sortedUsers = getActiveUsersSorted(users);
```

**P1 Features (Deferred):**
```typescript
// Add TODO, don't refactor yet
function CustomerReviewAnalyzer() {
  // TODO: Replace with getActiveUsersSorted from src/utils/userHelpers.ts
  // Old implementation below - refactor when working on P1
  const sortedUsers = users
    .filter(u => u.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}
```

### 3. Test Refactored Code

```typescript
// Add tests for new utility
describe('getActiveUsersSorted', () => {
  it('should filter inactive users', () => {
    const users = [
      { name: 'Alice', active: true },
      { name: 'Bob', active: false },
    ];
    expect(getActiveUsersSorted(users)).toHaveLength(1);
  });

  it('should sort by name', () => {
    const users = [
      { name: 'Bob', active: true },
      { name: 'Alice', active: true },
    ];
    const sorted = getActiveUsersSorted(users);
    expect(sorted[0].name).toBe('Alice');
  });
});
```

## 3-Strike Rule

If a pattern appears **3 times**, refactor to shared code immediately.

**Example Timeline:**
1. First implementation: `Component A` - OK, inline is fine
2. Second implementation: `Component B` - Note the duplication
3. Third implementation: `Component C` - **STOP! Refactor now**

**Action:**
```typescript
// Extract to utils/hooks
// Update Components A, B, C
// Prevent Component D from duplicating
```

## ROI Calculation

**Time Saved by DRY:**
- Upfront search: 2-5 minutes
- Refactoring (if needed): 15-30 minutes
- **Saved on future implementations:** 10-20 minutes each
- **Saved on bug fixes:** Fix once instead of N times
- **Saved on future refactoring:** Avoid large refactoring debt

**Example:**
- Pattern used in 5 places
- Bug found in pattern
- **DRY:** Fix once (5 min)
- **Not DRY:** Fix 5 times (25 min)
- **Savings:** 20 minutes per bug + 4 future implementations saved

## Integration with Development Workflow

### Before Creating New Code
1. ✅ Check this DRY checklist
2. ✅ Search codebase (2-5 min)
3. ✅ Review common patterns locations
4. ✅ Make decision: Reuse, Refactor, or Create

### During Code Review
- Reviewer checks: "Could this reuse existing code?"
- If yes: Request DRY refactoring before merge

### After Refactoring
- Update all P0 call sites
- Add TODOs in P1 features
- Commit with clear refactor message
- Update tests

---

**Remember:** Time spent searching for existing code is an investment that pays dividends in:
- Fewer bugs (fix once)
- Faster future development (reuse)
- Easier maintenance (single source of truth)
- Better code quality (consolidated improvements)

**Last Updated:** 2025-11-08
