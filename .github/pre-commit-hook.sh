#!/bin/bash
# VeritasIQ Technologies Ltd — Pre-commit Security Hook
# IS-POL-008 (SSDLC) — No secrets in code
# Install: cp .git/hooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

echo "🔒 VeritasIQ security pre-commit check..."

SECRETS_PATTERN="(sk_live_|sk_test_|pk_live_|pk_test_|ghp_|ghs_|ANTHROPIC_API_KEY\s*=\s*['\"]sk-|SUPABASE_SERVICE_ROLE\s*=\s*['\"]|NEXTAUTH_SECRET\s*=\s*['\"][A-Za-z0-9+/]{20})"

if git diff --cached --name-only | xargs grep -lE "$SECRETS_PATTERN" 2>/dev/null | grep -v ".example" | grep -v "node_modules"; then
  echo "❌ BLOCKED: Secret pattern detected in staged files."
  echo "   Use Vercel environment variables — never commit secrets."
  echo "   IS-POL-008 / IS-POL-003"
  exit 1
fi

if git diff --cached --name-only | grep -qE "^\.env(\.(local|production|development))?$"; then
  echo "❌ BLOCKED: .env file staged for commit."
  exit 1
fi

echo "✅ Pre-commit check passed."
exit 0
