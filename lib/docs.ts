import { MAX_DOC_CHARS } from "./sanitize";

const TEXT_EXT = /\.(txt|md|markdown|csv|json|html?)$/i;

/** PDF text comes out hard-wrapped at line width; rejoin lines inside a paragraph. */
export function reflow(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      continue;
    }
    const prev = out.length ? out[out.length - 1] : "";
    const startsNew = /^([•\-*–]|\d+[.)])\s/.test(line) || /^[A-Z0-9][A-Z0-9 &/\-]{2,40}$/.test(line);
    const prevEnds = /[.!?:;]$/.test(prev);
    if (prev && !startsNew && !prevEnds && prev.length > 30) out[out.length - 1] = `${prev} ${line}`;
    else out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function parseDocument(file: File): Promise<{ name: string; text: string }> {
  const name = file.name || "Document";
  const buf = new Uint8Array(await file.arrayBuffer());
  let text = "";

  if (/\.pdf$/i.test(name) || file.type === "application/pdf") {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(buf);
    const out = await extractText(pdf, { mergePages: true });
    text = reflow(Array.isArray(out.text) ? out.text.join("\n") : out.text);
  } else if (/\.docx$/i.test(name)) {
    const mammoth = await import("mammoth");
    const res = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
    text = res.value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  } else if (TEXT_EXT.test(name) || file.type.startsWith("text/")) {
    text = new TextDecoder("utf-8").decode(buf).replace(/\r/g, "");
    if (/\.html?$/i.test(name)) {
      text = text
        .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+/g, " ");
    }
    text = text.trim();
  } else {
    throw new Error("Unsupported file type. Upload a PDF, Word (.docx), .txt, .md, .csv, .json or .html file.");
  }

  if (!text) throw new Error(`Couldn't find readable text in "${name}". (Scanned PDFs need OCR first.)`);
  return { name, text: text.slice(0, MAX_DOC_CHARS) };
}
