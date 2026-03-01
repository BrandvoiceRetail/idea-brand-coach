# IDEA Brand Coach V2 - Parallel Execution Plan

## Quick Start for Auto-Claude

```bash
# Navigate to the correct repository and branch
cd /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach
git checkout main  # CRITICAL: Use main branch, not feature/image-processing

# Execute phases sequentially (each phase can have parallel tracks)
# Phase 0 has 3 parallel tracks that can run simultaneously
auto-claude --feature phase-0-track-a-domain    # ✅ COMPLETED
auto-claude --feature phase-0-track-b-ui        # Track B: UI Components
auto-claude --feature phase-0-track-c-state     # Track C: State Management

# After Phase 0 completes, run Phase 1-6 sequentially
auto-claude --feature phase-1-wire-domain-to-ui
# ... continue with other phases
```

## Repository Information
- **Path:** `/Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach`
- **Branch:** `main` (DO NOT use feature/image-processing)
- **Implementation Directory:** `/src/v2/`
- **Roadmap:** `/.auto-claude/roadmap/roadmap.json` (simplified for v2 only)
- **Backup:** `/.auto-claude/roadmap/roadmap-backup-02-28.json` (original full roadmap)

## Implementation Phases Overview

### Phase 0: Foundation (3 Parallel Tracks) - 2-3 days
**These can ALL run simultaneously in different terminals**
- ✅ **Track A: Domain Layer** - Business logic, entities, use cases (COMPLETED)
- ⏳ **Track B: UI Components** - Atomic design components
- ⏳ **Track C: State Management** - Contexts and hooks

### Phase 1: Integration Layer - 1 day
Connect the three foundation tracks together

### Phase 2: Three-Panel Layout - 2 days
Complete responsive layout with panel persistence

### Phase 3: Book-Aware Chat - 3 days
IDEA book integration with intelligent field extraction

### Phase 4: Field Intelligence - 2 days
Smart field editor with real-time sync

### Phase 5: Brand & Avatar Management - 2 days
Complete lifecycle with document generation

### Phase 6: Polish & Optimization - 2 days
Performance, UX enhancements, mobile support

---

## Phase 0: Foundation Implementation (Current)

### Status
- ✅ **Track A: Domain Layer** - COMPLETED (11 files, 0 TypeScript errors)
- ⏳ **Track B: UI Components** - Ready to execute
- ⏳ **Track C: State Management** - Ready to execute

### Track A: Domain Layer (✅ COMPLETED)
**Feature ID:** `phase-0-track-a-domain`
**Status:** All 11 files implemented with zero TypeScript errors

**Files Created:**
```
/src/v2/shared/types/index.ts                    ✅ Result type, ChatMessage, branded IDs
/src/v2/domain/value-objects/Demographics.ts     ✅ Age/gender/location validation
/src/v2/domain/value-objects/Psychographics.ts   ✅ Values/interests/lifestyle
/src/v2/domain/entities/Brand.ts                 ✅ Business rules, 500 char limits
/src/v2/domain/entities/Avatar.ts                ✅ Brand association, 20 item limits
/src/v2/domain/repositories/IBrandRepository.ts  ✅ CRUD interface
/src/v2/domain/repositories/IAvatarRepository.ts ✅ CRUD interface
/src/v2/application/use-cases/CreateBrandUseCase.ts      ✅ Brand creation workflow
/src/v2/application/use-cases/CreateAvatarUseCase.ts     ✅ Avatar creation with validation
/src/v2/application/use-cases/UpdateFieldsFromChatUseCase.ts ✅ Chat field extraction
/src/v2/application/use-cases/GenerateDocumentUseCase.ts    ✅ Document generation
```

### Track B: UI Components (Ready to Execute)
**Feature ID:** `phase-0-track-b-ui`
**Command:** `auto-claude --feature phase-0-track-b-ui`

**Files to Create:**
```typescript
// Atoms (5 files)
/src/v2/presentation/components/atoms/FileUploadButton.tsx  // Paperclip icon
/src/v2/presentation/components/atoms/Input.tsx             // Base input
/src/v2/presentation/components/atoms/Button.tsx            // Base button
/src/v2/presentation/components/atoms/Badge.tsx             // Tags/status
/src/v2/presentation/components/atoms/Avatar.tsx            // User avatar

// Molecules (4 files)
/src/v2/presentation/components/molecules/ChatInput.tsx     // Auto-resize textarea
/src/v2/presentation/components/molecules/FieldInput.tsx    // Label + input + validation
/src/v2/presentation/components/molecules/MessageBubble.tsx // Chat messages
/src/v2/presentation/components/molecules/CollapsibleSection.tsx // Animated collapse

// Organisms (3 files)
/src/v2/presentation/components/organisms/ChatInterface.tsx    // Full chat UI
/src/v2/presentation/components/organisms/FieldEditor.tsx      // Field list editor
/src/v2/presentation/components/organisms/BookContextDisplay.tsx // Book excerpts

// Templates (1 file)
/src/v2/presentation/components/templates/ThreePanelTemplate.tsx // Main layout

// Pages (2 files)
/src/v2/presentation/components/pages/BrandsPage.tsx   // Brand management
/src/v2/presentation/components/pages/AvatarsPage.tsx  // Avatar management
```

**Key Requirements:**
- Use Tailwind CSS for all styling
- Components must be pure (no state, just props)
- FileUploadButton uses Paperclip icon from lucide-react
- Support responsive design (mobile/tablet/desktop)
- Include dark mode classes

### Track C: State Management (Ready to Execute)
**Feature ID:** `phase-0-track-c-state`
**Command:** `auto-claude --feature phase-0-track-c-state`

**Files to Create:**
```typescript
// Contexts (2 files)
/src/v2/presentation/contexts/V2StateContext.tsx           // Global state
/src/v2/presentation/contexts/PanelCommunicationContext.tsx // Inter-panel messaging

// Hooks (5 files)
/src/v2/presentation/hooks/useThreePanelState.ts  // Panel visibility/width
/src/v2/presentation/hooks/useBrands.ts           // Brand CRUD operations
/src/v2/presentation/hooks/useAvatars.ts          // Avatar CRUD operations
/src/v2/presentation/hooks/useFieldSync.ts        // Chat-to-field sync
/src/v2/presentation/hooks/usePersistedState.ts   // localStorage persistence
```

**Key Requirements:**
- State updates must be under 16ms for smooth UI
- Include proper cleanup in useEffect
- Panel widths persist to localStorage
- Support keyboard shortcuts (Cmd+1,2,3)
- Optimistic updates for better UX

---

## Architecture Principles

### Clean Architecture Layers
```
UI Layer (Track B)
    ↓ depends on
Application Layer (Track C - State/Hooks)
    ↓ depends on
Domain Layer (Track A) ✅
    ↓ depends on
Nothing (pure business logic)
```

### Atomic Design Hierarchy
```
Atoms → Molecules → Organisms → Templates → Pages
Small    Compose    Complex     Layout      Full
units    atoms      sections    structure   views
```

### State Management Flow
```
User Action → Hook → Context → Reducer → State Update → UI Re-render
                ↓
            Use Case → Repository → External Service (Supabase/localStorage)
```

---

## Integration Points (Phase 1)

After all three Phase 0 tracks complete, integration involves:

1. **Wire Domain to UI** (`phase-1-wire-domain-to-ui`)
   - Map Brand/Avatar entities to component props
   - Type definitions flow from domain to UI

2. **Connect State to Components** (`phase-1-connect-state-to-components`)
   - Components consume hooks
   - Actions dispatch through contexts

3. **Implement Repositories** (`phase-1-implement-repositories`)
   - SupabaseBrandRepository.ts
   - SupabaseAvatarRepository.ts
   - LocalStorageBrandRepository.ts (offline fallback)

---

## File Structure After Phase 0

```
/src/v2/
├── shared/
│   └── types/
│       └── index.ts                    ✅ Track A
├── domain/                             ✅ Track A (COMPLETE)
│   ├── entities/
│   │   ├── Brand.ts                    ✅
│   │   └── Avatar.ts                   ✅
│   ├── value-objects/
│   │   ├── Demographics.ts             ✅
│   │   └── Psychographics.ts           ✅
│   └── repositories/
│       ├── IBrandRepository.ts         ✅
│       └── IAvatarRepository.ts        ✅
├── application/                        ✅ Track A (COMPLETE)
│   └── use-cases/
│       ├── CreateBrandUseCase.ts       ✅
│       ├── CreateAvatarUseCase.ts      ✅
│       ├── UpdateFieldsFromChatUseCase.ts ✅
│       └── GenerateDocumentUseCase.ts  ✅
├── presentation/
│   ├── components/                     ⏳ Track B
│   │   ├── atoms/
│   │   ├── molecules/
│   │   ├── organisms/
│   │   ├── templates/
│   │   └── pages/
│   ├── contexts/                       ⏳ Track C
│   └── hooks/                          ⏳ Track C
└── services/
    └── BookIndexService.js             ✅ (existing)
```

---

## Testing Strategy

### Unit Tests (Each Track)
- Track A: Test entities, value objects, use cases
- Track B: Component snapshot tests
- Track C: Hook behavior tests

### Integration Tests (Phase 1)
- Data flow from domain to UI
- State persistence
- Repository operations

### E2E Tests (Phase 2+)
- Complete user workflows
- Panel interactions
- Chat-to-field sync

---

## Success Metrics

### Phase 0 Success
- ✅ Track A: 11 files, 0 TypeScript errors (COMPLETED)
- [ ] Track B: All components render without errors
- [ ] Track C: State updates < 16ms, no memory leaks

### Overall V2 Success
- Create avatar in < 10 minutes
- Chat extracts fields with 80% accuracy
- Book excerpts relevance score > 0.85
- Document generation < 5 seconds
- Mobile responsive
- Offline capable

---

## Common Issues & Solutions

### Issue: Import paths not resolving
**Solution:** Use relative imports within v2, absolute imports for external

### Issue: Type conflicts between tracks
**Solution:** Refer to `/src/v2/shared/types/index.ts` for shared types

### Issue: Component props undefined
**Solution:** Components in Track B should define their own prop interfaces

### Issue: State not persisting
**Solution:** Check usePersistedState hook and localStorage keys

---

## Dependencies & Tools

### Required Packages (Already Installed)
- React 18+
- TypeScript 5+
- Tailwind CSS
- lucide-react (icons)
- Supabase client
- shadcn/ui components

### Development Tools
- auto-claude (for execution)
- TypeScript compiler (tsc)
- Tailwind CSS IntelliSense
- React Developer Tools

---

## Execution Checklist

### Before Starting Track B or C:
- [ ] Confirm on main branch: `git branch` shows `* main`
- [ ] Repository path: `/Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach`
- [ ] Check Track A completion: 11 files in domain/ and application/
- [ ] Roadmap exists: `/.auto-claude/roadmap/roadmap.json`

### Track B Execution:
```bash
auto-claude --feature phase-0-track-b-ui
```
- [ ] 15 component files created
- [ ] All use Tailwind CSS
- [ ] Components are pure (no hooks)
- [ ] TypeScript strict mode

### Track C Execution:
```bash
auto-claude --feature phase-0-track-c-state
```
- [ ] 2 context files created
- [ ] 5 hook files created
- [ ] localStorage persistence works
- [ ] No memory leaks

### After Phase 0 Complete:
- [ ] Run Phase 1 integration features
- [ ] Test data flow end-to-end
- [ ] Verify TypeScript compilation
- [ ] Check browser console for errors

---

## Notes for Auto-Claude Agents

1. **Work ONLY in /src/v2/** - Do not modify v1 interface
2. **Use TypeScript strictly** - No 'any' types except absolutely necessary
3. **Follow existing patterns** - Check Track A implementation for types
4. **Import from Track A** - Use types from `/src/v2/shared/types/index.ts`
5. **Document complex logic** - Add JSDoc comments for public APIs
6. **Test as you build** - Don't wait until integration

---

## Quick Commands Reference

```bash
# Check current branch
git branch

# Navigate to repository
cd /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach

# Execute Phase 0 tracks (parallel)
auto-claude --feature phase-0-track-b-ui    # Terminal 1
auto-claude --feature phase-0-track-c-state  # Terminal 2

# Execute Phase 1 (sequential)
auto-claude --feature phase-1-wire-domain-to-ui
auto-claude --feature phase-1-connect-state-to-components
auto-claude --feature phase-1-implement-repositories

# Check TypeScript compilation
npx tsc --noEmit --project tsconfig.json

# Run development server
npm run dev
```

This plan enables complete v2 implementation with clear phase separation and parallel execution where possible.