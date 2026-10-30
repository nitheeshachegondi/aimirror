import Editor from "@/components/Editor";

export const metadata = { title: "Review your showcase" };

export default function EditorPage({ params }: { params: { id: string } }) {
  return (
    <main className="shell">
      <Editor id={params.id} />
    </main>
  );
}
