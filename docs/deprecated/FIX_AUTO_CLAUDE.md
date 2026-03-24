# Fix Auto-Claude Implementation Plans

## Problem
Auto-Claude is using outdated `implementation_plan.json` files that were generated before the optimization. It's creating components from scratch instead of reusing existing ones.

## Solution Steps

### 1. Stop Current Auto-Claude Tasks
```bash
# In Auto-Claude UI, stop both tasks:
# - 015-phase-0-track-b-ui-component-library
# - 016-phase-0-track-c-state-management-layer
```

### 2. Remove Outdated Implementation Plans
```bash
# Remove the outdated implementation plans
rm /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/.auto-claude/specs/015-phase-0-track-b-ui-component-library/implementation_plan.json

rm /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/.auto-claude/specs/016-phase-0-track-c-state-management-layer/implementation_plan.json
```

### 3. Clean Up Incorrect Work (Track B)
```bash
# Remove incorrectly created atomic components
rm -rf /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/atoms/
rm -rf /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/molecules/
rm -rf /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/organisms/
rm -rf /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/templates/

# Remove Storybook if it was added
rm -rf /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/.storybook/
```

### 4. Create Correct V2 Directory Structure
```bash
# Track B - Create v2 components directory
mkdir -p /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/v2/components/

# Track C - Create v2 contexts and hooks directories
mkdir -p /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/src/v2/contexts/
mkdir -p /Users/matthewkerns/workspace/ecommerce-tools/brand-systems/idea-brand-coach/.auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/src/v2/hooks/
```

### 5. Restart Auto-Claude with New Instructions

When restarting, Auto-Claude should now:
- Read the updated `spec.md` files
- Generate new implementation plans based on the optimized approach
- Create only the minimal files needed

## What Auto-Claude Should Create

### Track B (Only 3-4 files):
```
src/v2/components/
├── ThreePanelTemplate.tsx    # Compose ResizablePanel
├── BookContextDisplay.tsx     # New - book excerpts
├── EnhancedChatInterface.tsx  # Wrap existing chat
└── (optional page wrappers)
```

### Track C (Only 4 files):
```
src/v2/
├── contexts/
│   ├── V2StateContext.tsx           # Thin wrapper
│   └── PanelCommunicationContext.tsx # Inter-panel messaging
└── hooks/
    ├── useThreePanelState.ts        # Panel widths
    └── useFieldSync.ts              # Chat-to-field sync
```

## Verification After Restart

```bash
# Should see imports from existing components
grep -r "from '@/components/ui" src/v2/

# Should NOT see new atomic components
ls src/components/atoms/  # Should not exist or be empty

# Should see v2-specific files only
find src/v2 -type f | wc -l  # Should be < 10 files total
```

## Key Reminders for Auto-Claude

1. **REUSE** all shadcn-ui components from `src/components/ui/`
2. **EXTEND** existing hooks like usePersistedField, useChat
3. **COMPOSE** ThreePanelTemplate from ResizablePanel
4. **DO NOT** create Button, Input, Badge, or other basic components
5. **DO NOT** install Storybook or create atomic design structure