#!/bin/bash

# Sentry Setup Script for PIOS
set -e

echo "🚀 Setting up Sentry for PIOS..."

# 1. Create instrumentation-client.ts
cat > instrumentation-client.ts << 'EOF'
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? "___PUBLIC_DSN___",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  enableLogs: true,
  integrations: [
    Sentry.replayIntegration(),
    Sentry.feedbackIntegration({ colorScheme: "system", triggerLabel: "Report Issue" }),
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
EOF

# 2. Create sentry.server.config.ts
cat > sentry.server.config.ts << 'EOF'
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "___DSN___",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  includeLocalVariables: true,
  enableLogs: true,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
});
EOF

# 3. Create sentry.edge.config.ts
cat > sentry.edge.config.ts << 'EOF'
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "___DSN___",
  sendDefaultPii: true,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  enableLogs: true,
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
});
EOF

# 4. Create instrumentation.ts
cat > instrumentation.ts << 'EOF'
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
EOF

# 5. Create app/global-error.tsx
mkdir -p app
cat > app/global-error.tsx << 'EOF'
"use client";

import * as Sentry from "@sentry/nextjs";
import NextError from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  );
}
EOF

# 6. Create next.config.ts
if [ -f "next.config.ts" ] || [ -f "next.config.js" ]; then
  echo "⚠️  Backing up existing next.config..."
  [ -f "next.config.ts" ] && cp next.config.ts next.config.backup.ts
  [ -f "next.config.js" ] && cp next.config.js next.config.backup.js
fi

cat > next.config.ts << 'EOF'
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  swcMinify: true,
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG || "___ORG_SLUG___",
  project: process.env.SENTRY_PROJECT || "___PROJECT_SLUG___",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  silent: !process.env.CI,
});
EOF

# 7. Create .env.local
if [ -f ".env.local" ]; then
  echo "⚠️  Backing up existing .env.local..."
  cp .env.local .env.local.backup
fi

cat > .env.local << 'EOF'
NEXT_PUBLIC_SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_DSN=https://your-key@your-org.ingest.sentry.io/your-project-id
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
NODE_ENV=development
EOF

# 8. Update .gitignore
if ! grep -q ".env.sentry-build-plugin" .gitignore 2>/dev/null; then
  echo ".env.sentry-build-plugin" >> .gitignore
fi

echo ""
echo "✅ Sentry setup complete!"
echo ""
echo "📋 Files created:"
echo "   ✓ instrumentation-client.ts"
echo "   ✓ sentry.server.config.ts"
echo "   ✓ sentry.edge.config.ts"
echo "   ✓ instrumentation.ts"
echo "   ✓ app/global-error.tsx"
echo "   ✓ next.config.ts"
echo "   ✓ .env.local"
echo ""
echo "🔑 Next steps:"
echo "1. Go to https://sentry.io/signup/"
echo "2. Create Next.js project and copy your DSN"
echo "3. Edit .env.local with your DSN and org/project slugs"
echo "4. Run: npm run dev"
echo "5. Test in browser console: throw new Error('Test Sentry')"
echo ""
