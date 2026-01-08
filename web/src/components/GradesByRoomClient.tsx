
"use client";

import { useEffect, useMemo, useState } from "react";

type ApiResp = {
  ok: boolean;
  shift: string;
  school?: { name: string | null; term_label: string | null };
  timeSlots: { weekday: number; period_index: number | null; starts_at: string | null; ends_at: string | null }[];
  rooms: { id: string; header: string }[];
  grid: Record<string, Record<string, { className: string; subject: string; teacher: string }>>;
};

const WEEKDAY = ["", "2ª FEIRA", "3ª FEIRA", "4ª FEIRA", "5ª FEIRA", "6ª FEIRA"];
const DAYS = [1, 2, 3, 4, 5];

export function GradesByRoomClient() {
  const [shift, setShift] = useState("MANHA");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/grades/rooms?shift=${shift}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, [shift]);

  const perDay = useMemo(() => {
    const map: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (data?.timeSlots || []).forEach((s) => {
      if (!s.period_index) return;
      if (!map[s.weekday].includes(s.period_index)) map[s.weekday].push(s.period_index);
    });
    for (const d of DAYS) map[d].sort((a, b) => a - b);
    return map;
  }, [data?.timeSlots]);

  return (
    <div>
      <div className="flex items-center gap-2 print:hidden">
        <select value={shift} onChange={(e) => setShift(e.target.value)} className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950">
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
          <option value="NOITE">Noite</option>
        </select>
        <button onClick={() => window.print()} className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900">
          Imprimir
        </button>
      </div>

      {(data?.school?.name || data?.school?.term_label) && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
          <div className="font-semibold">{data?.school?.name ?? ""}</div>
          <div className="text-zinc-600 dark:text-zinc-400">{data?.school?.term_label ?? ""}</div>
        </div>
      )}

      {loading && <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Carregando…</div>}

      {data?.ok && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100 w-28"></th>
                {data.rooms.map((r) => (
                  <th key={r.id} className="border border-zinc-200 bg-zinc-100 p-2 text-left align-bottom text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">
                    <div className="text-sm font-bold">{r.header}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <>
                  <tr key={`day-${d}`}>
                    <td colSpan={1 + (data.rooms?.length || 0)} className="border border-zinc-200 bg-zinc-50 p-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-950 print:bg-zinc-50">
                      {WEEKDAY[d]}
                    </td>
                  </tr>
                  {perDay[d].map((p) => (
                    <tr key={`${d}-${p}`}>
                      <td className="border border-zinc-200 p-2 text-center text-xs dark:border-zinc-800 w-28">
                        {p}º
                      </td>
                      {data.rooms.map((r) => {
                        const cell = data.grid?.[`${d}-${p}`]?.[r.id];
                        return (
                          <td key={r.id} className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800 h-16">
                            {cell ? (
                              <div className="leading-tight">
                                <div className="font-semibold">{cell.className}</div>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">
                                  {cell.subject} — {cell.teacher}
                                </div>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          table, th, td { border: 1px solid #333 !important; }
        }
      `}</style>
    </div>
  );
}
