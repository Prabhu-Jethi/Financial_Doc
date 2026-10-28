import { NextResponse } from "next/server";
import { uploadDocumentToFastAPI } from "../../../../lib/server/api.js";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { detail: "No file was uploaded. Please attach a valid PDF document." },
        { status: 400 }
      );
    }

    if (!file.name?.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { detail: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    // Default doc_type to general if not provided
    if (!formData.has("doc_type")) {
      formData.set("doc_type", "general");
    }

    const result = await uploadDocumentToFastAPI(formData);

    return NextResponse.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, private",
      },
    });
  } catch (err) {
    const status = err.status || 500;
    return NextResponse.json(
      {
        detail: err.message || "An unexpected error occurred during document ingestion.",
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

