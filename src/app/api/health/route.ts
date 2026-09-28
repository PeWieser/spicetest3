// CircuitBench health check - no database required.
// Marked as force-static so the route also survives a static export
// (`output: 'export'` for Cloudflare Pages).
export const dynamic = "force-static";

export function GET() {
  return Response.json({
    ok: true,
    app: "circuitbench",
    storage: "browser-localStorage",
  });
}
