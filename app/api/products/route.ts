import { NextResponse } from "next/server";
import { newProductId, newToken, saveProduct } from "@/lib/store";
import { clamp, MAX_DOC_CHARS, normalizeUrl, str } from "@/lib/sanitize";
import { emptyShowcase } from "@/lib/types";
import { newId } from "@/lib/text";
import type { DocumentRec, Product } from "@/lib/types";

export const runtime = "nodejs";

/** Create a draft product with its documents. Extraction runs in a separate call. */
export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 4_000_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;

    const name = clamp(str(body.name), 80);
    const website = normalizeUrl(body.website);
    if (!name) return NextResponse.json({ error: "Please enter your product name." }, { status: 400 });
    if (!website) return NextResponse.json({ error: "Please enter a valid website URL (people will visit it from your showcase)." }, { status: 400 });

    const now = new Date().toISOString();
    const documents: DocumentRec[] = (Array.isArray(body.documents) ? body.documents : [])
      .slice(0, 8)
      .map((d) => {
        const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
        return {
          id: newId("d"),
          name: clamp(str(o.name), 120) || "Document",
          text: String(o.text ?? "").replace(/\r/g, "").slice(0, MAX_DOC_CHARS).trim(),
          isPublic: false,
          processed: false,
          truncated: false,
          addedAt: now,
        };
      })
      .filter((d) => d.text.length >= 40);

    if (!documents.length) {
      return NextResponse.json({ error: "Add at least one document (or paste some text) describing your product." }, { status: 400 });
    }

    const product: Product = {
      id: newProductId(name),
      token: newToken(),
      name,
      website,
      showcase: emptyShowcase(),
      features: [],
      documents,
      dismissed: [],
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    await saveProduct(product);
    return NextResponse.json({ id: product.id, token: product.token });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not create the product." }, { status: 500 });
  }
}
