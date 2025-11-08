# Lovable Custom Knowledge Limitations & Workarounds

## Current Limitations (As of 2025-11-08)

### ❌ Multiple File Upload Not Supported

**Status:** Feature request only (not yet available)
**Source:** https://feedback.lovable.dev/p/attach-documentsfiles-to-a-projects-knowledge

**What This Means:**
- Custom Knowledge is a **single text field** only
- Cannot directly upload multiple markdown files
- Cannot attach PDFs or other document formats
- Unlike Claude Projects or GPT, which support multiple file uploads

### ✅ What IS Supported

1. **Single Text Field (Main Custom Knowledge)**
   - Paste any amount of text (no documented character limit)
   - Markdown formatting supported
   - Can include external links to documentation

2. **External References in Text**
   - Links to API documentation
   - Links to design systems
   - Links to style guides
   - References to npm packages

3. **Repository File Access**
   - Lovable CAN read all files in your connected GitHub repository
   - You can reference files in prompts
   - Example: "Read `docs/TECHNICAL_ARCHITECTURE.md`"

## Workarounds & Best Practices

### Strategy 1: Consolidated Single File (Recommended)

**Use:** `LOVABLE_CUSTOM_KNOWLEDGE.md` as your single source
**Pros:**
- All essential context in one place
- No need for multiple references
- Fast for AI to parse

**Cons:**
- Can become large
- May hit undocumented character limits

**When to Use:**
- For essential, frequently-needed information
- Core conventions and patterns
- Critical security/quality rules

### Strategy 2: Repository Reference Pattern

**Use:** Reference files in your `/docs` folder via prompts
**Pros:**
- Detailed information available on demand
- No character limits
- Easy to maintain and update

**Cons:**
- Requires explicit prompting
- AI must read file each time (slower)

**When to Use:**
- For detailed guides (DRY_CHECKLIST.md)
- For reference documentation (P1_FEATURES.md)
- For architectural deep-dives

### Strategy 3: Hybrid Approach (Recommended)

**Main Custom Knowledge:** Essential context (LOVABLE_CUSTOM_KNOWLEDGE.md)
- Project overview (P0 vs P1)
- Core best practices (Readability, SRP, DRY)
- Coding conventions (TypeScript, React, naming)
- Common patterns (Supabase, error handling)
- References to detailed docs in repo

**On-Demand via Prompts:** Detailed guidance
- "Read `docs/lovable/DRY_CHECKLIST.md` for pre-implementation DRY checklist"
- "Check `docs/P1_FEATURES.md` for list of deferred features"
- "Reference `docs/TECHNICAL_ARCHITECTURE.md` for data flow"

## Prompt Patterns for Repository Files

### Pattern 1: Read Specific File
```
"Before implementing this feature, please read `docs/lovable/DRY_CHECKLIST.md`
and follow the pre-implementation checklist."
```

### Pattern 2: Check P1 Features
```
"Is the Avatar Builder a P0 or P1 feature? Check `docs/P1_FEATURES.md` to confirm
before proceeding."
```

### Pattern 3: Reference Architecture
```
"How should I structure the data flow for this feature? Reference
`docs/TECHNICAL_ARCHITECTURE.md` for our established patterns."
```

### Pattern 4: Verify Best Practices
```
"Am I duplicating code? Search the codebase using the patterns in
`docs/lovable/DRY_CHECKLIST.md` before creating this function."
```

## File Organization Strategy

### In Custom Knowledge Field (Single File)
✅ **Include:**
- Project overview (tech stack, P0 vs P1)
- Core principles (Readability, SRP, DRY)
- Essential conventions (naming, structure)
- Common patterns (Supabase queries, error handling)
- References to detailed docs

❌ **Don't Include:**
- Detailed checklists (use DRY_CHECKLIST.md in repo)
- Long code examples (link to repo files)
- Complete feature lists (reference P1_FEATURES.md)
- Architecture diagrams (reference TECHNICAL_ARCHITECTURE.md)

### In Repository `/docs/lovable/` Directory
✅ **Store:**
- `DRY_CHECKLIST.md` - Pre-implementation checklist
- `02_CODING_CONVENTIONS.md` - Detailed TypeScript/React rules
- `03_SUPABASE_PATTERNS.md` - Database pattern examples
- `04_UI_DESIGN_SYSTEM.md` - shadcn-ui + Tailwind guide
- `LOVABLE_SETUP_GUIDE.md` - Setup instructions

### In Repository `/docs/` Directory
✅ **Store:**
- `P0_FEATURES.md` - P0 feature requirements
- `P1_FEATURES.md` - Deferred features list
- `TECHNICAL_ARCHITECTURE.md` - System architecture
- `P0_IMPLEMENTATION_PLAN.md` - Implementation roadmap

## Character Limit Testing

**Status:** No documented character limit found
**Tested:** `LOVABLE_CUSTOM_KNOWLEDGE.md` (~15KB) not yet hit limit

**Recommendations:**
1. Start with full comprehensive file
2. If you hit a limit, remove examples and reference repo files instead
3. Keep core principles and conventions in Custom Knowledge
4. Move detailed guides to repository

## Future: When Multiple Files Are Supported

**If/when Lovable adds multiple file support:**

1. Keep current structure (already optimized)
2. Upload modular files:
   - `01_PROJECT_CONTEXT.md`
   - `02_CODING_CONVENTIONS.md`
   - `03_SUPABASE_PATTERNS.md`
   - `04_UI_DESIGN_SYSTEM.md`
   - `DRY_CHECKLIST.md`

3. Benefits:
   - Easier to maintain individual files
   - Update one file without touching others
   - Better organization for team

## Comparison with Other AI Platforms

| Feature | Lovable | Claude Projects | ChatGPT |
|---------|---------|-----------------|---------|
| Multiple files | ❌ | ✅ | ✅ |
| Single text field | ✅ | ✅ | ✅ |
| Repository access | ✅ | ❌ | ❌ |
| External links | ✅ | ✅ | ✅ |
| Character limit | Unknown | 100K chars | Unknown |

**Lovable Advantage:** Direct repository access means you can reference any file
**Lovable Limitation:** Must reference files in prompts (not automatic context)

## Summary: How to Use Lovable Custom Knowledge

### Your Setup (Recommended)

1. **Primary Custom Knowledge:** `LOVABLE_CUSTOM_KNOWLEDGE.md`
   - Paste entire content into Lovable Custom Knowledge field
   - Contains essential context for every prompt

2. **Reference on Demand:** Files in `/docs/lovable/`
   - Use prompts to reference detailed guides
   - "Read `docs/lovable/DRY_CHECKLIST.md` before implementing"

3. **Project Documentation:** Files in `/docs/`
   - Reference as needed for architecture, features, plans
   - "Check `docs/P1_FEATURES.md` for deferred features"

### First Prompt Template

```
"Please review the Custom Knowledge and confirm you understand:
1. Project context (P0 vs P1 priorities)
2. Best practices (Readability, SRP, DRY)
3. Coding conventions and patterns

Additional resources available in repository:
- DRY checklist: docs/lovable/DRY_CHECKLIST.md
- P1 features: docs/P1_FEATURES.md
- Architecture: docs/TECHNICAL_ARCHITECTURE.md

Read these files as needed during implementation.
Any questions before we begin?"
```

---

**Last Updated:** 2025-11-08
**Status:** Feature request submitted for multiple file upload
**Recommendation:** Use hybrid approach (single main file + repo references)
