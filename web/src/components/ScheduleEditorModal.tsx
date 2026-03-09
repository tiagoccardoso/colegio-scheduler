"use client";

import { useEffect, useMemo, useState } from "react";

type ActivityType = "AULA" | "HA";

export type TeacherOption = {
  id: string;
  name: string | null;
  short_name?: string | null;
  subject_id?: string | null;
  default_room_id?: string | null;
};

export type ClassOption = {
  id: string;
  name: string | null;
  shift?: string | null;
  default_room_id?: string | null;
};

export type RefOption = { id: string; name: string | null };

export type TimeSlotInfo = {
  id: string;
  weekday: number;
  period_index: number | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Segunda" },
  { key: 2, label: "Terça" },
  { key: 3, label: "Quarta" },
  { key: 4, label: "Quinta" },
  { key: 5, label: "Sexta" },
  { key: 6, label: "Sábado" },
  { key: 7, label: "Domingo" },
];

function normActivityType(v: any): ActivityType {
  const k = String(v || "").trim().toUpperCase();
  return k === "HA" ? "HA" : "AULA";
}

function teacherLabel(t: TeacherOption) {
  return String(t.short_name ?? "").trim() || String(t.name ?? "").trim() || "(sem nome)";
}

export function ScheduleEditorModal(props: {
  open: boolean;
  scheduleId?: string | null;
  slot: TimeSlotInfo;
  teachers: TeacherOption[];
  classes: ClassOption[];
  subjects: RefOption[];
  rooms: RefOption[];
  lockTeacherId?: string | null;
  lockClassId?: string | null;
  lockRoomId?: string | null;
  lockActivityType?: ActivityType | null;
  defaults: {
    activityType: ActivityType;
    teacherId: string;
    classId: string;
    subjectId: string;
    roomId: string;
    notes: string;
    isTeacherAbsent: boolean;
    replacementTeacherId: string;
  };
  onClose: () => void;
  onSave: (args: {
    scheduleId?: string;
    teacherId: string;
    timeSlotId: string;
    activityType: ActivityType;
    classId?: string;
    subjectId?: string;
    roomId: string | null;
    notes: string | null;
    isTeacherAbsent: boolean;
    replacementTeacherId: string | null;
  }) => void;
  onDelete?: (scheduleId: string) => void;
}) {
  const {
    open,
    scheduleId,
    slot,
    teachers,
    classes,
    subjects,
    rooms,
    lockTeacherId,
    lockClassId,
    lockRoomId,
    lockActivityType,
    defaults,
    onClose,
    onSave,
    onDelete,
  } = props;

  const [activityType, setActivityType] = useState<ActivityType>(defaults.activityType);
  const [teacherId, setTeacherId] = useState(defaults.teacherId);
  const [classId, setClassId] = useState(defaults.classId);
  const [subjectId, setSubjectId] = useState(defaults.subjectId);
  const [roomId, setRoomId] = useState(defaults.roomId);
  const [notes, setNotes] = useState(defaults.notes);
  const [isTeacherAbsent, setIsTeacherAbsent] = useState(defaults.isTeacherAbsent);
  const [replacementTeacherId, setReplacementTeacherId] = useState(defaults.replacementTeacherId);

  useEffect(() => {
    setActivityType(defaults.activityType);
    setTeacherId(defaults.teacherId);
    setClassId(defaults.classId);
    setSubjectId(defaults.subjectId);
    setRoomId(defaults.roomId);
    setNotes(defaults.notes);
    setIsTeacherAbsent(defaults.isTeacherAbsent);
    setReplacementTeacherId(defaults.replacementTeacherId);
  }, [
    defaults.activityType,
    defaults.teacherId,
    defaults.classId,
    defaults.subjectId,
    defaults.roomId,
    defaults.notes,
    defaults.isTeacherAbsent,
    defaults.replacementTeacherId,
    open,
  ]);

  const resolvedTeacherId = lockTeacherId ? String(lockTeacherId) : teacherId;
  const resolvedClassId = lockClassId ? String(lockClassId) : classId;
  const resolvedRoomId = lockRoomId ? String(lockRoomId) : roomId;
  const resolvedActivityType = lockActivityType ? lockActivityType : activityType;

  const teacher = useMemo(
    () => teachers.find((t) => t.id === resolvedTeacherId) ?? null,
    [teachers, resolvedTeacherId],
  );
  const replacementOptions = useMemo(
    () => teachers.filter((t) => t.id !== resolvedTeacherId),
    [teachers, resolvedTeacherId],
  );

  const isHa = resolvedActivityType === "HA";

  if (!open) return null;

  const dayLabel = WEEKDAYS.find((w) => w.key === slot.weekday)?.label || String(slot.weekday);
  const periodLabel = slot.period_index ? `${slot.period_index}º` : "—";
  const timeLabel = slot.starts_at && slot.ends_at ? `${String(slot.starts_at).slice(0, 5)}–${String(slot.ends_at).slice(0, 5)}` : "";

  const canSaveAula = Boolean(resolvedTeacherId) && Boolean(resolvedClassId) && Boolean(subjectId);
  const canSaveHa = Boolean(resolvedTeacherId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center print:hidden">
      <div className="w-full max-w-xl max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <h3 className="text-base font-semibold">Editar slot</h3>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {teacher?.name || "Professor"} · {dayLabel} · {periodLabel}{timeLabel ? ` (${timeLabel})` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Tipo</span>
            <select
              value={resolvedActivityType}
              onChange={(e) => {
                const t = normActivityType(e.target.value);
                if (lockActivityType) return;
                setActivityType(t);
                if (t === "HA") {
                  // HA não usa turma/disciplina/sala
                  if (!lockClassId) setClassId("");
                  setSubjectId("");
                  if (!lockRoomId) setRoomId("");
                }
              }}
              disabled={Boolean(lockActivityType)}
              className={
                "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                (lockActivityType
                  ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
              }
            >
              <option value="AULA">Aula</option>
              <option value="HA">Hora Atividade (HA)</option>
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Professor</span>
            <select
              value={resolvedTeacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              disabled={Boolean(lockTeacherId)}
              className={
                "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                (lockTeacherId
                  ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
              }
            >
              <option value="">Selecione...</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {teacherLabel(t)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Turma</span>
            <select
              value={resolvedClassId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={isHa || Boolean(lockClassId)}
              className={
                "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                (isHa || lockClassId
                  ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
              }
            >
              <option value="">Selecione...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.shift ? `(${c.shift})` : ""}
                </option>
              ))}
            </select>
            {isHa ? <span className="text-xs text-zinc-500">HA não utiliza turma/disciplina.</span> : null}
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Disciplina</span>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={isHa}
                className={
                  "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                  (isHa
                    ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                }
              >
                <option value="">—</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Sala</span>
              <select
                value={resolvedRoomId}
                onChange={(e) => setRoomId(e.target.value)}
                disabled={isHa || Boolean(lockRoomId)}
                className={
                  "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                  (isHa || lockRoomId
                    ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                }
              >
                <option value="">—</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={isTeacherAbsent}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setIsTeacherAbsent(checked);
                  if (!checked) setReplacementTeacherId("");
                }}
                className="h-4 w-4 rounded border-zinc-300"
              />
              Marcar falta do professor neste slot
            </label>
            <div className="mt-3 grid gap-2">
              <span className="text-sm font-semibold">Professor substituto</span>
              <select
                value={replacementTeacherId}
                onChange={(e) => {
                  const next = e.target.value;
                  setReplacementTeacherId(next);
                  if (next) setIsTeacherAbsent(true);
                }}
                disabled={!resolvedTeacherId || !isTeacherAbsent}
                className={
                  "h-10 rounded-xl border px-3 text-sm outline-none transition focus:border-zinc-400 dark:focus:border-zinc-600 " +
                  (!resolvedTeacherId || !isTeacherAbsent
                    ? "border-zinc-100 bg-zinc-100 text-zinc-500 dark:border-zinc-900 dark:bg-zinc-900 dark:text-zinc-400"
                    : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950")
                }
              >
                <option value="">Sem substituto definido</option>
                {replacementOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {teacherLabel(t)}
                  </option>
                ))}
              </select>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Use quando o professor titular faltar e outro docente assumir a aula.
              </span>
            </div>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Observações</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                const at = resolvedActivityType;
                if (at === "AULA") {
                  if (!canSaveAula) return;
                } else {
                  if (!canSaveHa) return;
                }

                onSave({
                  scheduleId: scheduleId ?? undefined,
                  teacherId: resolvedTeacherId,
                  timeSlotId: slot.id,
                  activityType: at,
                  classId: at === "AULA" ? resolvedClassId : undefined,
                  subjectId: at === "AULA" ? subjectId : undefined,
                  roomId: at === "AULA" && resolvedRoomId ? resolvedRoomId : null,
                  notes: notes ? notes : null,
                  isTeacherAbsent,
                  replacementTeacherId: isTeacherAbsent && replacementTeacherId ? replacementTeacherId : null,
                });
              }}
              className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Salvar
            </button>

            {scheduleId && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Excluir este item da grade?")) onDelete(scheduleId);
                }}
                className="btn btn-danger"
              >
                Excluir
              </button>
            ) : null}
          </div>

          {resolvedActivityType === "AULA" && (!resolvedTeacherId || !resolvedClassId || !subjectId) ? (
            <div className="text-xs text-zinc-500">Para salvar Aula, selecione Professor, Turma e Disciplina.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
