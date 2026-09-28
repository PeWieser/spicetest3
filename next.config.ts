import type { NextConfig } from "next";

// CircuitBench runs fully client-side (schematic editor + SPICE solver both
// live in the browser). Two build modes are supported:
//
// 1. Default build (used by `npm run build` / `next start`):
//      keeps the static /api/health route handler.
//
// 2. Static export for Cloudflare Pages:
//      CB_STATIC_EXPORT=1 npx next build
//    emits a plain `out/` folder of HTML/JS/CSS with zero server code,
//    which Pages serves directly from its CDN. Persistence then happens
//    exclusively in the browser (localStorage + file download/upload).
const isStaticExport = process.env.CB_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" as const } : {}),
  // Required for `output: "export"`; harmless otherwise (no remote images used).
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
