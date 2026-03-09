
"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ScheduleEditorModal,
  type ClassOption,
  type RefOption,
  type TeacherOption,
  type TimeSlotInfo,
} from "@/components/ScheduleEditorModal";

type ApiResp = {
  ok: boolean;
  shift: string;
  school?: { name: string | null };
  editor: {
    teachers: TeacherOption[];
    classes: ClassOption[];
    subjects: RefOption[];
    rooms: RefOption[];
  };
  timeSlots: { id: string; weekday: number; period_index: number | null; starts_at: string | null; ends_at: string | null }[];
  classes: { id: string; header: { sala: string; levelStage: string; turma: string } }[];
  grid: Record<
    string,
    Record<
      string,
      {
        scheduleId?: string;
        timeSlotId: string;
        teacherId: string;
        classId: string;
        subjectId: string;
        roomId?: string | null;
        subject: string;
        teacher: string;
        room?: string | null;
        notes?: string | null;
        isTeacherAbsent?: boolean;
        replacementTeacherId?: string | null;
        replacementTeacherName?: string | null;
      }
	  >
	>;
};

const WEEKDAY = ["", "2ª FEIRA", "3ª FEIRA", "4ª FEIRA", "5ª FEIRA", "6ª FEIRA"];
const DAYS = [1, 2, 3, 4, 5];

function shiftLabel(v: string) {
  const k = String(v || "").toUpperCase();
  if (k === "MANHA") return "Manhã";
  if (k === "TARDE") return "Tarde";
  return "Noite";
}

function todayIsoLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function fmtDatePtBr(isoDate: string) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("pt-BR");
}

async function apiJson<T>(
  url: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init?.headers || {}),
      },
    });
    const json = (await res.json()) as any;
    if (!res.ok) return { ok: false, error: json?.error || res.statusText };
    return { ok: true, data: json as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Erro de rede" };
  }
}

export function GradesByClassClient() {
  const [shift, setShift] = useState("MANHA");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>(todayIsoLocal());
  const [nonce, setNonce] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    | null
    | {
        scheduleId?: string | null;
        lockClassId: string;
        slot: TimeSlotInfo;
        defaults: {
          activityType: "AULA" | "HA";
          teacherId: string;
          classId: string;
          subjectId: string;
          roomId: string;
          notes: string;
          isTeacherAbsent: boolean;
          replacementTeacherId: string;
        };
      }
  >(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/grades/classes?shift=${shift}`)
      .then((r) => r.json())
      .then((j) => setData(j))
      .finally(() => setLoading(false));
  }, [shift, nonce]);

  const slotByKey = useMemo(() => {
    const m = new Map<string, TimeSlotInfo>();
    for (const ts of data?.timeSlots || []) {
      const p = ts.period_index;
      if (!p) continue;
      m.set(`${ts.weekday}-${p}`, {
        id: ts.id,
        weekday: ts.weekday,
        period_index: ts.period_index,
        starts_at: ts.starts_at,
        ends_at: ts.ends_at,
      });
    }
    return m;
  }, [data?.timeSlots]);

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
      {banner ? (
        <div className="mb-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-800 shadow-sm dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200 print:hidden">
          {banner}
        </div>
      ) : null}

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

        <label className="flex items-center gap-2">
          <span className="text-sm font-semibold">Data</span>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950"
          />
        </label>

        <button
          onClick={() => window.print()}
          className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          Imprimir
        </button>
      </div>

      {data?.school?.name && (
        <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
          <div className="font-semibold">{data?.school?.name ?? ""}</div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">Turno:</span> {shiftLabel(shift)}
            {reportDate ? (
              <>
                <span className="mx-2 text-zinc-400">•</span>
                <span className="font-semibold">Data:</span> {fmtDatePtBr(reportDate)}
              </>
            ) : null}
          </div>
        </div>
      )}

      {loading && <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">Carregando…</div>}

      {data?.ok && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100 w-28"></th>
                {data.classes.map((c) => (
                  <th key={c.id} className="border border-zinc-200 bg-zinc-100 p-2 text-left align-bottom text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">
                    <div className="text-sm font-bold">{c.header.sala}</div>
                    <div className="text-[11px] font-medium">{c.header.levelStage}</div>
                    <div className="text-sm font-semibold">{c.header.turma}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((d) => (
                <Fragment key={`day-${d}`}>
                  <tr>
                    <td colSpan={1 + (data.classes?.length || 0)} className="border border-zinc-200 bg-zinc-50 p-2 text-sm font-semibold dark:border-zinc-800 dark:bg-zinc-950 print:bg-zinc-50">
                      {WEEKDAY[d]}
                    </td>
                  </tr>
                  {perDay[d].map((p) => (
                    <tr key={`${d}-${p}`}>
                      <td className="border border-zinc-200 p-2 text-center text-xs dark:border-zinc-800 w-28">
                        {p}º
                      </td>
                      {data.classes.map((c) => {
                        const key = `${d}-${p}`;
                        const cell = data.grid?.[key]?.[c.id];
                        const slot = slotByKey.get(key) || null;
                        return (
                          <td
                            key={c.id}
                            className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800 h-16 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                            onClick={() => {
                              if (!slot) return;
                              setEditing({
                                scheduleId: (cell as any)?.scheduleId ?? null,
                                lockClassId: c.id,
                                slot,
                                defaults: {
                                  activityType: "AULA",
                                  teacherId: String((cell as any)?.teacherId ?? ""),
                                  classId: c.id,
                                  subjectId: String((cell as any)?.subjectId ?? ""),
                                  roomId: String((cell as any)?.roomId ?? ""),
                                  notes: String((cell as any)?.notes ?? ""),
                                  isTeacherAbsent: Boolean((cell as any)?.isTeacherAbsent),
                                  replacementTeacherId: String((cell as any)?.replacementTeacherId ?? ""),
                                },
                              });
                            }}
                          >
                            {cell ? (
                              <div className="leading-tight">
                                <div className="font-semibold">{cell.subject}</div>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.teacher}</div>
                                {(cell as any)?.isTeacherAbsent ? (
                                  <div className="mt-1 grid gap-0.5">
                                    <div className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">Falta</div>
                                    <div className="text-[10px] text-zinc-600 dark:text-zinc-300">
                                      {(cell as any)?.replacementTeacherName ? `Subst.: ${(cell as any).replacementTeacherName}` : "Sem substituto"}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && data?.editor ? (
        <ScheduleEditorModal
          open={Boolean(editing)}
          scheduleId={editing.scheduleId ?? undefined}
          slot={editing.slot}
          teachers={data.editor.teachers}
          classes={data.editor.classes}
          subjects={data.editor.subjects}
          rooms={data.editor.rooms}
          lockClassId={editing.lockClassId}
          defaults={editing.defaults}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            setBanner(null);
            const r = await apiJson<any>("/api/weekly-grade/set", {
              method: "POST",
              body: JSON.stringify({ shift, ...payload }),
            });
            if (!r.ok) {
              setBanner(r.error);
              return;
            }
            setEditing(null);
            setNonce((n) => n + 1);
          }}
          onDelete={async (sid) => {
            setBanner(null);
            const r = await apiJson<any>("/api/weekly-grade/delete", {
              method: "POST",
              body: JSON.stringify({ shift, scheduleId: sid }),
            });
            if (!r.ok) {
              setBanner(r.error);
              return;
            }
            setEditing(null);
            setNonce((n) => n + 1);
          }}
        />
      ) : null}

      <style jsx global>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
          table, th, td { border: 1px solid #333 !important; }
        }
      `}</style>
    </div>
  );
}
