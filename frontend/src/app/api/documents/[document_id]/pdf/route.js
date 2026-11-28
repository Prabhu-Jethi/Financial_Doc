import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { fetchDocumentPdfUrl } from "../../../../../lib/server/api.js";

export const dynamic = "force-dynamic";

function sanitizeFilename(name) {
  const base = String(name || "document.pdf").replace(/^.*[\\/]/, "");
  const cleaned = base.replace(/["\r\n\0<>:\\/|?*]/g, "_").trim();
  return cleaned || "document.pdf";
}

const DOC_FILE_MAP = {
  "AAPL-10K-2024": "10-Q4-2024-As-Filed.pdf",
  "AAPL-10K-2023": "_10-K-Q4-2023-As-Filed.pdf",
  "AAPL-10K-2022": "_10-K-2022-(As-Filed).pdf",
  "AMZN-10K-2023": "Amazon-com-Inc-2023-Annual-Report.pdf",
  "AMZN-10K-2024": "Amazon-2024-Annual-Report.pdf",
  "AMZN-10K-2025": "Amazon-2025-Annual-Report.pdf",
  "META-10K-2023": "Meta-12-31-2023-10K-ARS.pdf",
  "META-10K-2024": "Meta-12-31-2024-10K-ARS.pdf",
  "MSFT-10K-2022": "MSFT_FY22Q4_10K.pdf",
  "MSFT-10K-2023": "MSFT_FY23Q4_10K.pdf",
  "MSFT-10K-2024": "MSFT_FY24Q4_10K.pdf",
};

const ALIASES = {
  "aapl-202410-10k": "AAPL-10K-2024",
  "aapl-202309-10k": "AAPL-10K-2023",
  "aapl-202209-10k": "AAPL-10K-2022",
  "aapl-2024-10k": "AAPL-10K-2024",
  "aapl-2023-10k": "AAPL-10K-2023",
  "aapl-2022-10k": "AAPL-10K-2022",
  "amzn-2024-10k": "AMZN-10K-2024",
  "amzn-2023-10k": "AMZN-10K-2023",
  "amzn-2025-10k": "AMZN-10K-2025",
  "meta-2024-10k": "META-10K-2024",
  "meta-2023-10k": "META-10K-2023",
  "msft-2024-10k": "MSFT-10K-2024",
  "msft-2023-10k": "MSFT-10K-2023",
  "msft-2022-10k": "MSFT-10K-2022",
};

export async function GET(request, context) {
  try {
    const params = await context.params;
    const rawId = decodeURIComponent(params?.document_id || "");
    const normalizedId = rawId.toUpperCase();
    const lowerId = rawId.toLowerCase();

    let fileName = DOC_FILE_MAP[normalizedId] || DOC_FILE_MAP[ALIASES[lowerId]];

    if (!fileName && !lowerId.startsWith("doc_")) {
      if (lowerId.includes("apple") || lowerId.includes("aapl")) {
        fileName = lowerId.includes("2023")
          ? "_10-K-Q4-2023-As-Filed.pdf"
          : lowerId.includes("2022")
          ? "_10-K-2022-(As-Filed).pdf"
          : "10-Q4-2024-As-Filed.pdf";
      } else if (lowerId.includes("amazon") || lowerId.includes("amzn")) {
        fileName = lowerId.includes("2023")
          ? "Amazon-com-Inc-2023-Annual-Report.pdf"
          : lowerId.includes("2025")
          ? "Amazon-2025-Annual-Report.pdf"
          : "Amazon-2024-Annual-Report.pdf";
      } else if (lowerId.includes("meta")) {
        fileName = lowerId.includes("2023")
          ? "Meta-12-31-2023-10K-ARS.pdf"
          : "Meta-12-31-2024-10K-ARS.pdf";
      } else if (lowerId.includes("microsoft") || lowerId.includes("msft")) {
        fileName = lowerId.includes("2023")
          ? "MSFT_FY23Q4_10K.pdf"
          : lowerId.includes("2022")
          ? "MSFT_FY22Q4_10K.pdf"
          : "MSFT_FY24Q4_10K.pdf";
      }
    }

    // 1. Check local data/originals/ disk directory (public built-in SEC filings only)
    if (fileName) {
      const safeLocalName = sanitizeFilename(fileName);
      const filePath = path.resolve(process.cwd(), "..", "data", "originals", fileName);
      if (fs.existsSync(filePath)) {
        const fileBuffer = fs.readFileSync(filePath);
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${safeLocalName}"`,
            "Content-Length": fileBuffer.length.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    // 2. Resolve uploaded or cloud document via FastAPI pre-signed URL
    const pdfRes = await fetchDocumentPdfUrl(rawId);
    if (pdfRes && !pdfRes.ok && (pdfRes.status === 401 || pdfRes.status === 403)) {
      return new NextResponse("Unauthorized to access this document.", {
        status: pdfRes.status,
        headers: { "Cache-Control": "no-store, private" },
      });
    }

    const pdfMeta = pdfRes?.data;
    if (pdfMeta && pdfMeta.signed_url) {
      const remoteRes = await fetch(pdfMeta.signed_url);
      if (remoteRes.ok) {
        const fileBuffer = Buffer.from(await remoteRes.arrayBuffer());
        const resolvedName = sanitizeFilename(pdfMeta.file_name || fileName || "document.pdf");
        return new NextResponse(fileBuffer, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${resolvedName}"`,
            "Content-Length": fileBuffer.length.toString(),
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    return new NextResponse("PDF document not found.", {
      status: 404,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    return new NextResponse("Error reading PDF filing.", {
      status: 500,
      headers: { "Cache-Control": "no-store, private" },
    });
  }
}
