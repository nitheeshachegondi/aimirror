"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { forgetProduct, readMine, type MyProductRef } from "@/lib/clientStore";

export default function MyProducts() {
  const [items, setItems] = useState<MyProductRef[] | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => setItems(readMine()), []);

  if (items === null) return null;

  return (
    <>
      <div className="row between">
        <h1 style={{ fontSize: "2rem", letterSpacing: "-.03em" }}>My products</h1>
        <Link href="/founder/new" className="btn primary">
          Add a product
        </Link>
      </div>
      <p className="muted">Products you created in this browser. There are no accounts yet, so copy each edit link to keep access from another device.</p>

      {!items.length && (
        <div className="card center">
          <p>You haven&apos;t added a product in this browser yet.</p>
          <Link href="/founder/new" className="btn primary">
            Add your first product
          </Link>
        </div>
      )}

      {items.map((p) => (
        <div className="card" key={p.id}>
          <div className="row between">
            <h3>{p.name}</h3>
            <div className="row">
              <Link href={`/founder/${p.id}`} className="btn primary sm">
                Review &amp; edit
              </Link>
              <Link href={`/products/${p.id}`} className="btn sm">
                Public page
              </Link>
              <button
                className="btn sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`${window.location.origin}/founder/${p.id}#k=${p.token}`);
                    setCopied(p.id);
                    setTimeout(() => setCopied(""), 1800);
                  } catch {
                    /* clipboard unavailable */
                  }
                }}
              >
                {copied === p.id ? "Copied ✓" : "Copy edit link"}
              </button>
              <button
                className="btn sm danger"
                onClick={() => {
                  forgetProduct(p.id);
                  setItems(readMine());
                }}
                title="Only removes it from this list; the product stays online"
              >
                Remove from list
              </button>
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
