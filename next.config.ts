import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// The browser talks to Supabase directly on the invite, password and settings pages
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
})();

// Content Security Policy, following the "Without Nonces" option in the Next.js
// guide (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
// It starts as report-only: violations show in the browser console without
// blocking anything. Switch the header name to `Content-Security-Policy` once a
// week of normal use shows no reports (security Checkpoint 3).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Listing photos come from every marketplace
  "img-src 'self' https: data: blob:",
  // next/font serves Figtree from this site
  "font-src 'self'",
  `connect-src 'self' ${supabaseOrigin}${isDev ? " ws:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]),
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
