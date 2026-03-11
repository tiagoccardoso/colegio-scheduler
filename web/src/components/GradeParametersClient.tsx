"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GradeSolverSettings } from "@/lib/schedule/solver-settings";

type SolveResp = {
  ok?: boolean;
  summary?: string;
  applied?: number;
  skipped?: number;
  warnings?: string[];
  conflicts?: { total?: number; teacher?: number; class?: number; room?: number; preview?: string[] };
  error?: string;
};

export function GradeParametersClient(props: {
  initialSettings: GradeSolverSettings;
  schoolName?: string | null;
  status?: {
    matrixEntries: number;
    classesWithMatrix: number;
    classesWithDefaultRoom: number;
    teachersWithDefaultRoom: number;
  };
}) {
  const [settings, setSettings] = useState<GradeSolverSettings>(props.initialSettings);
  const [saving, setSaving] = useState(false);
  const [solving, setSolving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solveShift, setSolveShift] = useState("MANHA");
  const [overwrite, setOverwrite] = useState(false);
  const [solveResult, setSolveResult] = useState<SolveResp | null>(null);

  const numericFields = useMemo(
    () => [
      {
        key: "prefer_consecutive_weight" as const,
        label: "Peso para blocos consecutivos",
        help: "Aumenta a chance de manter a mesma disciplina em períodos seguidos quando fizer sentido.",
      },
      {
        key: "compact_teacher_days_weight" as const,
        label: "Peso para compactar o dia do professor",
        help: "Prefere concentrar aulas do professor no mesmo dia em vez de espalhar demais.",
      },
      {
        key: "reduce_teacher_gaps_weight" as const,
        label: "Peso para reduzir janelas do professor",
        help: "Tenta evitar horários soltos entre aulas do mesmo professor.",
      },
      {
        key: "avoid_last_period_penalty" as const,
        label: "Penalidade para último horário",
        help: "Reduz a chance de alocar aula no último período do turno.",
      },
      {
        key: "spread_subjects_weight" as const,
        label: "Peso para espalhar disciplinas na semana",
        help: "Evita concentrar a mesma disciplina no mesmo dia quando houver alternativas.",
      },
    ],
    [],
  );

  function setNum<K extends keyof GradeSolverSettings>(key: K, value: string) {
    const n = Number(value);
    setSettings((curr) => ({
      ...curr,
      [key]: Number.isFinite(n) ? Math.max(0, Math.min(50, Math.round(n))) : 0,
    }));
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/director/grade-parameters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Falha ao salvar parâmetros.");
        return;
      }
      setSettings(json.settings ?? settings);
      setMessage("Parâmetros salvos com sucesso.");
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao salvar parâmetros.");
    } finally {
      setSaving(false);
    }
  }

  async function runSolve() {
    setSolving(true);
    setMessage(null);
    setError(null);
    setSolveResult(null);
    try {
      const saveRes = await fetch("/api/director/grade-parameters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const saveJson = await saveRes.json();
      if (!saveRes.ok) {
        setError(saveJson?.error || "Falha ao salvar parâmetros antes do Solve.");
        return;
      }
      const res = await fetch("/api/ai/build-global-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift: solveShift, overwrite }),
      });
      const json = (await res.json()) as SolveResp;
      if (!res.ok) {
        setError(json?.error || "Falha ao executar o Solve.");
        return;
      }
      setSolveResult(json);
      setMessage(json?.summary || "Solve executado com sucesso.");
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao executar o Solve.");
    } finally {
      setSolving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Link
          href="/director/matriz-curricular"
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Matriz curricular</div>
          <div className="mt-1 text-2xl font-semibold">{props.status?.matrixEntries ?? 0}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{props.status?.classesWithMatrix ?? 0} turma(s) com matriz cadastrada</div>
        </Link>

        <Link
          href="/director/sala-padrao"
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sala padrão — turmas</div>
          <div className="mt-1 text-2xl font-semibold">{props.status?.classesWithDefaultRoom ?? 0}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">turma(s) com sala-base definida</div>
        </Link>

        <Link
          href="/director/sala-padrao"
          className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
        >
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Sala padrão — professores</div>
          <div className="mt-1 text-2xl font-semibold">{props.status?.teachersWithDefaultRoom ?? 0}</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">professor(es) com preferência de sala</div>
        </Link>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Efeito na grade</div>
          <div className="mt-1 text-sm font-medium">Matriz + salas padrão</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Os cadastros abaixo alimentam as heurísticas do Solve.</div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Parâmetros do Solve</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Ajuste o peso das heurísticas que orientam a montagem automática da grade.
              {props.schoolName ? ` Escola: ${props.schoolName}.` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || solving}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              {saving ? "Salvando..." : "Salvar parâmetros"}
            </button>
            <button
              type="button"
              onClick={runSolve}
              disabled={saving || solving}
              className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
            >
              {solving ? "Executando..." : "Executar Solve"}
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {numericFields.map((field) => (
            <label key={field.key} className="grid gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <span className="text-sm font-semibold">{field.label}</span>
              <input
                type="number"
                min={0}
                max={50}
                value={settings[field.key]}
                onChange={(e) => setNum(field.key, e.target.value)}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{field.help}</span>
            </label>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <input
              type="checkbox"
              checked={settings.respect_requirements}
              onChange={(e) =>
                setSettings((curr) => ({ ...curr, respect_requirements: e.target.checked }))
              }
              className="h-4 w-4"
            />
            <span>
              <strong>Respeitar matriz curricular</strong>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Limita o Solve a não ultrapassar a carga semanal da disciplina quando houver matriz cadastrada.
              </span>
            </span>
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <input
              type="checkbox"
              checked={settings.prioritize_default_room}
              onChange={(e) =>
                setSettings((curr) => ({ ...curr, prioritize_default_room: e.target.checked }))
              }
              className="h-4 w-4"
            />
            <span>
              <strong>Priorizar sala padrão</strong>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Dá bônus às regras que utilizam a sala padrão da turma e/ou do docente, quando disponível.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div className="panel p-5">
        <h3 className="text-sm font-semibold">Execução do Solve</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          O Solve usa as habilitações por horário dos professores e aplica heurísticas configuradas acima para montar a grade do turno.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-[220px,1fr]">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Turno</span>
            <select
              value={solveShift}
              onChange={(e) => setSolveShift(e.target.value)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
            >
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
            </select>
          </label>

          <label className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <input
              type="checkbox"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
              className="h-4 w-4"
            />
            <span>
              <strong>Sobrescrever aulas existentes</strong>
              <span className="mt-1 block text-xs text-zinc-500 dark:text-zinc-400">
                Mantém HA e reconstrói as aulas do turno com base nas regras atuais.
              </span>
            </span>
          </label>
        </div>

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </div>
        ) : null}

        {solveResult ? (
          <div className="mt-4 grid gap-3">
            <div className="grid gap-3 md:grid-cols-4">
              <Stat label="Aplicadas" value={Number(solveResult.applied ?? 0)} />
              <Stat label="Ignoradas" value={Number(solveResult.skipped ?? 0)} />
              <Stat label="Conflitos" value={Number(solveResult.conflicts?.total ?? 0)} />
              <Stat label="Turno" value={solveShift} />
            </div>

            {(solveResult.warnings ?? []).length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
                <div className="font-semibold">Avisos</div>
                <ul className="mt-2 list-disc pl-5">
                  {(solveResult.warnings ?? []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {(solveResult.conflicts?.preview ?? []).length ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="font-semibold">Prévia dos conflitos pulados</div>
                <ul className="mt-2 list-disc pl-5 text-zinc-700 dark:text-zinc-300">
                  {(solveResult.conflicts?.preview ?? []).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{props.label}</div>
      <div className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{props.value}</div>
    </div>
  );
}
