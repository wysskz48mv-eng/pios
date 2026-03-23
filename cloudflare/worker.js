/**
 * VeritasIQ Technologies Ltd — Production Security Worker
 * ========================================================
 * ISO 27001 Controls: A.8.20, A.8.21, A.8.23 (WAF/Network security)
 * Risk mitigation: R-015 (Cloudflare WAF not deployed)
 *
 * DEPLOY:
 *   1. Cloudflare Dashboard → Workers & Pages → Create Application → Create Worker
 *   2. Paste this entire script
 *   3. Deploy
 *   4. Set route: *.veritasedge.com/*, *.investiscript.vercel.app/*, *.pios.vercel.app/*
 *      OR set as zone-wide worker if custom domains are configured
 *
 * ALSO: Create WAF Custom Rules in Cloudflare Dashboard:
 *   Security → WAF → Custom Rules (see rules at bottom of this file)
 */

const COMPANY = "VeritasIQ Technologies Ltd";
const IP_NOTICE = `© ${new Date().getFullYear()} ${COMPANY}. Proprietary and confidential. Automated extraction prohibited.`;

// Allowed origins — update when new domains are confirmed
const ALLOWED_ORIGINS = [
  "https://veritasedge.com",
  "https://www.veritasedge.com",
  "https://app.veritasedge.com",
  "https://investiscript.vercel.app",
  "https://pios-wysskz48mv-engs-projects.vercel.app",
  // Add custom domains when configured
];

// Paths that must never be accessible in production
const BLOCKED_PATHS = [
  "/docs", "/redoc", "/openapi.json", "/swagger",
  "/.env", "/.env.local", "/.git",
  "/api/admin/debug", "/api/internal",
];

// Bot signatures that warrant a challenge (not outright block — legitimate integrations use these too)
const BOT_UA_PATTERNS = [
  "python-requests", "scrapy", "wget/", "curl/",
  "go-http-client", "java/", "okhttp", "PhantomJS",
  "HeadlessChrome", "Selenium",
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.toLowerCase();
    const ua = request.headers.get("user-agent") || "";
    const origin = request.headers.get("origin") || "";

    // ── 1. Block forbidden paths ───────────────────────────────────
    if (BLOCKED_PATHS.some(p => path.startsWith(p))) {
      return new Response("Not found.", {
        status: 404,
        headers: { "Content-Type": "text/plain" }
      });
    }

    // ── 2. Bot detection — challenge suspicious UAs on API paths ───
    if (path.startsWith("/api/") && BOT_UA_PATTERNS.some(p => ua.toLowerCase().includes(p))) {
      // Log but don't block — legitimate integrations may use these
      console.log(`[SECURITY] Bot UA detected: ${ua} → ${path}`);
      // For bulk/export endpoints, block non-browser UAs entirely:
      if (path.includes("/export") || path.includes("/bulk")) {
        return new Response(JSON.stringify({ error: "Automated bulk access not permitted." }), {
          status: 403,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    // ── 3. Forward to origin ───────────────────────────────────────
    let response;
    try {
      response = await fetch(request);
    } catch (err) {
      return new Response("Service temporarily unavailable.", { status: 503 });
    }

    // ── 4. Build secure response headers ──────────────────────────
    const headers = new Headers(response.headers);

    // Security headers
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-Frame-Options", "DENY");
    headers.set("X-XSS-Protection", "1; mode=block");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    headers.set("Content-Security-Policy", [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self' https://api.anthropic.com https://*.supabase.co",
      "font-src 'self' data:",
      "frame-ancestors 'none'",
    ].join("; "));

    // IP Notice headers (appear in any API recording/capture)
    headers.set("X-IP-Notice", IP_NOTICE);
    headers.set("X-Content-Owner", COMPANY);
    headers.set("X-Scraping-Policy", "Automated extraction prohibited. See /terms.");

    // Strip infrastructure-revealing headers
    headers.delete("Server");
    headers.delete("X-Powered-By");
    headers.delete("X-Vercel-Id");
    headers.delete("X-Vercel-Cache");
    headers.delete("Via");

    // ── 5. CORS handling ───────────────────────────────────────────
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
      headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-ID");
      headers.set("Vary", "Origin");
    } else if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      // Unknown origin — remove CORS headers to block cross-origin requests
      headers.delete("Access-Control-Allow-Origin");
    }

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
};

/*
 * ─── CLOUDFLARE WAF CUSTOM RULES (create in Dashboard) ───────────────────────
 *
 * Rule 1: Block AI inference endpoint bulk access
 *   Expression: (http.request.uri.path matches "^/api/(obe|lie|anomaly|forecast)" and
 *                not http.request.headers["authorization"] matches "^Bearer .+")
 *   Action: Block
 *
 * Rule 2: Challenge automation on API endpoints
 *   Expression: (http.request.uri.path matches "^/api/" and
 *                http.user_agent contains "python-requests")
 *   Action: Managed Challenge
 *
 * Rule 3: Block bulk export without auth
 *   Expression: (http.request.uri.path matches "^/api/(bulk|export|report)" and
 *                not http.request.headers["authorization"] matches "^Bearer .+")
 *   Action: Block
 *
 * ─── RATE LIMITING RULES (Security → Rate Limiting) ──────────────────────────
 *
 * Rule 1: AI endpoints — 50 requests per 10 minutes per IP
 *   Path: /api/obe*, /api/lie*, /api/anomaly*
 *   Threshold: 50 / 600 seconds
 *   Action: Block for 3600 seconds
 *
 * Rule 2: Auth endpoints — 10 requests per 15 minutes per IP
 *   Path: /api/auth/*, /auth/*
 *   Threshold: 10 / 900 seconds
 *   Action: Block for 3600 seconds
 *
 * Rule 3: General API — 200 requests per hour per IP
 *   Path: /api/*
 *   Threshold: 200 / 3600 seconds
 *   Action: Block for 600 seconds
 */
