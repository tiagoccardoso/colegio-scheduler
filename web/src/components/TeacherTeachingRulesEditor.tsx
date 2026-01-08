"use client";

import { useMemo, useState } from "react";
import type { TeachingRule } from "@/lib/schedule/teaching-rules";
import { normalizeShift, type Shift } from "@/lib/schedule/rules";

type Opt = { id: string; name: string | null };
type ClassOpt = { id: string; name: string | null; shift?: string | null };

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
];

const SHIFT_OPTIONS: { key: Shift; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

function periodsForShift(shift: Shift) {
  return shift === "NOITE" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6];
}

function makeEmptyRule(): TeachingRule {
  return {
    subject_id: "",
    room_id: "",
    class_id: "",
    shift: "MANHA",
    period_index: 1,
    weekdays: [1, 2, 3, 4, 5],
  };
}

export function TeacherTeachingRulesEditor({
  subjects,
  rooms,
  classes,
  initialRules,
  inputName = "teaching_rules_json",
}: {
  subjects: Opt[];
  rooms: Opt[];
  classes: ClassOpt[];
  initialRules?: TeachingRule[] | null;
  inputName?: string;
}) {
  const [rules, setRules] = useState<TeachingRule[]>(() => {
    const base = Array.isArray(initialRules) ? initialRules : [];
    return base.map((r) => ({
      subject_id: String((r as any).subject_id ?? "").trim(),
      room_id: (r as any).room_id ? String((r as any).room_id) : "",
      class_id: (r as any).class_id ? String((r as any).class_id) : "",
      shift: normalizeShift((r as any).shift) as Shift,
      period_index: Number((r as any).period_index) || 1,
      weekdays: Array.isArray((r as any).weekdays) ? (r as any).weekdays : [1, 2, 3, 4, 5],
    }));
  });

  const serialized = useMemo(() => JSON.stringify(rules), [rules]);

  function updateRule(idx: number, patch: Partial<TeachingRule>) {
    setRules((prev) => prev.map((r, i) => (i === idx ? ({ ...r, ...patch } as TeachingRule) : r)));
  }

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
      <legend className="px-2 text-sm font-semibold">Habilitações por horário</legend>

      <div className="grid gap-1">
        <span className="text-xs text-zinc-500">
          Cadastre as habilitações do professor por combinação de disciplina + sala + turno + período + turma.
        </span>
      </div>

      <input type="hidden" name={inputName} value={serialized} readOnly />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRules((prev) => [...prev, makeEmptyRule()])}
          className="h-9 rounded-xl bg-zinc-900 px-3 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + Incluir
        </button>
        <button
          type="button"
          onClick={() => setRules([])}
          className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Limpar
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
          Nenhuma habilitação cadastrada.
        </div>
      ) : null}

      {rules.map((r, idx) => {
        const shift = normalizeShift(r.shift) as Shift;
        const periodOptions = periodsForShift(shift);
        const wd = Array.isArray(r.weekdays) ? r.weekdays : [1, 2, 3, 4, 5];

        return (
          <div
            key={idx}
            className="grid gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Disciplina</span>
                <select
                  value={r.subject_id ?? ""}
                  onChange={(e) => updateRule(idx, { subject_id: e.target.value })}
                  required
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="" disabled>Selecione…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? "(sem nome)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Sala</span>
                <select
                  value={r.room_id ?? ""}
                  onChange={(e) => updateRule(idx, { room_id: e.target.value })}
                  required
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="" disabled>Selecione…</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name ?? "(sem nome)"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Turma</span>
                <select
                  value={r.class_id ?? ""}
                  onChange={(e) => updateRule(idx, { class_id: e.target.value })}
                  required
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  <option value="" disabled>Selecione…</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name ?? "(sem nome)"} {c.shift ? `(${c.shift})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Turno</span>
                <select
                  value={shift}
                  onChange={(e) => {
                    const s = normalizeShift(e.target.value) as Shift;
                    const periods = periodsForShift(s);
                    updateRule(idx, {
                      shift: s,
                      period_index: periods.includes(Number(r.period_index)) ? r.period_index : periods[0],
                    });
                  }}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  {SHIFT_OPTIONS.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Período</span>
                <select
                  value={String(r.period_index ?? 1)}
                  onChange={(e) => updateRule(idx, { period_index: Number(e.target.value) })}
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                >
                  {periodOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}º
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-semibold">Dias</span>
                {WEEKDAYS.map((d) => {
                  const checked = wd.includes(d.key);
                  return (
                    <label key={d.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked ? [...wd, d.key] : wd.filter((x) => x !== d.key);
                          updateRule(idx, { weekdays: next.sort((a, b) => a - b) });
                        }}
                        className="h-4 w-4"
                      />
                      <span>{d.label}</span>
                    </label>
                  );
                })}
                <span className="text-xs text-zinc-500">(vazio = Seg–Sex)</span>
              </div>

              <button
                type="button"
                onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Remover
              </button>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
