import { groqJSON } from "./groq";
import { EXTRACT_SYSTEM } from "./prompts";
import { clamp, MAX_ANALYZE_CHARS, str, strList } from "./sanitize";
import { locatePassage, makeWindows, newId } from "./text";
import type { DocumentRec, Feature, FeatureSource, FeatureStatus, Showcase } from "./types";

interface RawWindowResult {
  product?: Record<string, unknown>;
  features?: Record<string, unknown>[];
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Extract features (each linked to its source passage) and product-level facts from one document.
 * Long documents are processed in windows so nothing is silently skipped; anything beyond
 * the analysis limit is flagged via `truncated`.
 */
export async function extractFromDocument(
  doc: DocumentRec,
  existing: Feature[]
): Promise<{ features: Feature[]; patch: Partial<Showcase>; truncated: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const truncated = doc.text.length > MAX_ANALYZE_CHARS;
  if (truncated) {
    warnings.push(
      `"${doc.name}" is long — only the first ${MAX_ANALYZE_CHARS.toLocaleString()} characters were analysed. Check the "not yet covered" list for the rest.`
    );
  }

  const windows = makeWindows(doc.text.slice(0, MAX_ANALYZE_CHARS), 9000);
  const categories: string[] = [];
  existing.forEach((f) => {
    if (f.category && !categories.includes(f.category)) categories.push(f.category);
  });

  const raws: Record<string, unknown>[] = [];
  const patch: Partial<Showcase> = { differentiators: [], whoFor: [], notFor: [], limitations: [] };

  for (let i = 0; i < windows.length; i++) {
    const user = `DOCUMENT: ${doc.name}
PART ${i + 1} OF ${windows.length}
CATEGORIES USED SO FAR: ${categories.length ? categories.join(" | ") : "(none yet)"}

=== DOCUMENT TEXT ===
${windows[i].text}`;

    const res = (await groqJSON(EXTRACT_SYSTEM, user)) as RawWindowResult;

    for (const f of Array.isArray(res.features) ? res.features : []) {
      raws.push(f);
      const c = clamp(str(f?.category), 40);
      if (c && !categories.includes(c)) categories.push(c);
    }

    const p = res.product || {};
    for (const k of ["tagline", "what", "problem", "pricing"] as const) {
      if (!patch[k] && str(p[k])) patch[k] = clamp(str(p[k]), k === "tagline" ? 160 : 1500);
    }
    for (const k of ["differentiators", "whoFor", "notFor", "limitations"] as const) {
      const have = new Set((patch[k] || []).map((s) => s.toLowerCase()));
      for (const item of strList(p[k])) {
        if (!have.has(item.toLowerCase())) {
          patch[k] = [...(patch[k] || []), item];
          have.add(item.toLowerCase());
        }
      }
    }
  }

  const seen = new Set(existing.map((f) => normKey(f.title)));
  const features: Feature[] = [];

  for (const r of raws) {
    const title = clamp(str(r.title), 120);
    const description = clamp(str(r.description), 800);
    const category = clamp(str(r.category), 40) || "General";
    if (!title) continue;
    const key = normKey(title);
    if (seen.has(key)) continue;
    seen.add(key);

    let status: FeatureStatus = str(r.confidence).toLowerCase() === "unclear" ? "clarify" : "included";
    let note = clamp(str(r.note), 300);

    let source: FeatureSource | null = null;
    const loc = locatePassage(doc.text, str(r.quote));
    if (loc) {
      source = {
        docId: doc.id,
        docName: doc.name,
        passage: doc.text.slice(loc.start, loc.end),
        start: loc.start,
        end: loc.end,
        verified: loc.verified,
      };
      if (!loc.verified) {
        status = "clarify";
        note = note || "Closest matching passage shown — please check it supports this feature.";
      }
    } else {
      status = "clarify";
      note = note || "Couldn't locate the exact passage in your document — please check this feature.";
    }

    features.push({
      id: newId("f"),
      title,
      description,
      category,
      status,
      approved: false,
      origin: "ai",
      source,
      original: { title, description, category },
      note,
    });
  }

  return { features, patch, truncated, warnings };
}
