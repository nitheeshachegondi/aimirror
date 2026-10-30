import { groqJSON, hasGroqKey } from "./groq";
import { SEARCH_SYSTEM } from "./prompts";
import { tokens } from "./text";
import type { Feature, Product } from "./types";

export interface MatchedFeature {
  id: string;
  title: string;
  description: string;
  category: string;
}

export interface SearchHit {
  slug: string;
  name: string;
  tagline: string;
  website: string;
  score: number;
  why: string;
  matched: MatchedFeature[];
}

export interface SearchResult {
  hits: SearchHit[];
  mode: "ai" | "keyword";
  total: number;
}

const live = (p: Product): Feature[] => p.features.filter((f) => f.status === "included" && f.approved);
const toMatched = (f: Feature): MatchedFeature => ({ id: f.id, title: f.title, description: f.description, category: f.category });

interface Scored {
  p: Product;
  kw: number;
  matched: Feature[];
}

function keywordScore(qTokens: string[], p: Product): Scored {
  const qSet = new Set(qTokens);
  const bigrams: [string, string][] = [];
  for (let i = 0; i < qTokens.length - 1; i++) bigrams.push([qTokens[i], qTokens[i + 1]]);

  const scored = live(p).map((f) => {
    const title = new Set(tokens(f.title));
    const rest = new Set([...tokens(f.description), ...tokens(f.category)]);
    let s = 0;
    qSet.forEach((t) => {
      if (title.has(t)) s += 3;
      else if (rest.has(t)) s += 1;
    });
    const seq = tokens(`${f.title} ${f.description}`);
    for (const [a, b] of bigrams) {
      for (let i = 0; i < seq.length - 1; i++) {
        if (seq[i] === a && seq[i + 1] === b) {
          s += 2;
          break;
        }
      }
    }
    return { f, s };
  });

  const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s);
  const sc = p.showcase;
  const prodTokens = new Set(tokens([p.name, sc.tagline, sc.what, sc.problem, ...sc.whoFor].join(" ")));
  let prodScore = 0;
  qSet.forEach((t) => {
    if (prodTokens.has(t)) prodScore += 1;
  });
  const total = top.slice(0, 5).reduce((a, x) => a + x.s, 0) + prodScore * 0.5;
  return { p, kw: total, matched: top.slice(0, 6).map((x) => x.f) };
}

function keywordHit(s: Scored, maxPossible: number): SearchHit {
  const titles = s.matched.slice(0, 3).map((f) => f.title);
  return {
    slug: s.p.id,
    name: s.p.name,
    tagline: s.p.showcase.tagline,
    website: s.p.website,
    score: Math.min(100, Math.round((100 * s.kw) / maxPossible)),
    why: titles.length ? `Matches your need through: ${titles.join("; ")}.` : "Related to your description.",
    matched: s.matched.map(toMatched),
  };
}

export async function searchProducts(query: string, products: Product[]): Promise<SearchResult> {
  const q = query.trim();
  const total = products.length;

  if (!q) {
    return {
      mode: "keyword",
      total,
      hits: products.map((p) => ({
        slug: p.id,
        name: p.name,
        tagline: p.showcase.tagline,
        website: p.website,
        score: 0,
        why: "",
        matched: [],
      })),
    };
  }

  const qTokens = tokens(q);
  const maxPossible = Math.max(1, qTokens.length * 5);
  const scored = products.map((p) => keywordScore(qTokens, p)).sort((a, b) => b.kw - a.kw);
  const keywordHits = scored.filter((s) => s.kw > 0).slice(0, 8).map((s) => keywordHit(s, maxPossible));

  if (!hasGroqKey() || !products.length) return { hits: keywordHits, mode: "keyword", total };

  // Candidates for the AI pass: best keyword matches, padded with other products so
  // needs described in different words ("get hired" vs "interview coach") can still match.
  const cands = scored.slice(0, 8);
  const catalog = cands.map(({ p }) => ({
    slug: p.id,
    name: p.name,
    tagline: p.showcase.tagline,
    what: p.showcase.what.slice(0, 220),
    features: live(p)
      .slice(0, 16)
      .map((f) => ({ id: f.id, title: f.title, description: f.description.slice(0, 90) })),
  }));

  try {
    const raw = (await groqJSON(SEARCH_SYSTEM, `VISITOR NEED:\n${q}\n\nCANDIDATE PRODUCTS:\n${JSON.stringify(catalog)}`)) as {
      matches?: { slug?: unknown; score?: unknown; why?: unknown; featureIds?: unknown }[];
    };

    const bySlug = new Map(cands.map((c) => [c.p.id, c]));
    const hits: SearchHit[] = [];
    for (const m of Array.isArray(raw.matches) ? raw.matches : []) {
      const c = bySlug.get(String(m.slug));
      if (!c || hits.some((h) => h.slug === c.p.id)) continue;
      const ids = new Set(Array.isArray(m.featureIds) ? m.featureIds.map(String) : []);
      let matched = live(c.p).filter((f) => ids.has(f.id));
      if (!matched.length) matched = c.matched; // never show a match with no evidence
      const score = Math.max(0, Math.min(100, Math.round(Number(m.score) || 0)));
      hits.push({
        slug: c.p.id,
        name: c.p.name,
        tagline: c.p.showcase.tagline,
        website: c.p.website,
        score,
        why: typeof m.why === "string" && m.why.trim() ? m.why.trim() : keywordHit(c, maxPossible).why,
        matched: matched.map(toMatched),
      });
    }
    hits.sort((a, b) => b.score - a.score);
    return { hits, mode: "ai", total };
  } catch {
    return { hits: keywordHits, mode: "keyword", total };
  }
}
