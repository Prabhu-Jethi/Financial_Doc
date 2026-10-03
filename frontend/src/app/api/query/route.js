import { NextResponse } from "next/server";
import { forwardQueryToFastAPI } from "../../../lib/server/api.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const requestId =
    req.headers.get("x-request-id") ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await req.json();

    if (!body.question || typeof body.question !== "string" || body.question.trim().length === 0) {
      return NextResponse.json(
        { error: "Question cannot be empty" },
        { status: 422 }
      );
    }

    const answer = await forwardQueryToFastAPI(body, requestId);

    return NextResponse.json(answer, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
        "X-Request-ID": requestId,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err.message || "An unexpected error occurred while communicating with backend",
        request_id: requestId,
      },
      {
        status: err.message?.includes("deadline") ? 504 : 502,
        headers: {
          "Cache-Control": "no-store, private",
          "X-Request-ID": requestId,
        },
      }
    );
  }
}
