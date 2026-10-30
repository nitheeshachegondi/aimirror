import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProduct } from "@/lib/store";
import { publicView } from "@/lib/views";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  const p = await getProduct(slug);
  return p && p.status === "published" ? publicView(p) : null;
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await load(params.slug);
  if (!p) return { title: "Not found" };
  return { title: `${p.name} — product showcase`, description: p.showcase.tagline || p.showcase.what.slice(0, 160) };
}

function List({ items }: { items: string[] }) {
  return (
    <ul>
      {items.map((i, k) => (
        <li key={k}>{i}</li>
      ))}
    </ul>
  );
}

export default async function ShowcasePage({ params }: { params: { slug: string } }) {
  const p = await load(params.slug);
  if (!p) notFound();
  const s = p.showcase;

  const groups = new Map<string, typeof p.features>();
  for (const f of p.features) groups.set(f.category, [...(groups.get(f.category) || []), f]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: p.name,
    url: p.website,
    description: s.what || s.tagline,
    featureList: p.features.map((f) => f.title),
    dateModified: p.updatedAt,
  };

  return (
    <main className="shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <header className="sc-head">
        <span className="tag ok">Founder-approved showcase</span>
        <h1 style={{ marginTop: 8 }}>{p.name}</h1>
        {s.tagline && <p className="lead">{s.tagline}</p>}
        <div className="row">
          <a className="btn primary" href={p.website} target="_blank" rel="noopener noreferrer">
            Visit {p.name} ↗
          </a>
          {s.demoUrl && (
            <a className="btn" href={s.demoUrl} target="_blank" rel="noopener noreferrer">
              Watch the demo ↗
            </a>
          )}
        </div>
      </header>

      <div className="sc-grid">
        <div>
          {s.what && (
            <section className="sc-section">
              <h2>What it is</h2>
              <p>{s.what}</p>
            </section>
          )}
          {s.problem && (
            <section className="sc-section">
              <h2>The problem it solves</h2>
              <p>{s.problem}</p>
            </section>
          )}
          {s.differentiators.length > 0 && (
            <section className="sc-section">
              <h2>What makes it different</h2>
              <List items={s.differentiators} />
            </section>
          )}

          <section className="sc-section">
            <h2>
              Every documented feature <span className="muted small">({p.features.length})</span>
            </h2>
            {Array.from(groups.entries()).map(([cat, feats]) => (
              <div className="cat" key={cat}>
                <h3>{cat}</h3>
                {feats.map((f) => (
                  <div className="feat" key={f.id}>
                    <b>{f.title}</b>
                    {f.description && <p>{f.description}</p>}
                    {f.source && (
                      <details className="src">
                        <summary>From the founder&apos;s document</summary>
                        <blockquote className="passage">
                          {f.source.passage}
                          <div className="muted small">— {f.source.docName}</div>
                        </blockquote>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </section>

          {(s.whoFor.length > 0 || s.notFor.length > 0) && (
            <section className="sc-section">
              <h2>Who should use it</h2>
              <div className="two-col">
                <div className="box-ok">
                  <h3>Good fit</h3>
                  {s.whoFor.length ? <List items={s.whoFor} /> : <p className="muted small">Not stated</p>}
                </div>
                <div className="box-no">
                  <h3>Not suitable for</h3>
                  {s.notFor.length ? <List items={s.notFor} /> : <p className="muted small">Not stated</p>}
                </div>
              </div>
            </section>
          )}

          {s.screenshots.length > 0 && (
            <section className="sc-section">
              <h2>Screenshots</h2>
              <div className="shots">
                {s.screenshots.map((u) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={u} src={u} alt={`${p.name} screenshot`} loading="lazy" referrerPolicy="no-referrer" />
                ))}
              </div>
            </section>
          )}

          {s.limitations.length > 0 && (
            <section className="sc-section">
              <h2>Limitations</h2>
              <List items={s.limitations} />
            </section>
          )}

          {s.founderNote && (
            <section className="sc-section">
              <h2>A note from the founder</h2>
              <p style={{ whiteSpace: "pre-wrap" }}>{s.founderNote}</p>
            </section>
          )}

          {p.documents.length > 0 && (
            <section className="sc-section">
              <h2>Supporting documents</h2>
              {p.documents.map((d) => (
                <details key={d.id} className="src" style={{ marginBottom: 8 }}>
                  <summary>{d.name}</summary>
                  <pre className="doc">{d.text}</pre>
                </details>
              ))}
            </section>
          )}
        </div>

        <aside className="sc-side">
          <div className="card">
            <h3 style={{ fontSize: "1rem", marginBottom: 8 }}>Pricing</h3>
            <p>{s.pricing || <span className="muted">Not stated by the founder</span>}</p>
            <a className="btn primary" style={{ width: "100%", textAlign: "center" }} href={p.website} target="_blank" rel="noopener noreferrer">
              Visit website ↗
            </a>
            <p className="muted small" style={{ marginTop: 12 }}>
              Updated {p.updatedAt.slice(0, 10)}. Written and approved by the founder.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
