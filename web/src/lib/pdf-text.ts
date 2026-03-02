import pdfParse from "pdf-parse";

/**
 * Extract text from a PDF URL (or already-fetched bytes).
 * Uses pdf-parse when possible (much better than raw byte decoding).
 */
export async function extractPdfTextFromUrl(url: string): Promise<{ text: string; contentType?: string }> {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Falha ao baixar PDF (${r.status})`);
  const contentType = r.headers.get("content-type") || undefined;
  const buf = Buffer.from(await r.arrayBuffer());
  const text = await extractPdfTextFromBytes(buf);
  return { text, contentType };
}

export async function extractPdfTextFromBytes(bytes: Buffer): Promise<string> {
  // First try real parsing
  try {
    const out = await pdfParse(bytes);
    const t = String(out?.text || "").replace(/\s+/g, " ").trim();
    if (t && t.length >= 30) return t;
  } catch {
    // ignore, fallback below
  }

  // Fallback: best-effort string recovery from bytes
  try {
    const dec = new TextDecoder("latin1");
    const raw = dec.decode(bytes);
    return String(raw || "")
      .replace(/\(D:\d{14}.*?\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}
