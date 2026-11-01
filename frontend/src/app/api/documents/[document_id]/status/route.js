import { NextResponse } from "next/server";
import { fetchDocumentStatusFromFastAPI } from "../../../../../lib/server/api.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for LLM/PDF extraction

export async function GET(request, context) {
  try {
    const params = await context.params;
    const documentId = decodeURIComponent(params?.document_id || "");

    if (!documentId) {
      return NextResponse.json(
        { detail: "Document ID is required." },
        { status: 400 }
      );
    }

    const statusData = await fetchDocumentStatusFromFastAPI(documentId);

    return NextResponse.json(statusData, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      {
        detail: err.message || "Failed to retrieve document status.",
      },
      {
        status,
        headers: {
          "Cache-Control": "no-store, private",
        },
      }
    );
  }
}

