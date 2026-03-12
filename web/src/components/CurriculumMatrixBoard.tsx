"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  teacherAcceptsShift,
  teacherAllowedForClass,
  teacherAllowsSubject,
  teacherAvailable,
} from "@/lib/teacher-rules";

type SubjectRow = { id: string; name: string | null };
type TeacherRow = {
  id: string;
  name: string | null;
  shifts: string[];
  subject_id: string | null;
  subject_ids: string[];
  class_ids: string[];
  availability: any | null;
  default_room_id: string | null;
  teaching_rules: any[];
};
type ClassRow = { id: string; name: string | null; shift: string | null; display_order?: number | null };
type TimeSlotRow = {
  id: string;
  weekday: number;
  shift: string | null;
  period_index: number | null;
  starts_at: string | null;
  ends_at: string | null;
};
type RequirementRow = { id: string; class_id: string; subject_id: string; lessons_per_week: number };
type CellRow = {
  id: string;
  class_id: string;
  time_slot_id: string;
  subject_id: string;
  teacher_id: string | null;
  notes: string | null;
};

type ApiResp = {
  ok: boolean;
  shift: string;
  school?: { name: string | null };
  classes: ClassRow[];
  subjects: SubjectRow[];
  teachers: TeacherRow[];
  timeSlots: TimeSlotRow[];
  requirements: RequirementRow[];
  cells: CellRow[];
  settings?: {
    prefer_consecutive_weight: number;
    compact_teacher_days_weight: number;
    reduce_teacher_gaps_weight: number;
    avoid_last_period_penalty: number;
    spread_subjects_weight: number;
  };
};

const WEEKDAY = ["", "2ª FEIRA", "3ª FEIRA", "4ª FEIRA", "5ª FEIRA", "6ª FEIRA"];
const DAYS = [1, 2, 3, 4, 5];

function shiftLabel(v: string | null | undefined) {
  const k = String(v ?? "").trim().toUpperCase();
  if (k === "MANHA") return "Manhã";
  if (k === "TARDE") return "Tarde";
  if (k === "NOITE") return "Noite";
  return k || "—";
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

export function CurriculumMatrixBoard() {
  const [shift, setShift] = useState("MANHA");
  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [reportDate, setReportDate] = useState<string>(todayIsoLocal());
  const [banner, setBanner] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [edit, setEdit] = useState<null | {
    cellId?: string | null;
    classId: string;
    timeSlotId: string;
    subjectId: string;
    teacherId: string;
    notes: string;
  }>(null);

  async function refresh(targetShift = shift, allowAutoBuild = false) {
    setLoading(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/curriculum-matrix/state?shift=${encodeURIComponent(targetShift)}`);
      const json = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: json?.error || "Falha ao carregar a matriz curricular." });
        setData(null);
        return;
      }
      setData(json);
      if (allowAutoBuild && Array.isArray(json?.cells) && json.cells.length === 0) {
        const buildRes = await fetch(`/api/curriculum-matrix/build`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ shift: targetShift, overwrite: false }),
        });
        const buildJson = await buildRes.json();
        if (buildRes.ok && Number(buildJson?.applied ?? 0) > 0) {
          setBanner({ kind: "info", text: buildJson?.summary || "Matriz montada automaticamente." });
          const again = await fetch(`/api/curriculum-matrix/state?shift=${encodeURIComponent(targetShift)}`).then((r) => r.json());
          setData(again);
        } else if (!buildRes.ok && buildJson?.error) {
          setBanner({ kind: "error", text: buildJson.error });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(shift, true);
  }, [shift]);

  const subjectById = useMemo(() => new Map((data?.subjects ?? []).map((s) => [s.id, s])), [data?.subjects]);
  const teacherById = useMemo(() => new Map((data?.teachers ?? []).map((t) => [t.id, t])), [data?.teachers]);
  const classById = useMemo(() => new Map((data?.classes ?? []).map((s) => [s.id, s])), [data?.classes]);
  const slotById = useMemo(() => new Map((data?.timeSlots ?? []).map((s) => [s.id, s])), [data?.timeSlots]);

  const perDay = useMemo(() => {
    const map: Record<number, number[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    (data?.timeSlots || []).forEach((s) => {
      if (!s.period_index) return;
      if (!map[s.weekday].includes(s.period_index)) map[s.weekday].push(s.period_index);
    });
    for (const d of DAYS) map[d].sort((a, b) => a - b);
    return map;
  }, [data?.timeSlots]);

  const slotByKey = useMemo(() => {
    const map = new Map<string, TimeSlotRow>();
    for (const slot of data?.timeSlots || []) {
      if (!slot.period_index) continue;
      map.set(`${slot.weekday}-${slot.period_index}`, slot);
    }
    return map;
  }, [data?.timeSlots]);

  const grid = useMemo(() => {
    const out = new Map<string, CellRow>();
    for (const cell of data?.cells || []) {
      out.set(`${cell.time_slot_id}|${cell.class_id}`, cell);
    }
    return out;
  }, [data?.cells]);

  const placedByClassSubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of data?.cells || []) {
      const key = `${cell.class_id}|${cell.subject_id}`;
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [data?.cells]);

  const summary = useMemo(() => {
    const totalRequired = (data?.requirements || []).reduce((sum, row) => sum + Number(row.lessons_per_week || 0), 0);
    const totalPlaced = (data?.cells || []).length;
    const missing = Math.max(0, totalRequired - totalPlaced);
    const classesWithCells = new Set((data?.cells || []).map((item) => item.class_id)).size;
    return { totalRequired, totalPlaced, missing, classesWithCells };
  }, [data?.cells, data?.requirements]);

  const unmet = useMemo(() => {
    return (data?.requirements || [])
      .map((row) => {
        const placed = placedByClassSubject.get(`${row.class_id}|${row.subject_id}`) ?? 0;
        const missing = Math.max(0, Number(row.lessons_per_week || 0) - placed);
        return { ...row, placed, missing };
      })
      .filter((row) => row.missing > 0)
      .sort((a, b) => {
        const classNameA = String(classById.get(a.class_id)?.name ?? "");
        const classNameB = String(classById.get(b.class_id)?.name ?? "");
        if (classNameA !== classNameB) return classNameA.localeCompare(classNameB, "pt-BR");
        const subjectNameA = String(subjectById.get(a.subject_id)?.name ?? "");
        const subjectNameB = String(subjectById.get(b.subject_id)?.name ?? "");
        return subjectNameA.localeCompare(subjectNameB, "pt-BR");
      });
  }, [classById, data?.requirements, placedByClassSubject, subjectById]);

  const eligibleTeachers = useMemo(() => {
    if (!edit || !edit.subjectId) return [] as TeacherRow[];
    const slot = slotById.get(edit.timeSlotId);
    if (!slot) return [] as TeacherRow[];
    return (data?.teachers || []).filter((teacher) => {
      if (!teacherAcceptsShift(teacher, shift)) return false;
      if (!teacherAllowedForClass(teacher, edit.classId)) return false;
      if (!teacherAllowsSubject(teacher, edit.subjectId)) return false;
      return teacherAvailable(teacher, {
        shift,
        weekday: Number(slot.weekday ?? 0),
        period_index: Number(slot.period_index ?? 0),
      });
    });
  }, [data?.teachers, edit, shift, slotById]);

  async function buildMatrix() {
    setWorking(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/curriculum-matrix/build`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, overwrite: false }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: json?.error || "Falha ao montar a matriz curricular." });
        return;
      }
      const warnings = Array.isArray(json?.warnings) && json.warnings.length ? ` Avisos: ${json.warnings.slice(0, 3).join(" • ")}` : "";
      setBanner({ kind: "info", text: `${json?.summary || "Matriz montada."}${warnings}` });
      await refresh(shift, false);
    } finally {
      setWorking(false);
    }
  }

  async function resetMatrix() {
    const ok = window.confirm(`Deseja zerar a matriz curricular do turno ${shiftLabel(shift)}?`);
    if (!ok) return;

    setWorking(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/curriculum-matrix/reset`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, confirm: true }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: json?.error || "Falha ao zerar a matriz curricular." });
        return;
      }
      setBanner({ kind: "info", text: "Matriz zerada. Agora você pode editar manualmente ou montar novamente." });
      await refresh(shift, false);
    } finally {
      setWorking(false);
    }
  }

  async function saveCell() {
    if (!edit) return;
    setWorking(true);
    setBanner(null);
    try {
      const res = await fetch(`/api/curriculum-matrix/set`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shift,
          cellId: edit.cellId,
          classId: edit.classId,
          timeSlotId: edit.timeSlotId,
          subjectId: edit.subjectId,
          teacherId: edit.teacherId,
          notes: edit.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setBanner({ kind: "error", text: json?.error || "Falha ao salvar a célula." });
        return;
      }
      setEdit(null);
      setBanner({ kind: "info", text: edit.subjectId ? "Célula atualizada." : "Célula limpa." });
      await refresh(shift, false);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="grid gap-4">
      {banner ? (
        <div
          className={
            "rounded-xl border px-4 py-3 text-sm " +
            (banner.kind === "error"
              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
              : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200")
          }
        >
          {banner.text}
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
          type="button"
          onClick={() => void buildMatrix()}
          disabled={working || loading}
          className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
        >
          {working ? "Processando..." : "Completar / sincronizar"}
        </button>

        <button
          type="button"
          onClick={() => void resetMatrix()}
          disabled={working || loading}
          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
        >
          Zerar matriz
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          Imprimir
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm shadow-sm dark:border-zinc-900 dark:bg-zinc-950 print:border-none print:shadow-none">
        {data?.school?.name ? <div className="font-semibold">{data.school.name}</div> : null}
        <div className="mt-2 text-sm">
          <span className="font-semibold">Matriz curricular</span>
          <span className="mx-2 text-zinc-400">•</span>
          <span className="font-semibold">Turno:</span> {shiftLabel(shift)}
          {reportDate ? (
            <>
              <span className="mx-2 text-zinc-400">•</span>
              <span className="font-semibold">Data:</span> {fmtDatePtBr(reportDate)}
            </>
          ) : null}
        </div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Distribuição de disciplinas por turma. Ao editar a célula, você também pode vincular o professor para transformar a matriz em base da montagem da grade. E, se a grade já existir, a matriz pode ser sincronizada a partir dela.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4 print:hidden">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turmas com matriz</div>
          <div className="mt-1 text-2xl font-semibold">{summary.classesWithCells}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aulas previstas</div>
          <div className="mt-1 text-2xl font-semibold">{summary.totalRequired}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aulas distribuídas</div>
          <div className="mt-1 text-2xl font-semibold">{summary.totalPlaced}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aulas faltantes</div>
          <div className="mt-1 text-2xl font-semibold">{summary.missing}</div>
        </div>
      </div>

      {loading ? <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando matriz curricular…</div> : null}

      {data?.classes?.length ? (
        <div className="mt-1 overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border border-zinc-200 bg-zinc-100 p-2 text-left text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100 w-28"></th>
                {data.classes.map((c) => (
                  <th key={c.id} className="border border-zinc-200 bg-zinc-100 p-2 text-left align-bottom text-xs font-semibold dark:border-zinc-800 dark:bg-zinc-900 print:bg-zinc-100">
                    <div className="text-sm font-bold">{c.name ?? "Turma"}</div>
                    <div className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">{shiftLabel(c.shift)}</div>
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
                      <td className="border border-zinc-200 p-2 text-center text-xs dark:border-zinc-800 w-28">{p}º</td>
                      {data.classes.map((c) => {
                        const slot = slotByKey.get(`${d}-${p}`);
                        const cell = slot ? grid.get(`${slot.id}|${c.id}`) : null;
                        const subjectName = cell ? subjectById.get(cell.subject_id)?.name ?? "Disciplina" : null;
                        const teacherName = cell?.teacher_id ? teacherById.get(cell.teacher_id)?.name ?? "Professor" : null;
                        return (
                          <td
                            key={`${c.id}-${d}-${p}`}
                            className="h-16 cursor-pointer border border-zinc-200 p-2 align-top text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/30"
                            onClick={() => {
                              if (!slot) return;
                              setEdit({
                                cellId: cell?.id ?? null,
                                classId: c.id,
                                timeSlotId: slot.id,
                                subjectId: cell?.subject_id ?? "",
                                teacherId: cell?.teacher_id ?? "",
                                notes: cell?.notes ?? "",
                              });
                            }}
                          >
                            {cell ? (
                              <div className="leading-tight">
                                <div className="font-semibold">{subjectName}</div>
                                {teacherName ? <div className="mt-1 text-[10px] font-medium text-sky-700 dark:text-sky-300">{teacherName}</div> : null}
                                {cell.notes ? <div className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{cell.notes}</div> : null}
                              </div>
                            ) : (
                              <div className="text-[11px] text-zinc-400">Clique para definir</div>
                            )}
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
      ) : !loading ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Não há turmas cadastradas neste turno.
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1.5fr,1fr] print:hidden">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Pendências da distribuição</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-zinc-500 dark:text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Turma</th>
                  <th className="px-3 py-2 font-medium">Disciplina</th>
                  <th className="px-3 py-2 font-medium text-right">Previstas</th>
                  <th className="px-3 py-2 font-medium text-right">Distribuídas</th>
                  <th className="px-3 py-2 font-medium text-right">Faltantes</th>
                </tr>
              </thead>
              <tbody>
                {unmet.map((row) => (
                  <tr key={`${row.class_id}-${row.subject_id}`} className="border-t border-zinc-100 dark:border-zinc-900">
                    <td className="px-3 py-3">{classById.get(row.class_id)?.name ?? row.class_id}</td>
                    <td className="px-3 py-3">{subjectById.get(row.subject_id)?.name ?? row.subject_id}</td>
                    <td className="px-3 py-3 text-right">{row.lessons_per_week}</td>
                    <td className="px-3 py-3 text-right">{row.placed}</td>
                    <td className="px-3 py-3 text-right font-semibold">{row.missing}</td>
                  </tr>
                ))}
                {unmet.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      Tudo distribuído. O caos foi domesticado, pelo menos nesta parte.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Regras usadas na montagem</h2>
          <div className="mt-3 grid gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <div>Espalhamento por disciplina: <strong>{data?.settings?.spread_subjects_weight ?? 0}</strong></div>
            <div>Preferir aulas consecutivas: <strong>{data?.settings?.prefer_consecutive_weight ?? 0}</strong></div>
            <div>Compactar dia da turma: <strong>{data?.settings?.compact_teacher_days_weight ?? 0}</strong></div>
            <div>Reduzir janelas na turma: <strong>{data?.settings?.reduce_teacher_gaps_weight ?? 0}</strong></div>
            <div>Evitar último horário: <strong>{data?.settings?.avoid_last_period_penalty ?? 0}</strong></div>
          </div>
          <div className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
            A montagem automática preenche os slots com base na carga semanal definida e preserva edições manuais já feitas nas células.
          </div>
        </div>
      </div>

      {edit ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden">
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Editar célula da matriz</h3>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {classById.get(edit.classId)?.name ?? "Turma"} · {(() => {
                    const slot = slotById.get(edit.timeSlotId);
                    const weekday = WEEKDAY[Number(slot?.weekday ?? 0)] || "Dia";
                    const period = Number(slot?.period_index ?? 0);
                    return `${weekday} · ${period}º`;
                  })()}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Disciplina</span>
                <select
                  value={edit.subjectId}
                  onChange={(e) =>
                    setEdit((current) =>
                      current
                        ? {
                            ...current,
                            subjectId: e.target.value,
                            teacherId: e.target.value ? current.teacherId : "",
                          }
                        : current,
                    )
                  }
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="">Limpar célula</option>
                  {(data?.subjects || []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name ?? "Disciplina"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Professor</span>
                <select
                  value={edit.teacherId}
                  onChange={(e) => setEdit((current) => (current ? { ...current, teacherId: e.target.value } : current))}
                  disabled={!edit.subjectId}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="">Sem professor vinculado</option>
                  {eligibleTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name ?? "Professor"}
                    </option>
                  ))}
                </select>
                {edit.subjectId ? (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {eligibleTeachers.length
                      ? "A lista mostra apenas professores compatíveis com esta disciplina, turma e horário."
                      : "Nenhum professor compatível encontrado para esta combinação. Você ainda pode salvar a disciplina sem professor."}
                  </div>
                ) : (
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Selecione a disciplina primeiro para liberar o vínculo de professor.
                  </div>
                )}
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Observação</span>
                <textarea
                  value={edit.notes}
                  onChange={(e) => setEdit((current) => (current ? { ...current, notes: e.target.value } : current))}
                  rows={3}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void saveCell()}
                  disabled={working}
                  className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setEdit((current) => (current ? { ...current, subjectId: "", teacherId: "", notes: "" } : current))}
                  disabled={working}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                >
                  Limpar célula
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
