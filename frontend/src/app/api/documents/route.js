import { NextResponse } from "next/server";
import { fetchDocumentMetadata } from "../../../lib/server/api.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow up to 60s for LLM/PDF extraction

export async function GET() {
  const documents = await fetchDocumentMetadata();
  return NextResponse.json({
    documents,
    count: documents.length,
    timestamp: new Date().toISOString(),
  });
}
