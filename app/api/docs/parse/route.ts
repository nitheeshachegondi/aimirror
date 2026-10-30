import { NextResponse } from "next/server";
import { parseDocument } from "@/lib/docs";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_BYTES = 8 * 1024 * 1024;

/** Stateless: turns an uploaded file (PDF / Word / text) into plain text. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: `"${file.name}" is too large (max 8 MB).` }, { status: 413 });
    const doc = await parseDocument(file);
    return NextResponse.json({ name: doc.name, text: doc.text, chars: doc.text.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Could not read that file." }, { status: 422 });
  }
}
