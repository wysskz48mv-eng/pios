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
