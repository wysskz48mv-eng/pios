#!/bin/bash
# Personal Planning UI - Quick Start Bash Script
# This script automates the entire deployment process
# Usage: bash quick-deploy.sh ~/path/to/pios

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Configuration
REPO_PATH="${1:-.}"
OUTPUT_DIR="/mnt/user-data/outputs"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║   Personal Planning UI - Quick Deploy Script              ║"
echo "║   Week 1: Domains Dashboard                                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Validate repo
if [ ! -d "$REPO_PATH/.git" ]; then
    echo -e "${RED}Error: Not a git repository at $REPO_PATH${NC}"
    echo "Usage: bash quick-deploy.sh /path/to/pios"
    exit 1
fi

echo -e "${BLUE}Repository: $REPO_PATH${NC}"
cd "$REPO_PATH"

# Create backup of current state
echo -e "\n${YELLOW}Creating backup...${NC}"
BACKUP_NAME="pios-backup-$TIMESTAMP.tar.gz"
tar -czf "$BACKUP_NAME" src/ package.json 2>/dev/null || true
echo -e "${GREEN}✓ Backup: $BACKUP_NAME${NC}"

# Create directories
echo -e "\n${YELLOW}Setting up directories...${NC}"
mkdir -p src/components/strategic-planning
mkdir -p src/app/api/planning/domains
mkdir -p src/app/platform/strategic-planning
echo -e "${GREEN}✓ Directories created${NC}"

# Copy component files
echo -e "\n${YELLOW}Copying components...${NC}"

cp "$OUTPUT_DIR/src_components_strategic-planning_StrategicPlanningLayout.tsx" \
   src/components/strategic-planning/StrategicPlanningLayout.tsx
echo -e "${GREEN}✓ StrategicPlanningLayout.tsx${NC}"

cp "$OUTPUT_DIR/src_components_strategic-planning_DomainsOverview.tsx" \
   src/components/strategic-planning/DomainsOverview.tsx
echo -e "${GREEN}✓ DomainsOverview.tsx${NC}"

# Manual component extraction needed - show instructions
echo -e "\n${YELLOW}Next: Extract components from bundle files${NC}"
echo -e "${BLUE}File 1: COMPLETE_STRATEGIC_PLANNING_COMPONENTS.txt${NC}"
echo "  Contains 7 additional components (DomainCard, DomainModal, etc.)"
echo "  Copy each section to: src/components/strategic-planning/"
echo ""
echo -e "${BLUE}File 2: API_ROUTE_AND_PAGE.txt${NC}"
echo "  Contains route.ts and page.tsx"
echo "  Copy sections to correct API/page directories"
echo ""
echo -e "${YELLOW}Instructions:${NC}"
echo "  1. Open: /mnt/user-data/outputs/COPY_PASTE_INSTALLATION_GUIDE.md"
echo "  2. Follow the detailed copy-paste steps"
echo "  3. Return here when ready"
echo ""
read -p "Press Enter when files are copied: "

# Verify files
echo -e "\n${YELLOW}Verifying files...${NC}"
FILES=(
    "src/components/strategic-planning/StrategicPlanningLayout.tsx"
    "src/components/strategic-planning/DomainsOverview.tsx"
    "src/components/strategic-planning/DomainCard.tsx"
    "src/components/strategic-planning/DomainModal.tsx"
    "src/components/strategic-planning/VisionEditor.tsx"
    "src/components/strategic-planning/GoalCascadeView.tsx"
    "src/components/strategic-planning/SprintPlanner.tsx"
    "src/components/strategic-planning/HabitTracker.tsx"
    "src/components/strategic-planning/PlanningMetricsDashboard.tsx"
    "src/app/api/planning/domains/route.ts"
    "src/app/platform/strategic-planning/page.tsx"
)

MISSING=0
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file${NC}"
    else
        echo -e "${RED}✗ MISSING: $file${NC}"
        MISSING=$((MISSING + 1))
    fi
done

if [ $MISSING -gt 0 ]; then
    echo -e "\n${RED}Error: $MISSING files still missing${NC}"
    echo "Restore backup and try again:"
    echo "  tar -xzf $BACKUP_NAME"
    exit 1
fi

# Update sidebar (manual)
echo -e "\n${YELLOW}Updating sidebar navigation...${NC}"
echo "Edit: src/app/platform/layout.tsx"
echo "Add this to navigation items:"
echo ""
echo "  {"
echo "    href: '/platform/strategic-planning',"
echo "    label: '🎯 Strategic Planning',"
echo "    icon: '🎯',"
echo "    active: pathname === '/platform/strategic-planning'"
echo "  }"
echo ""
read -p "Press Enter when sidebar is updated: "

# Test build
echo -e "\n${YELLOW}Testing build...${NC}"
if npm run build > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Build successful${NC}"
else
    echo -e "${RED}✗ Build failed${NC}"
    echo "Check errors above and fix before deploying"
    exit 1
fi

# Git operations
echo -e "\n${YELLOW}Git operations...${NC}"
git add src/components/strategic-planning/
git add src/app/api/planning/
git add src/app/platform/strategic-planning/

echo -e "${BLUE}Files to commit:${NC}"
git diff --cached --name-only | sed 's/^/  /'

echo ""
read -p "Commit and push to GitHub? (y/n) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "feat: M054 UI - Week 1 Domains Dashboard & API routes"
    git push origin main
    echo -e "${GREEN}✓ Pushed to GitHub${NC}"
    echo -e "${GREEN}✓ Vercel auto-deploy started${NC}"
else
    echo -e "${YELLOW}Skipped git push${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗"
echo "║                    ✓ DEPLOYMENT COMPLETE                   ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Next steps:${NC}"
echo "1. Monitor Vercel build:"
echo "   https://vercel.com/wysskz48mv-eng/pios/deployments"
echo ""
echo "2. Test local (optional):"
echo "   npm run dev"
echo "   → http://localhost:3000/platform/strategic-planning"
echo ""
echo "3. Check production (2-3 min):"
echo "   https://pios-wysskz48mv-engs-projects.vercel.app/platform/strategic-planning"
echo ""
echo "4. Create test domain:"
echo "   - Click '+ Add Domain'"
echo "   - Select 'Career'"
echo "   - Choose color and priority"
echo "   - Click 'Create'"
echo ""
echo -e "${GREEN}✓ Backup saved: $BACKUP_NAME${NC}"
echo ""
