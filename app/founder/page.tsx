import MyProducts from "@/components/MyProducts";

export const metadata = { title: "My products" };

export default function FounderHome() {
  return (
    <main className="shell narrow">
      <MyProducts />
    </main>
  );
}
