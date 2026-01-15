"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResp = {
  ok: boolean;
  shift: string;
  school?: { name: string | null };
  timeSlots: {
    id?: string;
    weekday: number;
    period_index: number | null;
    starts_at: string | null;
    ends_at: string | null;
  }[];
  items: {
    teacherId: string;
    teacherName: string;
    slots: {
      weekday: number;
      period_index: number | null;
      timeSlotId: string;
      notes: string | null;
    }[];
  }[];
};

const WEEKDAYS: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

const SHIFT_ORDER: Record<string, number> = { MANHA: 1, TARDE: 2, NOITE: 3 };

function shiftLabel(v: string) {
  const k = String(v || "").trim().toUpperCase();
  if (k === "MANHA") return "Manhã";
  if (k === "TARDE") return "Tarde";
  if (k === "NOITE") return "Noite";
  return v;
}

function fmtTime(v: string | null) {
  if (!v) return "";
  // Supabase time pode vir como HH:MM:SS
  return String(v).slice(0, 5);
}

export function GradesHaClient() {
  const [shift, setShift] = useState<string>("ALL");
  const [datasets, setDatasets] = useState<ApiResp[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (shift === "ALL") {
          const [m, t, n] = await Promise.all([
            fetch(`/api/grades/ha?shift=MANHA`).then((r) => r.json()),
            fetch(`/api/grades/ha?shift=TARDE`).then((r) => r.json()),
            fetch(`/api/grades/ha?shift=NOITE`).then((r) => r.json()),
          ]);
          if (!cancelled) setDatasets([m as ApiResp, t as ApiResp, n as ApiResp]);
        } else {
          const d = (await fetch(`/api/grades/ha?shift=${shift}`).then((r) => r.json())) as ApiResp;
          if (!cancelled) setDatasets([d]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shift]);

  const header = useMemo(() => {
    const first = datasets?.find((d) => d?.ok) ?? datasets?.[0];
    return {
      schoolName: first?.school?.name ?? null,
      ok: Boolean(datasets?.some((d) => d?.ok)),
    };
  }, [datasets]);

  const rows = useMemo(() => {
    const out: {
      teacherName: string;
      shift: string;
      weekday: number;
      period_index: number;
      starts_at: string | null;
      ends_at: string | null;
      notes: string | null;
    }[] = [];

    for (const d of datasets || []) {
      if (!d?.ok) continue;

      const slotTimeByKey: Record<string, { starts_at: string | null; ends_at: string | null }> = {};
      for (const ts of d.timeSlots || []) {
        const wd = Number(ts.weekday);
        const p = Number(ts.period_index ?? 0);
        if (!(wd >= 1 && wd <= 7)) continue;
        if (!p) continue;
        slotTimeByKey[`${wd}-${p}`] = { starts_at: ts.starts_at ?? null, ends_at: ts.ends_at ?? null };
      }

      for (const t of d.items || []) {
        for (const s of t.slots || []) {
          const wd = Number(s.weekday);
          const p = Number(s.period_index ?? 0);
          if (!(wd >= 1 && wd <= 7)) continue;
          if (!p) continue;
          const tm = slotTimeByKey[`${wd}-${p}`];
          out.push({
            teacherName: t.teacherName,
            shift: d.shift,
            weekday: wd,
            period_index: p,
            starts_at: tm?.starts_at ?? null,
            ends_at: tm?.ends_at ?? null,
            notes: s.notes ?? null,
          });
        }
      }
    }

    out.sort((a, b) => {
      const sa = SHIFT_ORDER[String(a.shift).toUpperCase()] ?? 99;
      const sb = SHIFT_ORDER[String(b.shift).toUpperCase()] ?? 99;
      if (sa !== sb) return sa - sb;
      const tn = String(a.teacherName).localeCompare(String(b.teacherName));
      if (tn !== 0) return tn;
      if (a.weekday !== b.weekday) return a.weekday - b.weekday;
      return a.period_index - b.period_index;
    });

    return out;
  }, [datasets]);

  const totals = useMemo(() => {
    const totalHa = rows.length;
    const teachers = new Set(rows.map((r) => r.teacherName));
    return { totalHa, teachersWithHa: teachers.size };
  }, [rows]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950"
        >
          <option value="ALL">Todos os turnos</option>
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
          <option value="NOITE">Noite</option>
        </select>

        <button
          onClick={() => window.print()}
          className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          Imprimir
        </button>
      </div>

      {header.schoolName && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
          <div className="font-semibold">{header.schoolName ?? ""}</div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">Relatório:</span> Hora Atividade
            <span className="mx-2 text-zinc-400">•</span>
            <span className="font-semibold">Turno:</span> {shift === "ALL" ? "Todos" : shiftLabel(shift)}
            <span className="mx-2 text-zinc-400">•</span>
            <span className="font-semibold">Registros:</span> {totals.totalHa}
            <span className="mx-2 text-zinc-400">•</span>
            <span className="font-semibold">Professores:</span> {totals.teachersWithHa}
          </div>
        </div>
      )}

      {loading && <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Carregando…</div>}

      {header.ok && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">Professor</th>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">Turno</th>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">Dia</th>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100 w-20">Período</th>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">Horário</th>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => {
                const time = r.starts_at && r.ends_at ? `${fmtTime(r.starts_at)}–${fmtTime(r.ends_at)}` : "";
                return (
                  <tr key={`${idx}-${r.teacherName}-${r.shift}-${r.weekday}-${r.period_index}`} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">{r.teacherName || "(sem nome)"}</td>
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">{shiftLabel(r.shift)}</td>
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">{WEEKDAYS[r.weekday] ?? "—"}</td>
                    <td className="border border-zinc-200 p-2 text-center text-xs dark:border-zinc-800">{r.period_index}º</td>
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">{time || "—"}</td>
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">{r.notes || "—"}</td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="border border-zinc-200 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                    Nenhuma Hora Atividade cadastrada.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          table, th, td { border: 1px solid #333 !important; }
        }
      `}</style>
    </div>
  );
}
