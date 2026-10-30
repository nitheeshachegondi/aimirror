/**
 * Pure text utilities (safe for browser + server): passage splitting, locating a quote
 * inside a document, coverage ("which parts of the document aren't in the showcase?"),
 * and light tokenising for search.
 */

export interface Span {
  start: number;
  end: number;
}

export const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

/* ───────────── normalisation with offset map ───────────── */

const CHAR_MAP: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "“": '"',
  "”": '"',
  "–": "-",
  "—": "-",
  "­": "",
  "​": "",
  " ": " ",
};

function buildNorm(text: string): { norm: string; map: number[] } {
  const out: string[] = [];
  const map: number[] = [];
  let lastSpace = true;
  for (let i = 0; i < text.length; i++) {
    let c = text[i];
    if (c in CHAR_MAP) c = CHAR_MAP[c];
    if (c === "") continue;
    if (/\s/.test(c)) {
      if (!lastSpace) {
        out.push(" ");
        map.push(i);
        lastSpace = true;
      }
    } else {
      out.push(c.toLowerCase());
      map.push(i);
      lastSpace = false;
    }
  }
  return { norm: out.join(""), map };
}

/* ───────────── tokens (search + fuzzy matching) ───────────── */

const STOP = new Set(
  (
    "a an the and or of to in on for with from my me i we you your is are be it its that this can do does need want " +
    "looking find tool tools app apps platform software product something some any help helps using use get make makes " +
    "how what which who by as at so if but not no into than then them they their our us will would should could also " +
    "very more most just like one"
  ).split(" ")
);

export function stem(word: string): string {
  let w = word.toLowerCase();
  if (w.length > 4 && w.endsWith("ies")) w = w.slice(0, -3) + "y";
  else if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

export function tokens(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
}

/* ───────────── passages ───────────── */

/** Split text into sentence-ish passages with offsets. Skips headings and fragments. */
export function splitPassages(text: string): Span[] {
  const spans: Span[] = [];
  const push = (s: number, e: number) => {
    const t = text.slice(s, e).trim();
    if (t.length >= 25 && t.split(/\s+/).length >= 5) spans.push({ start: s, end: e });
  };
  let pos = 0;
  for (const line of text.split("\n")) {
    const s = pos + (line.length - line.trimStart().length);
    const e = pos + line.trimEnd().length;
    pos += line.length + 1;
    if (e <= s) continue;
    if (e - s <= 420) {
      push(s, e);
      continue;
    }
    const seg = text.slice(s, e);
    const re = /[^.!?]*[.!?]+["')\]]*\s*|[^.!?]+$/g;
    let cs = -1;
    let ce = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(seg)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const ms = s + m.index;
      const me = ms + m[0].trimEnd().length;
      if (cs < 0) cs = ms;
      ce = me;
      if (ce - cs >= 200) {
        push(cs, ce);
        cs = -1;
      }
    }
    if (cs >= 0) push(cs, ce);
  }
  return spans;
}

/** Find a quote in a document. Exact (whitespace/case/quote-insensitive) first, then closest passage. */
export function locatePassage(docText: string, quote: string): (Span & { verified: boolean }) | null {
  const parts = quote
    .split(/\.\.\.|…/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 12)
    .sort((a, b) => b.length - a.length);
  if (!parts.length) return null;

  const { norm, map } = buildNorm(docText);
  for (const part of parts) {
    const q = buildNorm(part).norm.trim();
    if (q.length < 12) continue;
    const idx = norm.indexOf(q);
    if (idx >= 0) return { start: map[idx], end: map[idx + q.length - 1] + 1, verified: true };
  }

  // Fallback: passage that contains most of the quote's words
  const qTokens = new Set(tokens(parts[0]));
  if (qTokens.size < 3) return null;
  let best: Span | null = null;
  let bestScore = 0;
  for (const p of splitPassages(docText)) {
    const pt = new Set(tokens(docText.slice(p.start, p.end)));
    let hit = 0;
    qTokens.forEach((t) => {
      if (pt.has(t)) hit++;
    });
    const score = hit / qTokens.size;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best && bestScore >= 0.6 ? { ...best, verified: false } : null;
}

export function contextAround(text: string, start: number, end: number, pad = 220) {
  const a = Math.max(0, start - pad);
  const b = Math.min(text.length, end + pad);
  return {
    before: (a > 0 ? "…" : "") + text.slice(a, start),
    passage: text.slice(start, end),
    after: text.slice(end, b) + (b < text.length ? "…" : ""),
  };
}

export function makeWindows(text: string, size = 9000): { start: number; text: string }[] {
  const out: { start: number; text: string }[] = [];
  let pos = 0;
  while (pos < text.length) {
    let end = Math.min(text.length, pos + size);
    if (end < text.length) {
      const nl = text.lastIndexOf("\n", end);
      if (nl > pos + size * 0.6) end = nl;
      else {
        const dot = text.lastIndexOf(". ", end);
        if (dot > pos + size * 0.6) end = dot + 1;
      }
    }
    out.push({ start: pos, text: text.slice(pos, end) });
    pos = end;
  }
  return out;
}

/* ───────────── coverage ───────────── */

export interface UncoveredPassage {
  key: string;
  docId: string;
  docName: string;
  start: number;
  end: number;
  text: string;
}

/**
 * Passages in the founder's documents that no feature points at.
 * Features the founder left out still count as covered (that was a decision).
 */
export function uncoveredPassages(
  docs: { id: string; name: string; text: string }[],
  features: { source: { docId: string; start: number; end: number } | null }[],
  dismissed: string[]
): UncoveredPassage[] {
  const dis = new Set(dismissed);
  const out: UncoveredPassage[] = [];
  for (const d of docs) {
    const spans = features
      .map((f) => f.source)
      .filter((s): s is NonNullable<typeof s> => !!s && s.docId === d.id);
    for (const p of splitPassages(d.text)) {
      const len = p.end - p.start;
      let covered = 0;
      for (const s of spans) {
        const o = Math.min(p.end, s.end) - Math.max(p.start, s.start);
        if (o > 0) covered += o;
      }
      if (covered >= len * 0.4) continue;
      const key = `${d.id}:${p.start}`;
      if (dis.has(key)) continue;
      out.push({ key, docId: d.id, docName: d.name, start: p.start, end: p.end, text: d.text.slice(p.start, p.end).trim() });
    }
  }
  return out;
}
