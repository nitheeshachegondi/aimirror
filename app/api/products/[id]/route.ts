import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveProduct } from "@/lib/store";
import { clamp, normalizeUrl, sanitizeFeatures, sanitizeShowcase, str } from "@/lib/sanitize";
import { founderView } from "@/lib/views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  return NextResponse.json(founderView(r.product));
}

/** Save the founder's edits. Extraction output and approval flags are never taken from the client. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  const product = r.product;

  try {
    const raw = await req.text();
    if (raw.length > 1_500_000) return NextResponse.json({ error: "Request is too large." }, { status: 413 });
    const body = JSON.parse(raw) as Record<string, unknown>;

    const name = clamp(str(body.name), 80);
    if (name) product.name = name;
    const website = normalizeUrl(body.website);
    if (website) product.website = website;

    product.showcase = sanitizeShowcase(body.showcase);

    const docFlags = new Map(
      (Array.isArray(body.documents) ? body.documents : []).map((d) => {
        const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>;
        return [str(o.id), o.isPublic === true] as const;
      })
    );
    product.documents = product.documents.map((d) => (docFlags.has(d.id) ? { ...d, isPublic: docFlags.get(d.id) as boolean } : d));

    product.features = sanitizeFeatures(body.features, product.features, product.documents);
    product.dismissed = (Array.isArray(body.dismissed) ? body.dismissed : []).map((x) => str(x)).filter(Boolean).slice(0, 1000);
    product.updatedAt = new Date().toISOString();

    await saveProduct(product);
    return NextResponse.json(founderView(product));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not save." }, { status: 400 });
  }
}
