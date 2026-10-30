import Link from "next/link";
import { HEADLINE, SUBLINE } from "@/lib/brand";
import { listPublished } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const recent = (await listPublished()).slice(0, 6);

  return (
    <main className="shell">
      <section className="hero">
        <h1>{HEADLINE}</h1>
        <p className="sub">{SUBLINE}</p>
        <div className="cta-row">
          <Link href="/founder/new" className="btn primary">
            Add your product
          </Link>
          <Link href="/discover" className="btn">
            Find a product I need
          </Link>
        </div>
      </section>

      <section className="steps">
        <div className="card step-card">
          <h3>For founders</h3>
          <ol>
            <li>Add your product and upload the documents that describe it.</li>
            <li>Review every feature we found, each linked to the passage it came from.</li>
            <li>Approve your showcase and publish it.</li>
          </ol>
        </div>
        <div className="card step-card">
          <h3>For people looking for a tool</h3>
          <ol>
            <li>Describe what you need in your own words.</li>
            <li>See products whose documented features match, and which features matched.</li>
            <li>Read the full showcase, then visit the product&apos;s website.</li>
          </ol>
        </div>
      </section>

      {recent.length > 0 && (
        <section style={{ marginTop: 40 }}>
          <div className="row between" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: "1.2rem" }}>Recently published</h2>
            <Link href="/discover">Browse all →</Link>
          </div>
          <div className="grid3">
            {recent.map((p) => (
              <Link key={p.id} href={`/products/${p.id}`} className="card pcard">
                <h3>{p.name}</h3>
                <p>{p.showcase.tagline}</p>
                <span className="tag gray">{p.features.filter((f) => f.status === "included" && f.approved).length} documented features</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
