"use client";

import { useState } from "react";

export function ScheduleAutoBuilder(props: { enabled: boolean; classId: string; shift?: string | null }) {
  const { enabled, classId, shift } = props;

  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ai/build-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, overwrite, shift }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erro ao gerar a grade.");
        return;
      }

      setResult(json);
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold">Gerar grade com IA</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Para habilitar, defina <code className="px-1">AI_SCHEDULER_ENABLED=true</code> e <code className="px-1">OPENAI_API_KEY</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Gerar grade com IA</h3>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Preenche automaticamente os horários da turma (respeitando conflitos e as restrições do professor). Se houver matriz curricular cadastrada, respeita a carga semanal por disciplina.
          </p>
        </div>

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? "Gerando..." : "Gerar"}
        </button>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} className="h-4 w-4" />
        <span>Sobrescrever aulas já existentes nesta turma</span>
      </label>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {result?.summary ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">{result.summary}</p> : null}

      {result?.applied ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200">
          {result.applied} aula(s) aplicadas.
        </div>
      ) : null}

      {(result?.skipped ?? []).length ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-semibold">Itens não aplicados</p>
          <ul className="mt-2 list-disc pl-5">
            {(result.skipped ?? []).map((s: any, i: number) => (
              <li key={i}>{s?.reason ?? "Ignorado"}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {(result?.warnings ?? []).length ? (
        <div className="mt-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
          <p className="font-semibold">Avisos</p>
          <ul className="mt-2 list-disc pl-5">
            {(result.warnings ?? []).map((w: string, i: number) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result?.ok ? (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Recarregar grade
        </button>
      ) : null}
    </div>
  );
}
