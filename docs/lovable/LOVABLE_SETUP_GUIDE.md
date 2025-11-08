# Lovable Custom Knowledge - Setup Guide

## Quick Setup (5 Minutes)

### Step 1: Access Custom Knowledge
1. Open your project in Lovable: https://lovable.dev/projects/82940161-6d61-47bc-922f-d0ed1c747d6a
2. Click **Project Settings** (gear icon or project name menu)
3. Find **"Custom Knowledge"** or **"Manage knowledge"** tab
4. You'll see a single text input field

### Step 2: Add Knowledge (Recommended Approach)
**Copy the entire content** from `QUICK_START_KNOWLEDGE.md` and paste into the Custom Knowledge field.

This single file contains:
- ✅ Project overview with P0 vs P1 priorities
- ✅ Tech stack and architecture
- ✅ Coding conventions (TypeScript, React, naming)
- ✅ Supabase patterns and error handling
- ✅ Testing requirements
- ✅ Security rules
- ✅ TODO protocol for P1 features
- ✅ Common patterns already implemented

### Step 3: Save & Test
1. Click **Save** in Lovable
2. Start your first prompt with:
   ```
   Before writing code, please confirm you understand:
   1. Tech stack: React 18, TypeScript, Vite, Supabase, shadcn-ui
   2. P0 focus: Diagnostic flow, Auth, AI Brand Coach (NOT P1 features)
   3. Coding rules: Strict TypeScript, mobile-first, ≥85% test coverage
   4. TODO protocol: Add TODOs in P1 code when updating shared interfaces

   Any questions before we start?
   ```

## Character Limits

**Based on research:**
- No documented character limit found in Lovable docs
- You mentioned: "we have not run into the input limit yet"
- `QUICK_START_KNOWLEDGE.md` is ~5,500 characters (well within reasonable limits)
- If you hit a limit, use modular files approach below

## Alternative: Modular Approach

If the single file is too large, add files progressively:

### Priority 1 (Start Here)
1. `01_PROJECT_CONTEXT.md` - Project overview, P0 vs P1 priorities

### Priority 2 (When Coding)
2. `02_CODING_CONVENTIONS.md` - TypeScript, React, naming rules

### Priority 3 (When Using Backend)
3. `03_SUPABASE_PATTERNS.md` - Database, auth, error patterns

### Priority 4 (When Building UI)
4. `04_UI_DESIGN_SYSTEM.md` - shadcn-ui, Tailwind, accessibility

**How to combine multiple files:**
Copy and paste content from each file sequentially into the single Lovable Custom Knowledge input field. Separate each section with a horizontal rule (`---`) or clear heading.

## Key Clarifications Added

### P0 vs P1 Features (NEW)

**P0 Features (ACTIVE PRIORITY):**
- `/free-diagnostic` - FreeDiagnostic.tsx (6 questions)
- Authentication - Email/password + Google OAuth
- `/brand-coach` - IdeaFrameworkConsultant.tsx + idea-framework-consultant Edge Function

**P1 Features (DEFERRED - Exists but LOW PRIORITY):**
- `/idea/*` routes - Advanced IDEA modules
- `/avatar` - Avatar Builder
- `/canvas` - Brand Canvas
- `/value-lens` - Value Lens
- `/research-learning` - Research tools (SurveyBuilder, CustomerReviewAnalyzer)

### TODO Protocol for P1 Features (NEW)

When updating shared code (hooks, utilities, interfaces) that P1 features depend on:

```typescript
// Updated P0 code
export function useBrandData() {
  // New implementation
  return { data, isLoading, error };
}

// P1 feature (DEFERRED) - Add TODO
function CustomerReviewAnalyzer() {
  // TODO: Update to use new useBrandData hook (see src/hooks/useBrandData.ts)
  // Old implementation - refactor when working on P1
  const [data, setData] = useState(null);
  ...
}
```

**Rules:**
- Add TODO comments in P1 code when shared code changes
- Include reference to updated file/pattern
- Do NOT implement P1 features unless explicitly requested
- Keep TODOs actionable for future work

## Updating Custom Knowledge

As your project evolves:

### When to Update
- ✅ P0 feature completion changes (update percentage)
- ✅ New patterns established (add to "Common Patterns")
- ✅ Shared code changes affecting P1 features (update TODO examples)
- ✅ Tech stack changes (new libraries, tools)
- ✅ Coding convention changes (new rules, patterns)

### How to Update
1. Edit the appropriate markdown file in `docs/lovable/`
2. Copy updated content
3. Paste into Lovable Custom Knowledge field
4. Save

### Version Control
- Keep markdown files in `docs/lovable/` version controlled
- Update "Last Updated" date at bottom of each file
- Commit changes with descriptive messages

## Files Overview

| File | Size | Purpose |
|------|------|---------|
| `QUICK_START_KNOWLEDGE.md` | ~5.5KB | **Recommended** - Concise, complete |
| `LOVABLE_CUSTOM_KNOWLEDGE.md` | ~14KB | Comprehensive, detailed version |
| `01_PROJECT_CONTEXT.md` | ~2KB | Project overview, P0 vs P1 |
| `02_CODING_CONVENTIONS.md` | ~3KB | TypeScript, React, naming |
| `03_SUPABASE_PATTERNS.md` | ~4KB | Database, auth, Edge Functions |
| `04_UI_DESIGN_SYSTEM.md` | ~5KB | shadcn-ui, Tailwind, accessibility |

## Testing Your Setup

After adding Custom Knowledge, test with these prompts:

### Test 1: P0 vs P1 Understanding
```
I want to add a new feature to the Avatar Builder.
```

**Expected Response:**
AI should recognize Avatar Builder is P1 (deferred) and ask if you want to work on it or suggest focusing on P0 features.

### Test 2: Coding Conventions
```
Create a new component for displaying diagnostic results.
```

**Expected Response:**
AI should:
- Use TypeScript with explicit types
- Follow component structure pattern (imports, types, component, export)
- Use PascalCase naming (DiagnosticResults.tsx)
- Include proper error handling
- Use shadcn-ui components

### Test 3: Supabase Patterns
```
Fetch the user's diagnostic history from the database.
```

**Expected Response:**
AI should:
- Import from `@/integrations/supabase/client`
- Use proper error handling with toast notifications
- Show loading states
- Handle null/error cases gracefully

## Troubleshooting

### AI Not Following Guidelines
1. Verify Custom Knowledge is saved in Lovable
2. Try the "First Prompt Recommendation" to confirm understanding
3. Reference specific sections: "According to the Custom Knowledge, we should..."

### Character Limit Reached
1. Use `QUICK_START_KNOWLEDGE.md` instead of comprehensive version
2. Or use modular approach (add files progressively)
3. Prioritize most important sections

### Updates Not Applied
1. Make sure you saved after pasting
2. Refresh Lovable page
3. Start new conversation to test

## Best Practices

1. **Start Small**: Begin with `QUICK_START_KNOWLEDGE.md`
2. **Test Often**: Verify AI understands with test prompts
3. **Update Regularly**: Keep knowledge current as project evolves
4. **Version Control**: Commit markdown file changes
5. **Focus on P0**: Emphasize P0 priorities in prompts
6. **Use TODOs**: Add TODOs in P1 code when updating shared interfaces

## Next Steps

1. ✅ Copy `QUICK_START_KNOWLEDGE.md` content
2. ✅ Paste into Lovable Custom Knowledge
3. ✅ Save
4. ✅ Test with first prompt recommendation
5. ✅ Start building P0 features!

---

**Last Updated:** 2025-11-08
**Status:** P0 Beta Launch (~60% complete)
