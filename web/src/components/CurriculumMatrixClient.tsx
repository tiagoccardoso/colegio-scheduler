"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type ClassRow = {
  id: string;
  name: string | null;
  shift: string | null;
};

type SubjectRow = {
  id: string;
  name: string | null;
};

type MatrixRow = {
  id: string;
  class_id: string;
  subject_id: string;
  lessons_per_week: number;
};

function shiftLabel(shift: string | null | undefined) {
  const key = String(shift ?? "").trim().toUpperCase();
  if (key === "MANHA") return "Manhã";
  if (key === "TARDE") return "Tarde";
  if (key === "NOITE") return "Noite";
  return key || "—";
}

export function CurriculumMatrixClient(props: {
  schoolName?: string | null;
  classes: ClassRow[];
  subjects: SubjectRow[];
  initialRows: MatrixRow[];
}) {
  const classById = useMemo(
    () => new Map(props.classes.map((item) => [item.id, item])),
    [props.classes],
  );
  const subjectById = useMemo(
    () => new Map(props.subjects.map((item) => [item.id, item])),
    [props.subjects],
  );

  const [rows, setRows] = useState<MatrixRow[]>(props.initialRows);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [classId, setClassId] = useState(props.classes[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState(props.subjects[0]?.id ?? "");
  const [lessons, setLessons] = useState("1");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const ordered = [...rows].sort((a, b) => {
      const classA = classById.get(a.class_id)?.name ?? "";
      const classB = classById.get(b.class_id)?.name ?? "";
      if (classA !== classB) return classA.localeCompare(classB, "pt-BR");
      const subjectA = subjectById.get(a.subject_id)?.name ?? "";
      const subjectB = subjectById.get(b.subject_id)?.name ?? "";
      return subjectA.localeCompare(subjectB, "pt-BR");
    });
    if (!q) return ordered;
    return ordered.filter((row) => {
      const className = String(classById.get(row.class_id)?.name ?? "").toLowerCase();
      const shift = String(classById.get(row.class_id)?.shift ?? "").toLowerCase();
      const subjectName = String(subjectById.get(row.subject_id)?.name ?? "").toLowerCase();
      return className.includes(q) || shift.includes(q) || subjectName.includes(q);
    });
  }, [classById, filter, rows, subjectById]);

  const stats = useMemo(() => {
    const classesWithMatrix = new Set(rows.map((row) => row.class_id)).size;
    const totalLessons = rows.reduce((sum, row) => sum + Number(row.lessons_per_week || 0), 0);
    return {
      totalRows: rows.length,
      classesWithMatrix,
      totalLessons,
    };
  }, [rows]);

  function resetForm() {
    setEditingId(null);
    setClassId(props.classes[0]?.id ?? "");
    setSubjectId(props.subjects[0]?.id ?? "");
    setLessons("1");
  }

  async function saveRow() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const lessonsPerWeek = Math.max(1, Math.min(40, Number(lessons) || 0));
      const res = await fetch("/api/director/curriculum-matrix", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          class_id: classId,
          subject_id: subjectId,
          lessons_per_week: lessonsPerWeek,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Não foi possível salvar a matriz curricular.");
        return;
      }

      const savedId = String(json?.row?.id ?? editingId ?? "");
      const savedRow: MatrixRow = {
        id: savedId,
        class_id: classId,
        subject_id: subjectId,
        lessons_per_week: lessonsPerWeek,
      };

      setRows((current) => {
        const withoutDuplicate = current.filter(
          (item) => !(item.class_id === classId && item.subject_id === subjectId && item.id !== savedId),
        );
        const idx = withoutDuplicate.findIndex((item) => item.id === savedId);
        if (idx >= 0) {
          const copy = [...withoutDuplicate];
          copy[idx] = savedRow;
          return copy;
        }
        return [savedRow, ...withoutDuplicate];
      });

      setMessage(editingId ? "Matriz curricular atualizada." : "Matriz curricular cadastrada.");
      resetForm();
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao salvar a matriz curricular.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(id: string) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/director/curriculum-matrix", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Não foi possível excluir o item da matriz curricular.");
        return;
      }
      setRows((current) => current.filter((item) => item.id !== id));
      if (editingId === id) resetForm();
      setMessage("Item removido da matriz curricular.");
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao excluir o item da matriz curricular.");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: MatrixRow) {
    setEditingId(row.id);
    setClassId(row.class_id);
    setSubjectId(row.subject_id);
    setLessons(String(row.lessons_per_week));
    setMessage(null);
    setError(null);
  }

  const missingBaseData = props.classes.length === 0 || props.subjects.length === 0;

  return (
    <div className="grid gap-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Matriz curricular por turma</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Cadastre a quantidade de aulas por semana para cada disciplina de cada turma.
              {props.schoolName ? ` Escola: ${props.schoolName}.` : ""} Essa distribuição pode ser feita antes dos professores. Depois, o Solve usa essa matriz para limitar e priorizar a montagem da grade.
            </p>
          </div>
          <Link
            href="/director/parametros-grade"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Ver parâmetros da grade
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Itens cadastrados</div>
            <div className="mt-1 text-2xl font-semibold">{stats.totalRows}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turmas com matriz</div>
            <div className="mt-1 text-2xl font-semibold">{stats.classesWithMatrix}</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Aulas semanais configuradas</div>
            <div className="mt-1 text-2xl font-semibold">{stats.totalLessons}</div>
          </div>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
            {error}
          </div>
        ) : null}

        {missingBaseData ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300">
            Cadastre ao menos uma turma e uma disciplina antes de montar a matriz curricular.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr,1.9fr]">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-sm font-semibold">{editingId ? "Editar item" : "Novo item"}</h3>
              <div className="mt-4 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turma</span>
                  <select
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    {props.classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name ?? "Sem nome"} — {shiftLabel(item.shift)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Disciplina</span>
                  <select
                    value={subjectId}
                    onChange={(e) => setSubjectId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    {props.subjects.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name ?? "Sem nome"}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Aulas por semana</span>
                  <input
                    type="number"
                    min={1}
                    max={40}
                    value={lessons}
                    onChange={(e) => setLessons(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  />
                </label>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={saveRow}
                    disabled={saving || !classId || !subjectId}
                    className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                  >
                    {saving ? "Salvando..." : editingId ? "Salvar alteração" : "Adicionar à matriz"}
                  </button>
                  {editingId ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                    >
                      Cancelar edição
                    </button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold">Itens cadastrados</h3>
                <input
                  type="search"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Filtrar por turma ou disciplina"
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 md:w-72 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Turma</th>
                      <th className="px-3 py-2 font-medium">Turno</th>
                      <th className="px-3 py-2 font-medium">Disciplina</th>
                      <th className="px-3 py-2 font-medium">Aulas/semana</th>
                      <th className="px-3 py-2 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((row) => {
                      const cls = classById.get(row.class_id);
                      const subject = subjectById.get(row.subject_id);
                      return (
                        <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                          <td className="px-3 py-3">{cls?.name ?? row.class_id}</td>
                          <td className="px-3 py-3">{shiftLabel(cls?.shift)}</td>
                          <td className="px-3 py-3">{subject?.name ?? row.subject_id}</td>
                          <td className="px-3 py-3">{row.lessons_per_week}</td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(row)}
                                disabled={saving}
                                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => removeRow(row.id)}
                                disabled={saving}
                                className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 ? (
                      <tr className="border-t border-zinc-100 dark:border-zinc-900">
                        <td colSpan={5} className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                          Nenhum item encontrado.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
