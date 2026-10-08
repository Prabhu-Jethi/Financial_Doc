import { NextResponse } from "next/server";
import { fetchDocumentMetadata } from "../../../lib/server/api.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const documents = await fetchDocumentMetadata();
  return NextResponse.json({
    documents,
    count: documents.length,
    timestamp: new Date().toISOString(),
  });
}
