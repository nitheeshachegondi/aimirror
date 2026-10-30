import { NextResponse } from "next/server";
import { listPublished } from "@/lib/store";
import { searchProducts } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") || "").slice(0, 400);
  const products = await listPublished();
  const result = await searchProducts(q, products);
  return NextResponse.json(result);
}
