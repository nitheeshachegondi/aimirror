import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getProduct } from "./store";
import type { Product } from "./types";

/** Verifies the x-edit-token header against the stored product token. */
export async function requireOwner(
  req: Request,
  id: string
): Promise<{ product: Product; error?: undefined } | { product?: undefined; error: NextResponse }> {
  const product = await getProduct(id);
  if (!product) return { error: NextResponse.json({ error: "Product not found." }, { status: 404 }) };
  const a = Buffer.from(req.headers.get("x-edit-token") || "");
  const b = Buffer.from(product.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { error: NextResponse.json({ error: "That edit link isn't valid for this product." }, { status: 401 }) };
  }
  return { product };
}
