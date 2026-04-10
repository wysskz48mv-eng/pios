#!/bin/bash
# PIOS Deployment Script — Run all 4 activation steps
# Usage: chmod +x deploy.sh && ./deploy.sh

set -e

PROJECT_REF="vfvfulbcaurqkygjrrhh"
PIOS_APP_URL="https://pios-wysskz48mv-engs-projects.vercel.app"
CRON_SECRET="9dbea7573f319ad2313adb92785d13cdb24572992d4bca66df2c145c02cd501b"

echo "================================================"
echo "PIOS Deployment — 4 Steps"
echo "================================================"

# Step 1: Push database migrations
echo ""
echo "[Step 1/4] Pushing database migrations..."
npx supabase db push --project-ref $PROJECT_REF
echo "Migrations pushed."

# Step 2: Deploy edge functions
echo ""
echo "[Step 2/4] Deploying edge functions..."
supabase functions deploy env-watcher --project-ref $PROJECT_REF
supabase functions deploy auth-flow-tester --project-ref $PROJECT_REF
supabase functions deploy health-check-healer --project-ref $PROJECT_REF
echo "Edge functions deployed."

# Step 3: Set edge function secrets
echo ""
echo "[Step 3/4] Setting edge function secrets..."
supabase secrets set CRON_SECRET=$CRON_SECRET --project-ref $PROJECT_REF
supabase secrets set PIOS_APP_URL=$PIOS_APP_URL --project-ref $PROJECT_REF

# Prompt for Anthropic key if not set
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "Enter your ANTHROPIC_API_KEY (or press Enter to skip):"
  read -r ANTHROPIC_API_KEY
fi
if [ -n "$ANTHROPIC_API_KEY" ]; then
  supabase secrets set ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY --project-ref $PROJECT_REF
fi
echo "Secrets set."

# Step 4: Test agents
echo ""
echo "[Step 4/4] Testing agents..."
echo ""
echo "EnvWatcher:"
curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/env-watcher" | head -c 200
echo ""
echo ""
echo "AuthFlowTester:"
curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/auth-flow-tester" | head -c 200
echo ""
echo ""
echo "HealthCheckHealer:"
curl -s -X POST "https://$PROJECT_REF.supabase.co/functions/v1/health-check-healer" | head -c 200
echo ""

echo ""
echo "================================================"
echo "PIOS deployment complete."
echo ""
echo "Remaining manual step:"
echo "  Add GitHub secrets at:"
echo "  https://github.com/wysskz48mv-eng/pios/settings/secrets/actions"
echo ""
echo "  SUPABASE_SERVICE_ROLE_KEY = (from Supabase dashboard)"
echo "  CRON_SECRET = $CRON_SECRET"
echo "  PIOS_APP_URL = $PIOS_APP_URL"
echo "================================================"
