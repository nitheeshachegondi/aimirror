import type { FounderProduct } from "./types";

export function headers(token: string): Record<string, string> {
  return { "Content-Type": "application/json", "x-edit-token": token };
}

export class ApiError extends Error {
  product?: FounderProduct;
  constructor(message: string, product?: FounderProduct) {
    super(message);
    this.product = product;
  }
}

/**
 * Analyse every unprocessed document, one server call per document (keeps each call under the
 * time limit). Optionally uploads new documents first.
 */
export async function runExtraction(
  id: string,
  token: string,
  docs: { name: string; text: string }[] = [],
  onProgress?: (remaining: number) => void
): Promise<{ product: FounderProduct; warnings: string[] }> {
  let first = true;
  let product: FounderProduct | undefined;
  const warnings: string[] = [];

  for (let i = 0; i < 15; i++) {
    const res = await fetch(`/api/products/${id}/extract`, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify(first ? { documents: docs } : {}),
    });
    first = false;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || "Analysis failed.", data.product);
    product = data.product as FounderProduct;
    warnings.push(...((data.warnings as string[]) || []));
    onProgress?.(data.remaining as number);
    if (!data.remaining) break;
  }
  return { product: product as FounderProduct, warnings };
}
