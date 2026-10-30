import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveProduct } from "@/lib/store";
import { extractFromDocument } from "@/lib/extract";
import { GroqError } from "@/lib/groq";
import { clamp, MAX_DOC_CHARS, mergeShowcase, str } from "@/lib/sanitize";
import { newId } from "@/lib/text";
import { founderView } from "@/lib/views";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Processes ONE unprocessed document per call (so each call stays within the time limit) and
 * reports how many remain. Optionally appends new documents first.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  const product = r.product;

  try {
    const raw = await req.text();
    if (raw.length > 4_000_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;

    const incoming = Array.isArray(body.documents) ? body.documents : [];
    for (const d of incoming.slice(0, 8)) {
      if (product.documents.length >= 12) break;
      const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
      const text = String(o.text ?? "").replace(/\r/g, "").slice(0, MAX_DOC_CHARS).trim();
      if (text.length < 40) continue;
      product.documents.push({
        id: newId("d"),
        name: clamp(str(o.name), 120) || "Document",
        text,
        isPublic: false,
        processed: false,
        truncated: false,
        addedAt: new Date().toISOString(),
      });
    }

    const doc = product.documents.find((d) => !d.processed);
    let warnings: string[] = [];

    if (doc) {
      try {
        const res = await extractFromDocument(doc, product.features);
        product.features.push(...res.features);
        product.showcase = mergeShowcase(product.showcase, res.patch);
        doc.processed = true;
        doc.truncated = res.truncated;
        warnings = res.warnings;
      } catch (e) {
        product.updatedAt = new Date().toISOString();
        await saveProduct(product); // keep any newly added documents
        const status = e instanceof GroqError ? e.status : 500;
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Analysis failed.", product: founderView(product) },
          { status }
        );
      }
    }

    product.updatedAt = new Date().toISOString();
    await saveProduct(product);
    return NextResponse.json({
      product: founderView(product),
      remaining: product.documents.filter((d) => !d.processed).length,
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed." }, { status: 400 });
  }
}
