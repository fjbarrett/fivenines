import type { NextConfig } from "next";

// Content-Security-Policy kept compatible with the Google Analytics (GA4) tags in
// layout.tsx: gtag.js loads from googletagmanager.com and beacons to
// *.google-analytics.com. 'unsafe-inline' on script-src is needed for the small
// inline GA bootstrap; everything else is locked down. (To drop 'unsafe-inline'
// later, switch to a nonce-based CSP via middleware.) There is no
// dangerouslySetInnerHTML or user-rendered HTML anywhere, so XSS surface is low.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
  "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
  "font-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS for two years (Vercel already serves HTTPS; this also covers a
  // future custom domain). Add `; preload` only on an apex domain you control.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // /cdns redirects to the canonical /cdn page
      { source: "/cdns", destination: "/cdn", permanent: true },
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
