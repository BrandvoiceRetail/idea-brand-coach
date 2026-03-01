#!/bin/bash

echo "================================================"
echo "Fresh Start for V2 Implementation (Optimized)"
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}Step 1: Stop all Auto-Claude tasks${NC}"
echo "Please ensure all tasks are STOPPED in Auto-Claude UI"
read -p "Press Enter when all tasks are stopped..."

echo -e "\n${YELLOW}Step 2: Remove old worktrees${NC}"
if [ -d ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library" ]; then
    echo "Removing old Track B worktree..."
    cd .auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library
    git worktree remove . --force 2>/dev/null
    cd - > /dev/null
    rm -rf .auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library
    echo -e "${GREEN}✓ Old Track B worktree removed${NC}"
else
    echo -e "${GREEN}✓ No old Track B worktree found${NC}"
fi

if [ -d ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer" ]; then
    echo "Removing old Track C worktree..."
    cd .auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer
    git worktree remove . --force 2>/dev/null
    cd - > /dev/null
    rm -rf .auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer
    echo -e "${GREEN}✓ Old Track C worktree removed${NC}"
else
    echo -e "${GREEN}✓ No old Track C worktree found${NC}"
fi

echo -e "\n${YELLOW}Step 3: Clean up git worktrees${NC}"
git worktree prune
echo -e "${GREEN}✓ Git worktrees pruned${NC}"

echo -e "\n${YELLOW}Step 4: Verify new roadmap${NC}"
if grep -q "v2-ui-composition" .auto-claude/roadmap/roadmap.json; then
    echo -e "${GREEN}✓ New optimized roadmap.json is in place${NC}"
else
    echo -e "${RED}✗ roadmap.json needs to be updated${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Step 5: Verify spec files${NC}"
if [ -f ".auto-claude/specs/v2-ui-composition/spec.md" ]; then
    echo -e "${GREEN}✓ v2-ui-composition spec exists${NC}"
else
    echo -e "${RED}✗ v2-ui-composition spec missing${NC}"
fi

if [ -f ".auto-claude/specs/v2-state-extension/spec.md" ]; then
    echo -e "${GREEN}✓ v2-state-extension spec exists${NC}"
else
    echo -e "${RED}✗ v2-state-extension spec missing${NC}"
fi

echo -e "\n================================================"
echo -e "${GREEN}Fresh Start Complete!${NC}"
echo "================================================"
echo ""
echo "Next Steps in Auto-Claude:"
echo "1. Refresh the roadmap view"
echo "2. You should see TWO new tasks:"
echo "   - 'V2 UI Components (Compose from Existing)'"
echo "   - 'V2 State Management (Extend Existing)'"
echo "3. Start both tasks (they can run in parallel)"
echo ""
echo "Expected Results:"
echo "- Only 8 total files created (4 UI, 4 State)"
echo "- Heavy reuse of existing components"
echo "- All files in src/v2/ directory"
echo "- No atomic design structure"
echo "- Completion in ~4-8 hours total"
echo ""
echo -e "${YELLOW}IMPORTANT:${NC} If Auto-Claude tries to create atoms/molecules/organisms,"
echo "it's reading old cached data. Stop and restart the task."