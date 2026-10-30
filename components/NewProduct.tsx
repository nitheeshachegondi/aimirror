"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { readFiles, rememberProduct } from "@/lib/clientStore";
import { ApiError, runExtraction } from "@/lib/clientApi";

export default function NewProduct() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [docs, setDocs] = useState<{ name: string; text: string }[]>([]);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState<"" | "read" | "create" | "analyze">("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setError("");
    setBusy("read");
    const { docs: got, errors } = await readFiles(Array.from(files));
    setDocs((d) => [...d, ...got].slice(0, 8));
    if (errors.length) setError(errors.join(" "));
    setBusy("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const all = [...docs];
    if (pasted.trim().length >= 40) all.push({ name: "Pasted description", text: pasted.trim() });
    if (!all.length) {
      setError("Upload at least one document, or paste text describing your product.");
      return;
    }

    setBusy("create");
    let id = "";
    let token = "";
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, website, documents: all }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create the product.");
      id = data.id;
      token = data.token;
      rememberProduct({ id, token, name: name.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy("");
      return;
    }

    setBusy("analyze");
    setStatus("Reading your documents and extracting every feature…");
    try {
      await runExtraction(id, token, [], (remaining) =>
        setStatus(remaining ? `Analysing… ${remaining} document${remaining === 1 ? "" : "s"} to go` : "Done. Opening your review…")
      );
    } catch (err) {
      // The product exists; the editor lets the founder retry the analysis.
      sessionStorage.setItem(`showcase:err:${id}`, err instanceof ApiError ? err.message : "Analysis failed.");
    }
    router.push(`/founder/${id}`);
  }

  if (busy === "analyze") {
    return (
      <div className="card center">
        <div className="spinner" />
        <h2>{status}</h2>
        <p className="muted">Every feature is being matched to the exact passage it came from. This takes a short while.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit}>
      <div className="card">
        <h2>1. Your product</h2>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="field">
            <label htmlFor="name">Product name</label>
            <input id="name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme" />
          </div>
          <div className="field">
            <label htmlFor="web">Website</label>
            <input id="web" type="text" required value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://acme.com" />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>2. Your documents</h2>
        <p className="hint">
          Upload anything that describes the product: feature docs, pitch decks exported as PDF, README, user guides. PDF, Word (.docx), .txt, .md, .html.
          The more complete the document, the more complete your showcase.
        </p>
        <div className="drop" onClick={() => fileRef.current?.click()}>
          {busy === "read" ? "Reading files…" : "Click to choose files (up to 8, 8 MB each)"}
        </div>
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm" onChange={(e) => onFiles(e.target.files)} />
        {docs.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {docs.map((d, i) => (
              <div className="doc-row" key={i}>
                <span>
                  <b>{d.name}</b> <span className="muted small">· {d.text.length.toLocaleString()} characters</span>
                </span>
                <button type="button" className="linkbtn" onClick={() => setDocs(docs.filter((_, k) => k !== i))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="paste">…or paste text</label>
          <textarea id="paste" rows={6} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste a feature list, product description or notes here." />
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}
      <button className="btn primary" type="submit" disabled={busy !== ""} style={{ marginTop: 16 }}>
        {busy === "create" ? "Saving…" : "Extract features and review →"}
      </button>
      <p className="muted small" style={{ marginTop: 10 }}>
        Nothing is public until you approve and publish it.
      </p>
    </form>
  );
}
