// Browser-only helpers. Founders have no accounts yet: their private edit token lives in this browser
// (and in the "edit link" they can bookmark). Everything is wrapped in try/catch for private windows.

const KEY = "showcase:products";

export interface MyProductRef {
  id: string;
  token: string;
  name: string;
}

export function readMine(): MyProductRef[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function rememberProduct(ref: MyProductRef) {
  try {
    const rest = readMine().filter((p) => p.id !== ref.id);
    localStorage.setItem(KEY, JSON.stringify([ref, ...rest]));
  } catch {
    /* storage unavailable */
  }
}

export function forgetProduct(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(readMine().filter((p) => p.id !== id)));
  } catch {
    /* storage unavailable */
  }
}

export function tokenFor(id: string): string {
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k");
  if (fromHash) return fromHash;
  return readMine().find((p) => p.id === id)?.token || "";
}

export async function readFiles(files: File[]): Promise<{ docs: { name: string; text: string }[]; errors: string[] }> {
  const docs: { name: string; text: string }[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/docs/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not read the file.");
      docs.push({ name: data.name, text: data.text });
    } catch (e) {
      errors.push(e instanceof Error ? e.message : `Could not read ${file.name}.`);
    }
  }
  return { docs, errors };
}
