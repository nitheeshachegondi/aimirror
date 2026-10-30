import NewProduct from "@/components/NewProduct";

export const metadata = { title: "Add your product" };

export default function NewProductPage() {
  return (
    <main className="shell narrow">
      <h1 style={{ fontSize: "2rem", letterSpacing: "-.03em", marginBottom: 6 }}>Add your product</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Upload your documents. We&apos;ll organise everything they say into a detailed showcase, and you approve every word before it&apos;s public.
      </p>
      <NewProduct />
    </main>
  );
}
