import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

import { PRODUCTION_ORIGIN } from "./src/seo/policy";
import assessmentRegistry from "./src/content/assessment-publications/registry.json";
import facilityRegistry from "./src/content/facility-releases/registry.json";
import { contentSecurityPolicy, cspMode, PUBLICATION_CSP } from "./src/lib/security/csp";

const assessmentFiles = assessmentRegistry.filter(entry => entry.status === "available").flatMap(entry =>
  ["snapshot.json", "narrative.json", "brief.html", "brief.pdf", "manifest.json"].map(file =>
    `./src/content/assessment-publications/${entry.publicationId}/${entry.version}/${file}`));
const facilityFiles = facilityRegistry.filter((entry: {status: string}) => entry.status === "available").flatMap((entry: {release: string}) => {
  const base = `./src/content/facility-releases/${entry.release}`;
  const manifest = JSON.parse(readFileSync(`${base}/manifest.json`, "utf8")) as { files: { file: string }[] };
  // The prebuild validator checks each manifest and exact file allowlist.
  return ["manifest.json", ...manifest.files.map(item => item.file)].map(file => `${base}/${file}`);
});

const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{
    key: cspMode(process.env.GRIDNINJA_CSP_MODE) === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    value: contentSecurityPolicy({ https: process.env.VERCEL === "1" || process.env.GRIDNINJA_HTTPS === "1" }),
  }] : []),
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Cross-Origin-Opener-Policy",
    value: "same-origin",
  },
];

const noindexHeaders = [
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const nextConfig: NextConfig = {
  agentRules: false,
  outputFileTracingIncludes: {
    "/evidence/assessments/*/*": assessmentFiles,
    "/downloads/assessment/*/*/*": assessmentFiles,
    "/assets/facility/*/*": facilityFiles,
    "/": facilityFiles,
    "/demo": facilityFiles,
    "/api/internal/lead-staging-preflight": ["./.next/facility-build.json", "./.next/BUILD_ID"],
  },
  outputFileTracingExcludes: {
    "/*": ["./assets-source/**/*", "./build/facility/**/*"],
  },
  async redirects() {
    return [
      { source: "/roi", destination: "/assessment", permanent: true },
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.gridninja.ai",
          },
        ],
        destination: `${PRODUCTION_ORIGIN}/:path*`,
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      ...(process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production"
        ? [
            {
              source: "/(.*)",
              headers: noindexHeaders,
            },
          ]
        : []),
      {
        source: "/:path*",
        has: [
          {
            type: "host" as const,
            value: "(?<vercelAlias>.+\\.vercel\\.app)",
          },
        ],
        headers: noindexHeaders,
      },
      {
        source: "/evidence/releases/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, follow, noarchive",
          },
          {
            key: "Link",
            value: `<${PRODUCTION_ORIGIN}/evidence>; rel=\"canonical\"`,
          },
        ],
      },
      // Next may retain config headers rather than replacing them with the
      // route-handler CSP. Explicit later matches preserve frozen documents'
      // stronger script-free policy, including report-only staging builds.
      ...["/evidence/assessments/:path*", "/downloads/assessment/:path*"].map(source => ({
        source,
        headers: [{ key: "Content-Security-Policy", value: PUBLICATION_CSP }],
      })),
    ];
  },
};

export default nextConfig;
