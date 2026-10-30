export type FeatureStatus = "included" | "clarify" | "excluded";

/** Where in the founder's document a feature came from. */
export interface FeatureSource {
  docId: string;
  docName: string;
  passage: string;
  start: number;
  end: number;
  /** true = exact passage found in the document; false = closest match, founder should verify */
  verified: boolean;
}

export interface Feature {
  id: string;
  title: string;
  description: string;
  category: string;
  status: FeatureStatus;
  /** Set when the founder publishes. Only included + approved features are public. */
  approved: boolean;
  origin: "ai" | "founder";
  source: FeatureSource | null;
  /** The AI's first wording, so the founder can restore it after editing. */
  original: { title: string; description: string; category: string } | null;
  /** Why this feature needs clarification (set by the extractor). */
  note: string;
}

export interface DocumentRec {
  id: string;
  name: string;
  text: string;
  /** Founder chose to show this document publicly as a supporting document */
  isPublic: boolean;
  processed: boolean;
  /** Document was longer than the analysis limit */
  truncated: boolean;
  addedAt: string;
}

export interface Showcase {
  tagline: string;
  what: string;
  problem: string;
  differentiators: string[];
  whoFor: string[];
  notFor: string[];
  pricing: string;
  limitations: string[];
  demoUrl: string;
  screenshots: string[];
  founderNote: string;
}

export interface Product {
  /** Also the public URL slug */
  id: string;
  /** Secret edit token; never sent to the public */
  token: string;
  name: string;
  website: string;
  showcase: Showcase;
  features: Feature[];
  documents: DocumentRec[];
  /** Passages the founder said don't need to become features ("docId:start") */
  dismissed: string[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export type FounderProduct = Omit<Product, "token">;

export interface PublicFeature {
  id: string;
  title: string;
  description: string;
  category: string;
  source: { docName: string; passage: string } | null;
}

export interface PublicProduct {
  id: string;
  name: string;
  website: string;
  showcase: Showcase;
  features: PublicFeature[];
  documents: { id: string; name: string; text: string }[];
  publishedAt: string;
  updatedAt: string;
}

export const emptyShowcase = (): Showcase => ({
  tagline: "",
  what: "",
  problem: "",
  differentiators: [],
  whoFor: [],
  notFor: [],
  pricing: "",
  limitations: [],
  demoUrl: "",
  screenshots: [],
  founderNote: "",
});
