
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ScheduleEditorModal,
  type ClassOption,
  type RefOption,
  type TeacherOption,
  type TimeSlotInfo,
} from "@/components/ScheduleEditorModal";

type TeacherItem = { id: string; label: string };

const ALL_TEACHERS = "__ALL__";

type GridCell =
  | {
      scheduleId?: string;
      timeSlotId: string;
      teacherId: string;
      activityType: "AULA" | "HA" | string;
      classId?: string | null;
      subjectId?: string | null;
      roomId?: string | null;
      className: string;
      subject: string;
      room: string | null;
      notes?: string | null;
      isTeacherAbsent?: boolean;
      replacementTeacherId?: string | null;
      replacementTeacherName?: string | null;
    }
  | null;

type Grid = Record<string, GridCell>;

type ApiResp = {
  ok: boolean;
  shift: string;
  all?: boolean;
  teacherId: string | null;
  teacher?: TeacherItem | null;
  teachers: TeacherItem[];
  reports?: { teacher: TeacherItem; grid: Grid }[] | null;
  school?: { name: string | null };
  editor: {
    teachers: TeacherOption[];
    classes: ClassOption[];
    subjects: RefOption[];
    rooms: RefOption[];
  };
  timeSlots: { id: string; weekday: number; period_index: number | null; starts_at: string | null; ends_at: string | null }[];
  grid: Grid;
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

export function GradesByTeacherClient() {
  const [shift, setShift] = useState("MANHA");
  const [teacherId, setTeacherId] = useState<string>("");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportDate, setReportDate] = useState<string>(todayIsoLocal());
  const [nonce, setNonce] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [editing, setEditing] = useState<
    | null
    | {
        scheduleId?: string | null;
        slot: TimeSlotInfo;
        lockTeacherId: string;
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
  }, [shift, teacherId, nonce]);

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
    if (teacherId === ALL_TEACHERS) return "Todos os professores";
    if (data?.teacher?.label) return data.teacher.label;
    const t = data?.teachers?.find((x) => x.id === teacherId);
    return t?.label ?? "";
  }, [data?.teacher?.label, data?.teachers, teacherId]);

  const isAllTeachers = teacherId === ALL_TEACHERS;

  const renderTable = (grid: Grid, lockTeacherId: string) => (
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
            const time = tm
              ? `${fmtTime(tm.starts_at)}${tm.ends_at ? `–${fmtTime(tm.ends_at)}` : ""}`.trim()
              : "";
            return (
              <tr key={p}>
                <td className="border border-zinc-200 p-2 text-xs dark:border-zinc-800">
                  <div className="font-semibold">{p}º</div>
                  {time ? <div className="text-[11px] text-zinc-600 dark:text-zinc-400">{time}</div> : null}
                </td>
                {DAYS.map((d) => {
                  const key = `${d}-${p}`;
                  const cell = grid?.[key];
                  const isHa = cell && String(cell.activityType || "").trim().toUpperCase() === "HA";
                  const slot = slotByKey.get(key) || null;
                  return (
                    <td
                      key={d}
                      className="border border-zinc-200 p-2 align-top text-xs dark:border-zinc-800 h-16 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/30"
                      onClick={() => {
                        if (!slot) return;
                        const defAct = isHa ? "HA" : "AULA";
                        const ownerTeacherId = String((cell as any)?.teacherId ?? lockTeacherId);
                        setEditing({
                          scheduleId: (cell as any)?.scheduleId ?? null,
                          slot,
                          lockTeacherId: ownerTeacherId,
                          defaults: {
                            activityType: defAct,
                            teacherId: lockTeacherId,
                            classId: !isHa ? String((cell as any)?.classId ?? "") : "",
                            subjectId: !isHa ? String((cell as any)?.subjectId ?? "") : "",
                            roomId: !isHa ? String((cell as any)?.roomId ?? "") : "",
                            notes: String((cell as any)?.notes ?? ""),
                            isTeacherAbsent: Boolean((cell as any)?.isTeacherAbsent),
                            replacementTeacherId: String((cell as any)?.replacementTeacherId ?? ""),
                          },
                        });
                      }}
                    >
                      {cell ? (
                        <div className="leading-tight">
                          {isHa ? (
                            <>
                              <div className="font-semibold">Hora Atividade</div>
                              {cell.notes ? (
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.notes}</div>
                              ) : (
                                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">(sem observações)</div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="font-semibold">{cell.className}</div>
                              <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.subject}</div>
                              {cell.room ? (
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-300">{cell.room}</div>
                              ) : null}
                              {(cell as any)?.isTeacherAbsent ? (
                                <div className="mt-1 grid gap-0.5">
                                  <div className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">Falta</div>
                                  <div className="text-[10px] text-zinc-600 dark:text-zinc-300">
                                    {(cell as any)?.replacementTeacherName ? `Subst.: ${(cell as any).replacementTeacherName}` : "Sem substituto"}
                                  </div>
                                </div>
                              ) : null}
                            </>
                          )}
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
  );



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

        <select
          value={teacherId}
          onChange={(e) => setTeacherId(e.target.value)}
          className="min-w-[260px] rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-900 dark:bg-zinc-950"
        >
          <option value="" disabled>
            Selecione…
          </option>
          <option value={ALL_TEACHERS}>Todos os professores</option>
          {(data?.teachers || []).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
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

      {(data?.school?.name || selectedTeacherLabel) && (
        <div className={`mt-3 rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none ${isAllTeachers ? "print:hidden" : ""}`}>
          <div className="font-semibold">{data?.school?.name ?? ""}</div>
          <div className="mt-2 text-sm">
            <span className="font-semibold">Professor:</span> {selectedTeacherLabel || "—"}
            <span className="mx-2 text-zinc-400">•</span>
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
        <>
          {isAllTeachers ? (
            <div className="mt-4">
              {(data?.reports || []).map((r) => (
                <div key={r.teacher.id} className="teacher-report-page">
                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
                    <div className="font-semibold">{data?.school?.name ?? ""}</div>
                    <div className="mt-2 text-sm">
                      <span className="font-semibold">Professor:</span> {r.teacher.label || "—"}
                      <span className="mx-2 text-zinc-400">•</span>
                      <span className="font-semibold">Turno:</span> {shiftLabel(shift)}
                      {reportDate ? (
                        <>
                          <span className="mx-2 text-zinc-400">•</span>
                          <span className="font-semibold">Data:</span> {fmtDatePtBr(reportDate)}
                        </>
                      ) : null}
                    </div>
                  </div>

                  {renderTable(r.grid, r.teacher.id)}
                </div>
              ))}
            </div>
          ) : teacherId ? (
            renderTable(data?.grid || {}, teacherId)
          ) : null}
        </>
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
          lockTeacherId={editing.lockTeacherId}
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
          @page { size: A4 portrait; margin: 12mm; }
          table, th, td { border: 1px solid #333 !important; }
          .teacher-report-page {
            break-after: page;
            page-break-after: always;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .teacher-report-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
        }
      `}</style>
    </div>
  );
}
