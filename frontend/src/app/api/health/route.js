import { NextResponse } from "next/server";
import { checkFastAPIHealth } from "../../../lib/server/api.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendHealth = await checkFastAPIHealth();

  return NextResponse.json({
    frontend: "ok",
    backend_live: backendHealth.live,
    database_ready: backendHealth.ready,
    timestamp: new Date().toISOString(),
  });
}
