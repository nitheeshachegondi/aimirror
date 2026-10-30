"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureStatus, FounderProduct, Showcase } from "@/lib/types";
import { completeness, completenessSentence } from "@/lib/completeness";
import { contextAround, newId, uncoveredPassages } from "@/lib/text";
import { ApiError, headers, runExtraction } from "@/lib/clientApi";
import { readFiles, rememberProduct, tokenFor } from "@/lib/clientStore";

const lines = (a: string[]) => a.join("\n");
const toList = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

function SourceBox({ product, f }: { product: FounderProduct; f: Feature }) {
  const [wide, setWide] = useState(false);
  if (!f.source) {
    return <div className="srcbox">No source passage linked. Add the detail yourself or exclude this feature.</div>;
  }
  const doc = product.documents.find((d) => d.id === f.source!.docId);
  const ctx = doc ? contextAround(doc.text, f.source.start, f.source.end, wide ? 700 : 160) : null;
  return (
    <div className="srcbox">
      <div className="label">
        From “{f.source.docName}”{!f.source.verified && " · closest match, please verify"}
      </div>
      {ctx ? (
        <div className="ctx">
          {ctx.before}
          <mark>{ctx.passage}</mark>
          {ctx.after}
        </div>
      ) : (
        <div className="ctx">{f.source.passage}</div>
      )}
      <button type="button" className="linkbtn" onClick={() => setWide(!wide)}>
        {wide ? "Show less context" : "Show more context"}
      </button>
    </div>
  );
}

function FeatureCard({
  product,
  f,
  onChange,
  onRemove,
}: {
  product: FounderProduct;
  f: Feature;
  onChange: (patch: Partial<Feature>) => void;
  onRemove: () => void;
}) {
  const [showSrc, setShowSrc] = useState(f.status === "clarify");
  const changed = !!f.original && (f.original.title !== f.title || f.original.description !== f.description || f.original.category !== f.category);
  const seg = (s: FeatureStatus, label: string, cls: string) => (
    <button type="button" className={f.status === s ? `on ${cls}` : ""} onClick={() => onChange({ status: s })}>
      {label}
    </button>
  );

  return (
    <div className={`fcard ${f.status}`}>
      <div className="fhead">
        <div className="row">
          {f.origin === "founder" && <span className="tag gray">Added by you</span>}
          {f.status === "clarify" && <span className="tag warn">Needs your clarification</span>}
          {f.status === "excluded" && <span className="tag no">Left out</span>}
          {f.status === "included" && f.approved && <span className="tag ok">Live</span>}
        </div>
        <div className="seg">
          {seg("included", "Include", "inc")}
          {seg("clarify", "Unsure", "cla")}
          {seg("excluded", "Leave out", "exc")}
        </div>
      </div>
      {f.note && f.status === "clarify" && <p className="note">{f.note}</p>}
      <div className="field">
        <input type="text" value={f.title} onChange={(e) => onChange({ title: e.target.value })} aria-label="Feature title" style={{ fontWeight: 600 }} />
      </div>
      <div className="field">
        <textarea rows={2} value={f.description} onChange={(e) => onChange({ description: e.target.value })} aria-label="Feature description" />
      </div>
      <div className="row between">
        <div className="row">
          <label style={{ margin: 0 }} className="small muted">
            Category
          </label>
          <input type="text" value={f.category} onChange={(e) => onChange({ category: e.target.value })} style={{ width: 170, padding: "4px 8px" }} />
        </div>
        <div className="row">
          <button type="button" className="linkbtn" onClick={() => setShowSrc(!showSrc)}>
            {showSrc ? "Hide source" : "Inspect source"}
          </button>
          {changed && f.original && (
            <button type="button" className="linkbtn" onClick={() => onChange({ ...f.original! })}>
              Restore original wording
            </button>
          )}
          <button type="button" className="linkbtn" style={{ color: "var(--no)" }} onClick={onRemove}>
            Delete
          </button>
        </div>
      </div>
      {showSrc && <SourceBox product={product} f={f} />}
    </div>
  );
}

function ListField({ label, value, onChange, hint }: { label: string; value: string[]; onChange: (v: string[]) => void; hint?: string }) {
  const [text, setText] = useState(lines(value));
  const last = useRef(lines(value));
  useEffect(() => {
    // Re-sync when the list changes from outside (e.g. after extraction), but not while typing.
    if (lines(value) !== last.current) {
      last.current = lines(value);
      setText(lines(value));
    }
  }, [value]);
  return (
    <div className="field listedit">
      <label>
        {label} <span className="muted small">(one per line{hint ? `, ${hint}` : ""})</span>
      </label>
      <textarea
        rows={Math.max(2, Math.min(8, text.split("\n").length + 1))}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const l = toList(e.target.value);
          last.current = lines(l);
          onChange(l);
        }}
      />
    </div>
  );
}

export default function Editor({ id }: { id: string }) {
  const [token, setToken] = useState("");
  const [product, setProduct] = useState<FounderProduct | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "publish" | "analyze" | "read">("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"all" | FeatureStatus>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = tokenFor(id);
    setToken(t);
    if (!t) {
      setLoadError("This browser doesn't have the edit link for this product. Open the edit link you copied (it ends in #k=…).");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/products/${id}`, { headers: headers(t), cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load the product.");
        setProduct(data);
        rememberProduct({ id, token: t, name: data.name });
        const stored = sessionStorage.getItem(`showcase:err:${id}`);
        if (stored) {
          setError(`${stored} You can retry with “Analyse documents” below.`);
          sessionStorage.removeItem(`showcase:err:${id}`);
        }
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Could not load the product.");
      }
    })();
  }, [id]);

  const stats = useMemo(() => (product ? completeness(product.features) : null), [product]);
  const uncovered = useMemo(
    () => (product ? uncoveredPassages(product.documents, product.features, product.dismissed) : []),
    [product]
  );

  if (loadError) {
    return (
      <div className="card narrow center">
        <p>{loadError}</p>
        <Link href="/founder" className="btn">
          Back to my products
        </Link>
      </div>
    );
  }
  if (!product || !stats) {
    return (
      <div className="center">
        <div className="spinner" />
        <p className="muted">Loading your product…</p>
      </div>
    );
  }

  const edit = (fn: (p: FounderProduct) => FounderProduct) => {
    setProduct((p) => (p ? fn(p) : p));
    setDirty(true);
    setNotice("");
  };
  const setShowcase = (patch: Partial<Showcase>) => edit((p) => ({ ...p, showcase: { ...p.showcase, ...patch } }));
  const patchFeature = (fid: string, patch: Partial<Feature>) =>
    edit((p) => ({ ...p, features: p.features.map((f) => (f.id === fid ? { ...f, ...patch } : f)) }));

  async function save(): Promise<FounderProduct | null> {
    if (!product) return null;
    setBusy("save");
    setError("");
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: headers(token),
        body: JSON.stringify({
          name: product.name,
          website: product.website,
          showcase: product.showcase,
          documents: product.documents.map((d) => ({ id: d.id, isPublic: d.isPublic })),
          features: product.features,
          dismissed: product.dismissed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setProduct(data);
      setDirty(false);
      setNotice("Saved.");
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      return null;
    } finally {
      setBusy("");
    }
  }

  async function publish(unpublish = false) {
    const saved = dirty ? await save() : product;
    if (!saved) return;
    setBusy("publish");
    setError("");
    try {
      const res = await fetch(`/api/products/${id}/publish`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ publish: !unpublish }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not publish.");
      setProduct(data);
      setNotice(unpublish ? "Showcase unpublished — it is now a private draft." : "Approved and published.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy("");
    }
  }

  async function analyze(newDocs: { name: string; text: string }[] = []) {
    if (dirty && !(await save())) return;
    setBusy("analyze");
    setError("");
    try {
      const res = await runExtraction(id, token, newDocs);
      setProduct(res.product);
      setWarnings(res.warnings);
      setDirty(false);
      setNotice("Analysis complete — review the new features below.");
    } catch (e) {
      if (e instanceof ApiError && e.product) setProduct(e.product);
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy("");
    }
  }

  async function addFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy("read");
    const { docs, errors } = await readFiles(Array.from(files));
    setBusy("");
    if (errors.length) setError(errors.join(" "));
    if (docs.length) await analyze(docs);
    if (fileRef.current) fileRef.current.value = "";
  }

  function addFromPassage(u: (typeof uncovered)[number]) {
    const words = u.text.replace(/\s+/g, " ").split(" ");
    const title = words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");
    const f: Feature = {
      id: newId("f"),
      title,
      description: u.text.replace(/\s+/g, " ").slice(0, 400),
      category: "General",
      status: "included",
      approved: false,
      origin: "founder",
      source: { docId: u.docId, docName: u.docName, passage: u.text, start: u.start, end: u.end, verified: true },
      original: null,
      note: "",
    };
    edit((p) => ({ ...p, features: [...p.features, f] }));
  }

  function addBlankFeature() {
    const f: Feature = {
      id: newId("f"),
      title: "New feature",
      description: "",
      category: "General",
      status: "included",
      approved: false,
      origin: "founder",
      source: null,
      original: null,
      note: "",
    };
    edit((p) => ({ ...p, features: [...p.features, f] }));
  }

  const shown = product.features.filter((f) => filter === "all" || f.status === filter);
  const groups = new Map<string, Feature[]>();
  for (const f of shown) groups.set(f.category || "General", [...(groups.get(f.category || "General") || []), f]);
  const unprocessed = product.documents.filter((d) => !d.processed).length;
  const s = product.showcase;
  const isLive = product.status === "published";

  return (
    <>
      <div className="row between" style={{ marginBottom: 14 }}>
        <div>
          <div className="muted small">
            <Link href="/founder">My products</Link> / Review
          </div>
          <h1 style={{ fontSize: "1.9rem", letterSpacing: "-.03em" }}>{product.name}</h1>
        </div>
        <div className="row">
          <span className={`tag ${isLive ? "ok" : "gray"}`}>{isLive ? "Published" : "Draft — not public"}</span>
          {isLive && (
            <Link href={`/products/${product.id}`} className="btn sm" target="_blank">
              View public page ↗
            </Link>
          )}
        </div>
      </div>

      {error && <div className="alert err">{error}</div>}
      {notice && !error && <div className="alert ok">{notice}</div>}
      {warnings.map((w, i) => (
        <div className="alert warn" key={i}>
          {w}
        </div>
      ))}

      {unprocessed > 0 && (
        <div className="alert warn">
          {unprocessed} document{unprocessed === 1 ? " hasn't" : "s haven't"} been analysed yet.{" "}
          <button className="linkbtn" disabled={busy !== ""} onClick={() => analyze()}>
            {busy === "analyze" ? "Analysing…" : "Analyse documents"}
          </button>
        </div>
      )}

      {/* COMPLETENESS */}
      <div className="cbar">
        <div className="sentence">{completenessSentence(stats)}</div>
        <div className="stats">
          <span className="tag ok">{stats.included} included</span>
          {stats.clarify > 0 && <span className="tag warn">{stats.clarify} need clarification</span>}
          {stats.excluded > 0 && <span className="tag no">{stats.excluded} left out</span>}
          {stats.founderAdded > 0 && <span className="tag gray">{stats.founderAdded} added by you</span>}
          {uncovered.length > 0 && <span className="tag warn">{uncovered.length} passages not yet covered</span>}
        </div>
        <p className="muted small" style={{ margin: "10px 0 0" }}>
          Every feature links to the passage it came from. Inspect it, edit it, restore the original wording, or leave it out. Nothing goes public until you publish.
        </p>
      </div>

      <div className="card">
        <div className="row between">
          <h2>Features</h2>
          <div className="row">
            <div className="seg">
              {(["all", "included", "clarify", "excluded"] as const).map((k) => (
                <button key={k} type="button" className={filter === k ? "on inc" : ""} onClick={() => setFilter(k)}>
                  {k === "all" ? "All" : k === "included" ? "Included" : k === "clarify" ? "Unsure" : "Left out"}
                </button>
              ))}
            </div>
            <button className="btn sm" onClick={addBlankFeature}>
              + Add a feature
            </button>
          </div>
        </div>
        {!product.features.length && <p className="muted" style={{ marginTop: 12 }}>No features yet. Analyse your documents or add one yourself.</p>}
        {Array.from(groups.entries()).map(([cat, feats]) => (
          <div key={cat} className="cat">
            <h3>{cat}</h3>
            {feats.map((f) => (
              <FeatureCard
                key={f.id}
                product={product}
                f={f}
                onChange={(patch) => patchFeature(f.id, patch)}
                onRemove={() => edit((p) => ({ ...p, features: p.features.filter((x) => x.id !== f.id) }))}
              />
            ))}
          </div>
        ))}
      </div>

      {/* UNCOVERED */}
      {uncovered.length > 0 && (
        <div className="card">
          <h2>Not yet covered by any feature ({uncovered.length})</h2>
          <p className="hint">These passages in your documents aren&apos;t linked to a feature. Add the ones that describe something the product does, and dismiss the rest.</p>
          {uncovered.slice(0, 25).map((u) => (
            <div className="uncov" key={u.key}>
              <p>{u.text}</p>
              <div className="row">
                <span className="muted small">{u.docName}</span>
                <button className="btn sm" onClick={() => addFromPassage(u)}>
                  Add as feature
                </button>
                <button className="btn sm" onClick={() => edit((p) => ({ ...p, dismissed: [...p.dismissed, u.key] }))}>
                  Not a feature
                </button>
              </div>
            </div>
          ))}
          {uncovered.length > 25 && <p className="muted small">Showing the first 25 of {uncovered.length}.</p>}
        </div>
      )}

      {/* SHOWCASE */}
      <div className="card">
        <h2>Your showcase</h2>
        <p className="hint">Pre-filled only from what your documents say. This is your explanation — change anything.</p>
        <div className="field">
          <label>Tagline</label>
          <input type="text" value={s.tagline} onChange={(e) => setShowcase({ tagline: e.target.value })} />
        </div>
        <div className="field">
          <label>What it is</label>
          <textarea rows={3} value={s.what} onChange={(e) => setShowcase({ what: e.target.value })} />
        </div>
        <div className="field">
          <label>The problem it solves</label>
          <textarea rows={3} value={s.problem} onChange={(e) => setShowcase({ problem: e.target.value })} />
        </div>
        <ListField label="What makes it different" value={s.differentiators} onChange={(v) => setShowcase({ differentiators: v })} />
        <div className="grid2">
          <ListField label="Who should use it" value={s.whoFor} onChange={(v) => setShowcase({ whoFor: v })} />
          <ListField label="Who it is NOT suitable for" value={s.notFor} onChange={(v) => setShowcase({ notFor: v })} />
        </div>
        <ListField label="Limitations" value={s.limitations} onChange={(v) => setShowcase({ limitations: v })} />
        <div className="grid2">
          <div className="field">
            <label>Pricing</label>
            <input type="text" value={s.pricing} onChange={(e) => setShowcase({ pricing: e.target.value })} placeholder="e.g. Free tier; Pro Rs 499/month" />
          </div>
          <div className="field">
            <label>Demo link (video or live demo)</label>
            <input type="text" value={s.demoUrl} onChange={(e) => setShowcase({ demoUrl: e.target.value })} placeholder="https://…" />
          </div>
        </div>
        <ListField label="Screenshot image URLs" value={s.screenshots} onChange={(v) => setShowcase({ screenshots: v })} hint="https only" />
        <div className="field">
          <label>A note from the founder</label>
          <textarea rows={4} value={s.founderNote} onChange={(e) => setShowcase({ founderNote: e.target.value })} placeholder="Your own explanation, in your own words." />
        </div>
      </div>

      {/* DOCUMENTS */}
      <div className="card">
        <h2>Documents</h2>
        <p className="hint">Choose which documents visitors can read in full as supporting material. Private documents are used only to build your showcase.</p>
        {product.documents.map((d) => (
          <div className="doc-row" key={d.id}>
            <span>
              <b>{d.name}</b> <span className="muted small">· {d.text.length.toLocaleString()} characters{d.processed ? "" : " · not analysed"}{d.truncated ? " · long, partly analysed" : ""}</span>
            </span>
            <label style={{ margin: 0, fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={d.isPublic}
                onChange={(e) => edit((p) => ({ ...p, documents: p.documents.map((x) => (x.id === d.id ? { ...x, isPublic: e.target.checked } : x)) }))}
              />{" "}
              Show publicly
            </label>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <button className="btn sm" disabled={busy !== ""} onClick={() => fileRef.current?.click()}>
            {busy === "read" ? "Reading…" : busy === "analyze" ? "Analysing…" : "+ Upload another document"}
          </button>
          <input ref={fileRef} type="file" multiple hidden accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm" onChange={(e) => addFiles(e.target.files)} />
        </div>
      </div>

      <div style={{ height: 70 }} />
      <div className="savebar">
        <div className="savebar-in">
          <span className="muted small">
            {dirty ? "You have unsaved changes." : stats.awaiting > 0 ? `${stats.awaiting} included feature${stats.awaiting === 1 ? "" : "s"} waiting for your approval.` : `${stats.live} feature${stats.live === 1 ? "" : "s"} live.`}
          </span>
          <div className="row">
            <button className="btn" disabled={busy !== "" || !dirty} onClick={() => save()}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </button>
            {isLive && (
              <button className="btn danger" disabled={busy !== ""} onClick={() => publish(true)}>
                Unpublish
              </button>
            )}
            <button className="btn primary" disabled={busy !== ""} onClick={() => publish(false)}>
              {busy === "publish" ? "Publishing…" : isLive ? "Approve & update showcase" : "Approve & publish"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
