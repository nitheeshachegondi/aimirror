import type { Feature } from "./types";

export interface Completeness {
  found: number;
  included: number;
  clarify: number;
  excluded: number;
  founderAdded: number;
  live: number;
  awaiting: number;
}

export function completeness(features: Feature[]): Completeness {
  const ai = features.filter((f) => f.origin === "ai");
  const n = (s: Feature["status"]) => ai.filter((f) => f.status === s).length;
  return {
    found: ai.length,
    included: n("included"),
    clarify: n("clarify"),
    excluded: n("excluded"),
    founderAdded: features.length - ai.length,
    live: features.filter((f) => f.status === "included" && f.approved).length,
    awaiting: features.filter((f) => f.status === "included" && !f.approved).length,
  };
}

export function completenessSentence(c: Completeness): string {
  if (!c.found) return "No features have been extracted from your documents yet.";
  let s = `We found ${c.found} feature${c.found === 1 ? "" : "s"} in your documents. ${c.included} ${c.included === 1 ? "is" : "are"} included in your showcase.`;
  if (c.clarify) s += ` ${c.clarify} ${c.clarify === 1 ? "needs" : "need"} your clarification.`;
  if (c.excluded) s += ` ${c.excluded} you left out.`;
  return s;
}
