"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_NEM_SETTINGS,
  groupRequirementsByComponentType,
  labelNemComponentType,
  labelNemKnowledgeArea,
} from "@/lib/novo-ensino-medio";

type SubjectOption = {
  id: string;
  name: string | null;
  component_type?: string | null;
  knowledge_area?: string | null;
  is_digital_education?: boolean | null;
  is_project_of_life?: boolean | null;
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

function badgeClass(kind: "base" | "ok" | "warn") {
  if (kind === "ok") {
    return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (kind === "warn") {
    return "inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300";
  }
  return "inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300";
}

export function ClassRequirementsEditor(props: {
  name?: string;
  subjects: SubjectOption[];
  initialValue?: RequirementValue[];
  title?: string;
  description?: string;
}) {
  const firstSubjectId = props.subjects[0]?.id ?? "";
  const subjectById = useMemo(() => new Map(props.subjects.map((subject) => [subject.id, subject])), [props.subjects]);

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

  const normalizedRows = useMemo(() => normalizeRows(rows), [rows]);
  const serialized = useMemo(() => JSON.stringify(normalizedRows), [normalizedRows]);

  const duplicates = useMemo(() => {
    const count = new Map<string, number>();
    for (const row of normalizedRows) {
      count.set(row.subject_id, (count.get(row.subject_id) ?? 0) + 1);
    }
    return new Set(Array.from(count.entries()).filter(([, qty]) => qty > 1).map(([subjectId]) => subjectId));
  }, [normalizedRows]);

  const totalLessons = useMemo(
    () => normalizedRows.reduce((sum, row) => sum + Number(row.lessons_per_week || 0), 0),
    [normalizedRows],
  );

  const grouped = useMemo(
    () =>
      groupRequirementsByComponentType({
        requirements: normalizedRows,
        subjectById: subjectById as any,
        settings: DEFAULT_NEM_SETTINGS,
      }),
    [normalizedRows, subjectById],
  );

  const selectedSubjects = useMemo(
    () => normalizedRows.map((row) => subjectById.get(row.subject_id)).filter(Boolean) as SubjectOption[],
    [normalizedRows, subjectById],
  );

  const hasDigitalEducation = selectedSubjects.some((subject) => Boolean(subject.is_digital_education));
  const hasProjectOfLife = selectedSubjects.some((subject) => Boolean(subject.is_project_of_life));

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
        <div className="text-sm font-semibold">{props.title ?? "Componentes da turma"}</div>
        <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
          {props.description ??
            "Informe quais componentes a turma terá na semana. O editor já resume FGB, itinerário, técnico, educação digital e Projeto de Vida."}
        </p>
      </div>

      {props.subjects.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
          Cadastre os componentes primeiro para vinculá-los à turma.
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            {rows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-300 px-3 py-3 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                Nenhum componente vinculado ainda.
              </div>
            ) : null}

            {rows.map((row, index) => {
              const duplicate = duplicates.has(row.subject_id);
              const subject = subjectById.get(row.subject_id);
              return (
                <div
                  key={row.key}
                  className="grid gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950 md:grid-cols-[1.6fr,0.7fr,auto]"
                >
                  <label className="grid gap-1">
                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Componente {index + 1}</span>
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
                    {subject ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <span className={badgeClass("base")}>{labelNemComponentType(subject.component_type)}</span>
                        {subject.knowledge_area ? <span className={badgeClass("base")}>{labelNemKnowledgeArea(subject.knowledge_area)}</span> : null}
                        {subject.is_digital_education ? <span className={badgeClass("ok")}>Educação digital</span> : null}
                        {subject.is_project_of_life ? <span className={badgeClass("ok")}>Projeto de Vida</span> : null}
                      </div>
                    ) : null}
                    {duplicate ? (
                      <span className="text-[11px] text-rose-600 dark:text-rose-300">
                        Este componente está repetido. Deixe apenas uma linha para ele.
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

          <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={addRow}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Adicionar componente
              </button>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                {rows.length} componente(s) • {totalLessons} aula(s) semanais
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.4fr,1fr]">
              <div className="grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Resumo por tipo</div>
                <div className="flex flex-wrap gap-2">
                  {grouped.length ? (
                    grouped.map((item) => (
                      <span key={item.key} className={badgeClass(item.key === "SEM_CLASSIFICACAO" ? "warn" : "base")}>
                        {item.label}: {item.lessonsPerWeek} aula(s)
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Ainda sem componentes.</span>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sinais rápidos</div>
                <div className="flex flex-wrap gap-2">
                  <span className={badgeClass(hasDigitalEducation ? "ok" : "warn")}>
                    {hasDigitalEducation ? "Educação digital presente" : "Sem educação digital"}
                  </span>
                  <span className={badgeClass(hasProjectOfLife ? "ok" : "warn")}>
                    {hasProjectOfLife ? "Projeto de Vida presente" : "Sem Projeto de Vida"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
