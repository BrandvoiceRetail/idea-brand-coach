#!/bin/bash

echo "================================================"
echo "Verifying Auto-Claude Optimization Status"
echo "================================================"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "\n${YELLOW}1. Checking for outdated implementation_plan.json files...${NC}"
if [ -f ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/.auto-claude/specs/015-phase-0-track-b-ui-component-library/implementation_plan.json" ]; then
    echo -e "${RED}✗ Track B implementation_plan.json still exists - needs removal${NC}"
else
    echo -e "${GREEN}✓ Track B implementation_plan.json removed${NC}"
fi

if [ -f ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/.auto-claude/specs/016-phase-0-track-c-state-management-layer/implementation_plan.json" ]; then
    echo -e "${RED}✗ Track C implementation_plan.json still exists - needs removal${NC}"
else
    echo -e "${GREEN}✓ Track C implementation_plan.json removed${NC}"
fi

echo -e "\n${YELLOW}2. Checking spec.md files for optimization...${NC}"
if grep -q "Optimized" ".auto-claude/specs/015-phase-0-track-b-ui-component-library/spec.md" 2>/dev/null; then
    echo -e "${GREEN}✓ Track B spec.md is optimized${NC}"
else
    echo -e "${RED}✗ Track B spec.md needs optimization${NC}"
fi

if grep -q "Optimized" ".auto-claude/specs/016-phase-0-track-c-state-management-layer/spec.md" 2>/dev/null; then
    echo -e "${GREEN}✓ Track C spec.md is optimized${NC}"
else
    echo -e "${RED}✗ Track C spec.md needs optimization${NC}"
fi

echo -e "\n${YELLOW}3. Checking context.json for correct paths...${NC}"
if grep -q "src/v2/components" ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/.auto-claude/specs/015-phase-0-track-b-ui-component-library/context.json" 2>/dev/null; then
    echo -e "${GREEN}✓ Track B context.json uses v2 paths${NC}"
else
    echo -e "${RED}✗ Track B context.json needs v2 path updates${NC}"
fi

if grep -q "src/v2/contexts" ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/.auto-claude/specs/016-phase-0-track-c-state-management-layer/context.json" 2>/dev/null; then
    echo -e "${GREEN}✓ Track C context.json uses v2 paths${NC}"
else
    echo -e "${RED}✗ Track C context.json needs v2 path updates${NC}"
fi

echo -e "\n${YELLOW}4. Checking for atomic design directories (should NOT exist)...${NC}"
if [ -d ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/atoms" ]; then
    echo -e "${RED}✗ Atoms directory exists - should be removed${NC}"
else
    echo -e "${GREEN}✓ No atoms directory${NC}"
fi

if [ -d ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/components/molecules" ]; then
    echo -e "${RED}✗ Molecules directory exists - should be removed${NC}"
else
    echo -e "${GREEN}✓ No molecules directory${NC}"
fi

echo -e "\n${YELLOW}5. Checking for v2 directories (should exist)...${NC}"
if [ -d ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/src/v2/components" ]; then
    echo -e "${GREEN}✓ Track B v2/components directory exists${NC}"
else
    echo -e "${RED}✗ Track B v2/components directory missing${NC}"
fi

if [ -d ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/src/v2/contexts" ]; then
    echo -e "${GREEN}✓ Track C v2/contexts directory exists${NC}"
else
    echo -e "${RED}✗ Track C v2/contexts directory missing${NC}"
fi

echo -e "\n${YELLOW}6. Checking for implementation guides...${NC}"
if [ -f ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/IMPLEMENTATION_GUIDE.md" ]; then
    echo -e "${GREEN}✓ Track B IMPLEMENTATION_GUIDE.md exists${NC}"
else
    echo -e "${YELLOW}⚠ Track B IMPLEMENTATION_GUIDE.md missing (optional but recommended)${NC}"
fi

if [ -f ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/IMPLEMENTATION_GUIDE.md" ]; then
    echo -e "${GREEN}✓ Track C IMPLEMENTATION_GUIDE.md exists${NC}"
else
    echo -e "${YELLOW}⚠ Track C IMPLEMENTATION_GUIDE.md missing (optional but recommended)${NC}"
fi

echo -e "\n${YELLOW}7. Checking for reuse emphasis in context.json...${NC}"
if grep -q "REUSE" ".auto-claude/worktrees/tasks/015-phase-0-track-b-ui-component-library/.auto-claude/specs/015-phase-0-track-b-ui-component-library/context.json" 2>/dev/null; then
    echo -e "${GREEN}✓ Track B emphasizes component reuse${NC}"
else
    echo -e "${RED}✗ Track B context.json needs reuse emphasis${NC}"
fi

if grep -q "EXTEND" ".auto-claude/worktrees/tasks/016-phase-0-track-c-state-management-layer/.auto-claude/specs/016-phase-0-track-c-state-management-layer/context.json" 2>/dev/null; then
    echo -e "${GREEN}✓ Track C emphasizes pattern extension${NC}"
else
    echo -e "${RED}✗ Track C context.json needs extension emphasis${NC}"
fi

echo -e "\n================================================"
echo -e "${GREEN}Optimization Verification Complete!${NC}"
echo "================================================"
echo ""
echo "If all checks are green (✓), you're ready to restart Auto-Claude!"
echo "If any checks are red (✗), those items need attention before restarting."