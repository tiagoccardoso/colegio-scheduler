
"use client";

import { useEffect, useMemo, useState } from "react";

type TeacherItem = { id: string; label: string };

type ApiResp = {
  ok: boolean;
  shift: string;
  teacherId: string | null;
  teacher?: TeacherItem | null;
  teachers: TeacherItem[];
  school?: { name: string | null; term_label: string | null };
  timeSlots: { weekday: number; period_index: number | null; starts_at: string | null; ends_at: string | null }[];
  grid: Record<string, { className: string; subject: string; room: string | null }>;
};

const WEEKDAY = ["", "2ª FEIRA", "3ª FEIRA", "4ª FEIRA", "5ª FEIRA", "6ª FEIRA"];
const DAYS = [1, 2, 3, 4, 5];

function shiftLabel(v: string) {
  const k = String(v || "").toUpperCase();
  if (k === "MANHA") return "Manhã";
  if (k === "TARDE") return "Tarde";
  return "Noite";
}

function fmtTime(v: string | null) {
  if (!v) return "";
  // Supabase time can come as "HH:MM:SS"; keep HH:MM
  return String(v).slice(0, 5);
}

export function GradesByTeacherClient() {
  const [shift, setShift] = useState("MANHA");
  const [teacherId, setTeacherId] = useState<string>("");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("shift", shift);
    if (teacherId) params.set("teacherId", teacherId);

    setLoading(true);
    fetch(`/api/grades/teachers?${params.toString()}`)
      .then((r) => r.json())
      .then((j: ApiResp) => {
        setData(j);
        if (!teacherId && j?.teachers?.length) {
          setTeacherId(j.teachers[0].id);
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift, teacherId]);

  const periods = useMemo(() => {
    const set = new Set<number>();
    (data?.timeSlots || []).forEach((s) => {
      if (Number.isFinite(s.period_index)) set.add(Number(s.period_index));
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [data?.timeSlots]);

  const periodTime = useMemo(() => {
    const map: Record<number, { starts_at: string | null; ends_at: string | null }> = {};
    for (const ts of data?.timeSlots || []) {
      const p = ts.period_index;
      if (!p) continue;
      if (!map[p]) map[p] = { starts_at: ts.starts_at, ends_at: ts.ends_at };
    }
    return map;
  }, [data?.timeSlots]);

  const selectedTeacherLabel = useMemo(() => {
    if (data?.teacher?.label) return data.teacher.label;
    const t = data?.teachers?.find((x) => x.id === teacherId);
    return t?.label ?? "";
  }, [data?.teacher?.label, data?.teachers, teacherId]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <select
          value={shift}
          onChange={(e) => setShift(e.target.value)}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950"
        >
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
          <option value="NOITE">Noite</option>
        </select>

        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="min-w-[260px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950"
        >
          {(data?.teachers || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>

        <button
          onClick={() => window.print()}
          className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          Imprimir
        </button>
      </div>

      {(data?.school?.name || data?.school?.term_label || selectedTeacherLabel) && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
          <div className="font-semibold">{data?.school?.name ?? ""}</div>
          <div className="text-zinc-600 dark:text-zinc-400">{data?.school?.term_label ?? ""}</div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">Professor:</span> {selectedTeacherLabel || "—"}
            <span className="mx-2 text-zinc-400">•</span>
            <span className="font-semibold">Turno:</span> {shiftLabel(shift)}
          </div>
        </div>
      )}

      {loading && <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Carregando…</div>}

      {data?.ok && teacherId && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100 w-40">
                  Período
                </th>
                {DAYS.map((d) => (
                  <th
                    key={d}
                    className="border border-zinc-200 bg-zinc-100 p-2 text-left align-bottom text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100"
                  >
                    <div className="text-sm font-bold">{WEEKDAY[d]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => {
                const tm = periodTime[p];
                const time = tm ? `${fmtTime(tm.starts_at)}${tm.ends_at ? `–${fmtTime(tm.ends_at)}` : ""}`.trim() : "";
                return (
                  <tr key={p}>
                    <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                      <div className="font-semibold">{p}º</div>
                      {time ? <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{time}</div> : null}
                    </td>
                    {DAYS.map((d) => {
                      const cell = data.grid?.[`${d}-${p}`];
                      return (
                        <td key={d} className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800 h-16">
                          {cell ? (
                            <div className="leading-tight">
                              <div className="font-semibold">{cell.className}</div>
                              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.subject}</div>
                              {cell.room ? (
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.room}</div>
                              ) : null}
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
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
