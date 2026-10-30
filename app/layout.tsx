import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { BRAND, HEADLINE, SUBLINE } from "@/lib/brand";

export const metadata: Metadata = {
  title: `${BRAND} — ${HEADLINE}`,
  description: SUBLINE,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="nav-in">
            <Link href="/" className="brand">
              {BRAND}
              <span>.</span>
            </Link>
            <Link href="/discover" className="link">
              Discover products
            </Link>
            <Link href="/founder" className="link">
              My products
            </Link>
            <Link href="/founder/new" className="btn primary sm">
              Add your product
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
