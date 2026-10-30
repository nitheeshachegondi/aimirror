"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SearchResult } from "@/lib/search";

const EXAMPLES = [
  "I need an interview tool that creates a roadmap from my resume and a job description",
  "Something to make my resume pass ATS filters",
  "Communication skills practice for pharmacy students",
];

export default function Discover() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState("");
  const seq = useRef(0);

  async function run(query: string) {
    const my = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error("Search failed. Please try again.");
      const data = (await r.json()) as SearchResult;
      if (my !== seq.current) return;
      setRes(data);
      setSearched(query.trim());
    } catch (e) {
      if (my === seq.current) setError(e instanceof Error ? e.message : "Search failed.");
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }

  useEffect(() => {
    run("");
  }, []);

  const showingAll = !searched;

  return (
    <>
      <h1 style={{ fontSize: "2rem", letterSpacing: "-.03em" }}>Describe what you need</h1>
      <p className="muted">Search runs over founder-approved feature lists, so results show the specific features behind each match.</p>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault();
          run(q);
        }}
      >
        <textarea
          value={q}
          placeholder="e.g. I need an interview tool that creates a roadmap from my resume and a job description"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              run(q);
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={loading}>
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      <div className="examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            className="example"
            onClick={() => {
              setQ(ex);
              run(ex);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && <div className="alert err">{error}</div>}

      {res && (
        <>
          <p className="muted small">
            {showingAll
              ? `${res.total} published product${res.total === 1 ? "" : "s"}`
              : `${res.hits.length} match${res.hits.length === 1 ? "" : "es"} for “${searched}”${res.mode === "keyword" ? " · keyword matching" : ""}`}
          </p>

          {!res.hits.length && (
            <div className="card center">
              <p>{showingAll ? "No products have been published yet." : "No products match that need yet."}</p>
              <Link href="/founder/new" className="btn primary">
                Be the first to add yours
              </Link>
            </div>
          )}

          {res.hits.map((h) => (
            <div key={h.slug} className="card result">
              <div className="row between">
                <h3>
                  <Link href={`/products/${h.slug}`} style={{ color: "inherit" }}>
                    {h.name}
                  </Link>
                </h3>
                {!showingAll && h.score > 0 && <span className="score">{h.score}% match</span>}
              </div>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {h.tagline}
              </p>
              {!showingAll && h.why && <p className="why">{h.why}</p>}
              {h.matched.length > 0 && (
                <ul className="match-list">
                  {h.matched.slice(0, 5).map((f) => (
                    <li key={f.id}>
                      <b>{f.title}</b>
                      <span>{f.description}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="row">
                <Link href={`/products/${h.slug}`} className="btn primary sm">
                  Read the full showcase
                </Link>
                <a href={h.website} target="_blank" rel="noopener noreferrer" className="btn sm">
                  Visit website ↗
                </a>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
