import type { NextConfig } from "next";

const cloudinaryCspSources = [
  "https://upload-widget.cloudinary.com",
  "https://widget.cloudinary.com",
  "https://api.cloudinary.com",
  "https://upload.cloudinary.com",
  "https://res.cloudinary.com",
  "https://*.cloudinary.com",
];

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://js.stripe.com https://cdn.jsdelivr.net ${cloudinaryCspSources.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  `img-src 'self' data: ${cloudinaryCspSources.join(" ")} https://*.dbu.dk https://lgu.dk https://www.lgu.dk`,
  `connect-src 'self' https://api.stripe.com ${cloudinaryCspSources.join(" ")}`,
  `frame-src https://js.stripe.com ${cloudinaryCspSources.join(" ")}`,
  "font-src 'self' https://cdn.jsdelivr.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "live-911-vorbasse-b-af-1912.umbraco-proxy.com" },
      { protocol: "https", hostname: "file.dbu.dk" },
      { protocol: "https", hostname: "lgu.dk" },
      { protocol: "https", hostname: "www.lgu.dk" },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
