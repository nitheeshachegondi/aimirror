import type { FounderProduct, Product, PublicProduct } from "./types";

export function founderView(p: Product): FounderProduct {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token, ...rest } = p;
  return rest;
}

/** What visitors may see: only approved, included features; only documents the founder made public. */
export function publicView(p: Product): PublicProduct {
  return {
    id: p.id,
    name: p.name,
    website: p.website,
    showcase: p.showcase,
    features: p.features
      .filter((f) => f.status === "included" && f.approved)
      .map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        category: f.category,
        source: f.source ? { docName: f.source.docName, passage: f.source.passage } : null,
      })),
    documents: p.documents.filter((d) => d.isPublic).map((d) => ({ id: d.id, name: d.name, text: d.text })),
    publishedAt: p.publishedAt || p.updatedAt,
    updatedAt: p.updatedAt,
  };
}
