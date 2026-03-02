export type Candidate = { date: string; context: string; raw: string };
export type HeuristicEvent = {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string | null;
  end_date?: string | null; // YYYY-MM-DD
  end_time?: string | null;
  category?: string | null;
};

const MONTHS: Record<string, number> = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  março: 3,
  marco: 3,
  abr: 4,
  abril: 4,
  mai: 5,
  maio: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12,
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function inferDocumentYear(text: string): number {
  // Prefer explicit 202x in the header
  const m = String(text || "").match(/\b(20\d{2})\b/g);
  if (!m || !m.length) return new Date().getUTCFullYear();
  const years = m.map((x) => Number(x)).filter((y) => y >= 2000 && y <= 2100);
  if (!years.length) return new Date().getUTCFullYear();
  // Most frequent year wins
  const freq = new Map<number, number>();
  for (const y of years) freq.set(y, (freq.get(y) || 0) + 1);
  return Array.from(freq.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

export function normalizePdfWhitespace(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function asISODate(y: number, m: number, d: number): string | null {
  if (!y || !m || !d) return null;
  if (y < 1900 || y > 2200) return null;
  if (m < 1 || m > 12) return null;
  if (d < 1 || d > 31) return null;
  // Basic validation via Date
  const dt = new Date(Date.UTC(y, m - 1, d, 9, 0, 0));
  if (isNaN(dt.getTime())) return null;
  // Ensure it didn't overflow (e.g., 31/02)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function findCandidates(text: string, opts?: { max?: number; defaultYear?: number }): Candidate[] {
  const max = opts?.max ?? 64;
  const defaultYear = opts?.defaultYear ?? inferDocumentYear(text);
  const s = normalizePdfWhitespace(text);

  const matches: Array<{ idx: number; raw: string; iso: string }> = [];

  // dd/mm/yyyy
  for (const m of s.matchAll(/(\b\d{1,2})\/(\d{1,2})\/(\d{4}\b)/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    const iso = asISODate(y, mo, d);
    if (iso) matches.push({ idx: m.index ?? 0, raw: m[0], iso });
  }

  // dd/mm (infer year)
  for (const m of s.matchAll(/(\b\d{1,2})\/(\d{1,2})(?!\/)\b/g)) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = defaultYear;
    const iso = asISODate(y, mo, d);
    if (iso) matches.push({ idx: m.index ?? 0, raw: m[0], iso });
  }

  // "1º Jan" / "1 Jan" / "1 Janeiro"
  for (const m of s.matchAll(/(\b\d{1,2})(?:º|°)?\s*(jan(?:eiro)?|fev(?:ereiro)?|mar(?:ço|co)?|abr(?:il)?|mai(?:o)?|jun(?:ho)?|jul(?:ho)?|ago(?:sto)?|set(?:embro)?|out(?:ubro)?|nov(?:embro)?|dez(?:embro)?)\b/gi)) {
    const d = Number(m[1]);
    const mo = MONTHS[String(m[2]).toLowerCase()] || 0;
    const y = defaultYear;
    const iso = asISODate(y, mo, d);
    if (iso) matches.push({ idx: m.index ?? 0, raw: m[0], iso });
  }

  // "16 de março" / "7 de Agosto"
  for (const m of s.matchAll(/(\b\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\b/gi)) {
    const d = Number(m[1]);
    const mo = MONTHS[String(m[2]).toLowerCase()] || 0;
    const y = defaultYear;
    const iso = asISODate(y, mo, d);
    if (iso) matches.push({ idx: m.index ?? 0, raw: m[0], iso });
  }

  // Dedup by (iso, nearby context)
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const m of matches.sort((a, b) => a.idx - b.idx)) {
    const left = Math.max(0, m.idx - 130);
    const right = Math.min(s.length, m.idx + 260);
    const ctx = s.slice(left, right).replace(/\s+/g, " ").trim();
    const key = `${m.iso}|${ctx.slice(0, 90)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ date: m.iso, context: ctx.slice(0, 520), raw: m.raw });
    if (out.length >= max) break;
  }

  return out;
}

function titleCaseTrim(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

export function extractHeuristicEvents(text: string, year: number): HeuristicEvent[] {
  const s = normalizePdfWhitespace(text);
  const out: HeuristicEvent[] = [];

  // (A) Trimestres: "1º T. - 05/02 a 14/05"
  for (const m of s.matchAll(/(\b\d{1,2})\s*º?\s*T\.?\s*[-–]\s*(\d{1,2})\/(\d{1,2})\s*a\s*(\d{1,2})\/(\d{1,2})/gi)) {
    const tri = Number(m[1]);
    const d1 = Number(m[2]);
    const m1 = Number(m[3]);
    const d2 = Number(m[4]);
    const m2 = Number(m[5]);
    const start = asISODate(year, m1, d1);
    const end = asISODate(year, m2, d2);
    if (!start || !end) continue;
    out.push({
      title: `${tri}º Trimestre`,
      date: start,
      end_date: end,
      time: "09:00",
      end_time: "18:00",
      category: "Período",
    });
  }

  // (B) Linhas de feriados tipo "1º Jan - Ano Novo" / "25 Dez - Natal"
  for (const m of s.matchAll(/(\b\d{1,2})(?:º|°)?\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\s*[-–]\s*([^.;]{3,120})/gi)) {
    const d = Number(m[1]);
    const mo = MONTHS[String(m[2]).toLowerCase()] || 0;
    const iso = asISODate(year, mo, d);
    if (!iso) continue;
    const title = titleCaseTrim(m[3]);
    // Avoid absurd captures
    if (title.length < 3) continue;
    out.push({ title, date: iso, time: "09:00", category: "Feriado" });
  }

  // (C) "De 16 a 20 de março: <texto>"
  for (const m of s.matchAll(/\bDe\s+(\d{1,2})\s+a\s+(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[:\-–]\s*([^.;]{6,160})/gi)) {
    const d1 = Number(m[1]);
    const d2 = Number(m[2]);
    const mo = MONTHS[String(m[3]).toLowerCase()] || 0;
    const start = asISODate(year, mo, d1);
    const end = asISODate(year, mo, d2);
    if (!start || !end) continue;
    const title = titleCaseTrim(m[4]);
    out.push({ title, date: start, end_date: end, time: "09:00", end_time: "18:00", category: "Período" });
  }

  // (D) "No dia 7 de Agosto ..." / "No dia 7 de agosto: <texto>"
  for (const m of s.matchAll(/\bNo\s+dia\s+(\d{1,2})\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s*[:\-–]?\s*([^.;]{6,160})/gi)) {
    const d = Number(m[1]);
    const mo = MONTHS[String(m[2]).toLowerCase()] || 0;
    const iso = asISODate(year, mo, d);
    if (!iso) continue;
    const title = titleCaseTrim(m[3]);
    out.push({ title, date: iso, time: "09:00", category: "Evento" });
  }

  // Dedup by title+date+end_date
  const seen = new Set<string>();
  const dedup: HeuristicEvent[] = [];
  for (const e of out) {
    const k = `${e.title.toLowerCase()}|${e.date}|${e.end_date || ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    dedup.push(e);
  }
  return dedup;
}
