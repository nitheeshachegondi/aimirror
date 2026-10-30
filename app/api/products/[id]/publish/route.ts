import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";
import { saveProduct } from "@/lib/store";
import { founderView } from "@/lib/views";

export const runtime = "nodejs";

/** The founder's explicit approval. Publishing approves every feature currently marked "included". */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const r = await requireOwner(req, params.id);
  if (r.error) return r.error;
  const product = r.product;

  const body = (await req.json().catch(() => ({}))) as { publish?: boolean };
  const now = new Date().toISOString();

  if (body.publish === false) {
    product.status = "draft";
  } else {
    const included = product.features.filter((f) => f.status === "included");
    const problems: string[] = [];
    if (!product.showcase.tagline.trim()) problems.push("add a one-line tagline");
    if (!product.showcase.what.trim()) problems.push('fill in "What it is"');
    if (!included.length) problems.push("include at least one feature");
    if (problems.length) {
      return NextResponse.json({ error: `Before publishing, please ${problems.join(", ")}.` }, { status: 400 });
    }
    product.features = product.features.map((f) => (f.status === "included" ? { ...f, approved: true } : f));
    product.status = "published";
    product.publishedAt = product.publishedAt || now;
  }

  product.updatedAt = now;
  await saveProduct(product);
  return NextResponse.json(founderView(product));
}
