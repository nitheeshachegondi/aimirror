import { NextResponse } from "next/server";
import { listProducts, saveProduct } from "@/lib/store";
import { buildSampleProducts } from "@/lib/sample";

export const runtime = "nodejs";

/** Loads three fictional sample products so discovery can be demoed. Disabled in production unless ALLOW_SEED=1. */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "1") {
    return NextResponse.json({ error: "Seeding is disabled." }, { status: 403 });
  }
  const existing = await listProducts();
  if (existing.some((p) => p.website.startsWith("https://example.com/"))) {
    return NextResponse.json({ added: 0, note: "Sample products already loaded." });
  }
  const samples = buildSampleProducts();
  for (const p of samples) await saveProduct(p);
  return NextResponse.json({ added: samples.length });
}
