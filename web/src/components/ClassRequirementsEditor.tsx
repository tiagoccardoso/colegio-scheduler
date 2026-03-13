"use client";

import { useEffect, useMemo, useState } from "react";

type SubjectOption = {
  id: string;
  name: string | null;
};

type RequirementValue = {
  subject_id: string;
  lessons_per_week: number;
};

type RequirementRow = {
  key: string;
  subject_id: string;
  lessons_per_week: string;
};

function makeKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeRows(rows: RequirementRow[]) {
  return rows
    .map((row) => ({
      subject_id: String(row.subject_id ?? "").trim(),
      lessons_per_week: Math.max(1, Math.min(40, Number(row.lessons_per_week ?? 0) || 0)),
    }))
    .filter((row) => row.subject_id);
}

export function ClassRequirementsEditor(props: {
  name?: string;
  subjects: SubjectOption[];
  initialValue?: RequirementValue[];
  title?: string;
  description?: string;
}) {
  const firstSubjectId = props.subjects[0]?.id ?? "";

  const [rows, setRows] = useState<RequirementRow[]>(() => {
    const initial = (props.initialValue ?? [])
      .map((item) => ({
        key: makeKey(),
        subject_id: String(item.subject_id ?? "").trim(),
        lessons_per_week: String(Math.max(1, Math.min(40, Number(item.lessons_per_week ?? 1) || 1))),
      }))
      .filter((item) => item.subject_id);

    return initial;
  });

  useEffect(() => {
    const next = (props.initialValue ?? [])
      .map((item) => ({
        key: makeKey(),
        subject_id: String(item.subject_id ?? "").trim(),
        lessons_per_week: String(Math.max(1, Math.min(40, Number(item.lessons_per_week ?? 1) || 1))),
      }))
      .filter((item) => item.subject_id);
    setRows(next);
  }, [props.initialValue]);

  const serialized = useMemo(() => JSON.stringify(normalizeRows(rows)), [rows]);

  const duplicates = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of normalizeRows(rows)) {
      count.set(row.subject_id, (count.get(row.subject_id) ?? 0) + 1);
    }
    return new Set(Array.from(count.entries()).filter(([, qty]) => qty > 1).map(([subjectId]) => subjectId));
  }, [rows]);

  const totalLessons = useMemo(
    () => normalizeRows(rows).reduce((sum, row) => sum + Number(row.lessons_per_week || 0), 0),
    [rows],
  );

  function addRow() {
    const used = new Set(rows.map((row) => row.subject_id).filter(Boolean));
    const nextSubjectId = props.subjects.find((subject) => !used.has(subject.id))?.id ?? firstSubjectId;
    setRows((current) => [
      ...current,
      {
        key: makeKey(),
        subject_id: nextSubjectId,
        lessons_per_week: "1",
      },
    ]);
  }

  function updateRow(key: string, patch: Partial<RequirementRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  return (
    <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <input type="hidden" name={props.name ?? "requirements_json"} value={serialized} />

      <div>
        <div className="text-sm font-semibold">{props.title ?? "Disciplinas da turma"}</div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {props.description ?? "Informe quais disciplinas a turma terá na semana e quantas aulas cada uma recebe."}
        </p>
      </div>

      {props.subjects.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Cadastre as disciplinas primeiro para vinculá-las à turma.
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Nenhuma disciplina vinculada ainda.
              </div>
            ) : null}

            {rows.map((row, index) => {
              const duplicate = duplicates.has(row.subject_id);
              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[1.4fr,0.7fr,auto]"
                >
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Disciplina {index + 1}</span>
                    <select
                      value={row.subject_id}
                      onChange={(e) => updateRow(row.key, { subject_id: e.target.value })}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                    >
                      <option value="">Selecione</option>
                      {props.subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name ?? "Sem nome"}
                        </option>
                      ))}
                    </select>
                    {duplicate ? (
                      <span className="text-[11px] text-rose-600 dark:text-rose-300">
                        Esta disciplina está repetida. Deixe apenas uma linha para ela.
                      </span>
                    ) : null}
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Aulas/semana</span>
                    <input
                      type="number"
                      min={1}
                      max={40}
                      value={row.lessons_per_week}
                      onChange={(e) => updateRow(row.key, { lessons_per_week: e.target.value })}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                    />
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      className="h-10 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addRow}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              Adicionar disciplina
            </button>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              {rows.length} disciplina(s) • {totalLessons} aula(s) semanais
            </div>
          </div>
        </>
      )}
    </div>
  );
}
