import type { DocumentRec, Feature, FeatureSource, FeatureStatus, Showcase } from "./types";
import { emptyShowcase } from "./types";
import { newId } from "./text";

export const MAX_DOC_CHARS = 200_000;
export const MAX_ANALYZE_CHARS = 60_000;

export const str = (v: unknown, fallback = ""): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : fallback;

export const clamp = (s: string, n: number) => (s.length > n ? s.slice(0, n) : s);

export function strList(v: unknown, maxItems = 20, maxLen = 300): string[] {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return arr
    .map((x) => clamp(str(x), maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Returns a normalised http(s) URL or "" if invalid. */
export function normalizeUrl(v: unknown): string {
  const raw = str(v);
  if (!raw) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    if (!u.hostname.includes(".")) return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function sanitizeShowcase(v: unknown): Showcase {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const base = emptyShowcase();
  return {
    tagline: clamp(str(o.tagline, base.tagline), 160),
    what: clamp(str(o.what), 1500),
    problem: clamp(str(o.problem), 1500),
    differentiators: strList(o.differentiators),
    whoFor: strList(o.whoFor),
    notFor: strList(o.notFor),
    pricing: clamp(str(o.pricing), 500),
    limitations: strList(o.limitations),
    demoUrl: normalizeUrl(o.demoUrl),
    screenshots: strList(o.screenshots, 8, 500)
      .map(normalizeUrl)
      .filter((u) => u.startsWith("https://")),
    founderNote: clamp(str(o.founderNote), 6000),
  };
}

/** Fill only the empty fields of `base` from `patch` (never overwrite the founder's edits). */
export function mergeShowcase(base: Showcase, patch: Partial<Showcase>): Showcase {
  const out: Showcase = { ...base };
  const strKeys: (keyof Showcase)[] = ["tagline", "what", "problem", "pricing"];
  for (const k of strKeys) {
    if (!out[k] && patch[k]) (out[k] as string) = patch[k] as string;
  }
  const listKeys: ("differentiators" | "whoFor" | "notFor" | "limitations")[] = [
    "differentiators",
    "whoFor",
    "notFor",
    "limitations",
  ];
  for (const k of listKeys) {
    const seen = new Set(out[k].map((s) => s.toLowerCase()));
    for (const item of patch[k] || []) {
      if (!seen.has(item.toLowerCase())) {
        out[k] = [...out[k], item];
        seen.add(item.toLowerCase());
      }
    }
  }
  return out;
}

const STATUSES: FeatureStatus[] = ["included", "clarify", "excluded"];

/** Rebuild the client's feature list defensively. Source text is always re-derived from the stored document. */
export function sanitizeFeatures(v: unknown, existing: Feature[], docs: DocumentRec[]): Feature[] {
  if (!Array.isArray(v)) return existing;
  const byId = new Map(existing.map((f) => [f.id, f]));
  const docById = new Map(docs.map((d) => [d.id, d]));
  const out: Feature[] = [];
  const seen = new Set<string>();

  for (const raw of v.slice(0, 400)) {
    const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const prev = byId.get(str(o.id));
    const id = prev ? prev.id : newId("f");
    if (seen.has(id)) continue;
    seen.add(id);

    const title = clamp(str(o.title), 120);
    if (!title) continue;
    const status = STATUSES.includes(o.status as FeatureStatus) ? (o.status as FeatureStatus) : "included";

    let source: FeatureSource | null = prev ? prev.source : null;
    if (!prev && o.source && typeof o.source === "object") {
      const s = o.source as Record<string, unknown>;
      const doc = docById.get(str(s.docId));
      const start = Number(s.start);
      const end = Number(s.end);
      if (doc && Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end > start && end <= doc.text.length && end - start <= 1200) {
        source = { docId: doc.id, docName: doc.name, passage: doc.text.slice(start, end), start, end, verified: true };
      }
    }

    out.push({
      id,
      title,
      description: clamp(str(o.description), 800),
      category: clamp(str(o.category), 40) || "General",
      status,
      approved: prev ? prev.approved : false,
      origin: prev ? prev.origin : "founder",
      source,
      original: prev ? prev.original : null,
      note: clamp(str(o.note), 300),
    });
  }
  return out;
}
