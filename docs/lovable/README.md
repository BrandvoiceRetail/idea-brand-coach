# Custom Knowledge Files for Lovable

This directory contains knowledge base files optimized for Lovable's Custom Knowledge feature.

## Important: Lovable Limitations

⚠️ **Lovable Custom Knowledge only supports a SINGLE text field input** (as of 2025-11-08)

- ❌ Cannot upload multiple files
- ❌ Cannot attach PDFs or documents
- ✅ CAN reference files in your repository via prompts
- ✅ Single text field (no documented character limit)

See `LOVABLE_LIMITATIONS.md` for details and workarounds.

## How to Use

### Option 1: Comprehensive Single File (RECOMMENDED)
Copy and paste `LOVABLE_CUSTOM_KNOWLEDGE.md` into Lovable's Custom Knowledge field.
- Contains all essential context
- References additional files in repository
- Best for Lovable's single-field limitation

### Option 2: Quick Start (Concise)
Use `QUICK_START_KNOWLEDGE.md` for a shorter version (~5.5KB vs ~15KB)

### Option 3: On-Demand References
Keep Custom Knowledge minimal, reference detailed docs via prompts:
- "Read `docs/lovable/DRY_CHECKLIST.md` before implementing"
- "Check `docs/P1_FEATURES.md` for deferred features"

1. **Start with:** `01_PROJECT_CONTEXT.md`
   - Project overview, tech stack, user journey

2. **Add when coding:** `02_CODING_CONVENTIONS.md`
   - TypeScript rules, React patterns, naming conventions

3. **Add when using Supabase:** `03_SUPABASE_PATTERNS.md`
   - Database queries, auth patterns, error handling

4. **Add when building UI:** `04_UI_DESIGN_SYSTEM.md`
   - shadcn-ui usage, Tailwind patterns, accessibility

## Files Overview

| File | Purpose | When to Add |
|------|---------|-------------|
| `QUICK_START_KNOWLEDGE.md` | Concise essentials | Start here (recommended) |
| `LOVABLE_CUSTOM_KNOWLEDGE.md` | Complete reference | If you want everything |
| `01_PROJECT_CONTEXT.md` | Project overview | Always (foundation) |
| `02_CODING_CONVENTIONS.md` | Code standards | When coding features |
| `03_SUPABASE_PATTERNS.md` | Backend patterns | When working with data |
| `04_UI_DESIGN_SYSTEM.md` | Design system | When building UI |

## Accessing Custom Knowledge in Lovable

1. Open your project in Lovable
2. Click on **Project Settings**
3. Find **"Custom Knowledge"** or **"Manage knowledge"** tab
4. Copy and paste the content from your chosen file(s)
5. Save changes

## Best Practices from Lovable Docs

> "Start small. Even a few lines can make a meaningful difference."

**Recommendations:**
- Start with `QUICK_START_KNOWLEDGE.md` (concise, covers essentials)
- Update as project evolves
- Add more files as you work on specific areas
- Keep it current - remove outdated information

## First Prompt Recommendation

After adding Custom Knowledge, start your first prompt with:

```
Before writing code, please confirm you understand:
1. Tech stack: React 18, TypeScript, Vite, Supabase, shadcn-ui
2. P0 focus: Diagnostic flow, Auth, AI Brand Coach
3. Coding rules: Strict TypeScript, mobile-first, ≥85% test coverage
4. Patterns: Supabase client, toast errors, shadcn-ui components

Any questions before we start?
```

This ensures the AI has properly read and understood your Custom Knowledge.

## Updating Knowledge

As your project evolves:
- Add new patterns you establish
- Update completion status (currently ~60%)
- Remove outdated information
- Document new features as you build them

## Related Files

- **Full project docs:** `/docs/` directory
- **Best practices guide:** `node_modules/@matthewkerns/software-development-best-practices-guide/`
- **Roadmap:** `P0_BETA_LAUNCH_ROADMAP.md`
- **Claude Code instructions:** `CLAUDE.md` (for Claude Code CLI)

---

**Last Updated:** 2025-11-08
**Project Phase:** P0 Beta Launch (~60% complete)
