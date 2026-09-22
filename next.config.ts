import type { NextConfig } from "next";

import { PRODUCTION_ORIGIN } from "./src/seo/policy";
import assessmentRegistry from "./src/content/assessment-publications/registry.json";

const assessmentFiles = assessmentRegistry.filter(entry => entry.status === "available").flatMap(entry =>
  ["snapshot.json", "narrative.json", "brief.html", "brief.pdf", "manifest.json"].map(file =>
    `./src/content/assessment-publications/${entry.publicationId}/${entry.version}/${file}`));

const securityHeaders = [
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
  outputFileTracingIncludes: {
    "/evidence/assessments/*/*": assessmentFiles,
    "/downloads/assessment/*/*/*": assessmentFiles,
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
    ];
  },
};

export default nextConfig;
