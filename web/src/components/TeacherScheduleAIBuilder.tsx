"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TeacherRow = {
  id: string;
  name: string | null;
  restrictions: string | null; // exibido como "Critérios"
  teaching_rules: any | null;
  default_room_id: string | null;
};

type RefRow = { id: string; name: string | null; shift?: string | null; default_room_id?: string | null };

type TimeSlotRow = {
  id: string;
  weekday: number;
  starts_at: string;
  ends_at: string;
  shift: string | null;
  period_index: number | null;
};

type Shift = "MANHA" | "TARDE" | "NOITE";

type TeachingRule = {
  subject_id: string;
  room_id: string;
  class_id: string;
  shift: Shift;
  period_index: number;
  weekdays: number[]; // vamos usar 1 elemento (1..5)
};

const WEEKDAYS: { key: number; label: string }[] = [
  { key: 1, label: "Seg" },
  { key: 2, label: "Ter" },
  { key: 3, label: "Qua" },
  { key: 4, label: "Qui" },
  { key: 5, label: "Sex" },
];

function normalizeShift(v: any): Shift | null {
  const key = String(v ?? "").trim().toUpperCase();
  if (!key) return null;
  if (key.startsWith("MAN")) return "MANHA";
  if (key.startsWith("TAR")) return "TARDE";
  if (key.startsWith("NOI")) return "NOITE";
  return (["MANHA", "TARDE", "NOITE"] as any).includes(key) ? (key as Shift) : null;
}

function ruleKey(r: Pick<TeachingRule, "shift" | "period_index" | "weekdays">) {
  const wd = Array.isArray(r.weekdays) && r.weekdays.length ? Number(r.weekdays[0]) : NaN;
  return `${r.shift}:${r.period_index}:${wd}`;
}

function keyFromCell(shift: Shift, period_index: number, weekday: number) {
  return `${shift}:${period_index}:${weekday}`;
}

export function TeacherScheduleAIBuilder(props: {
  enabled: boolean;
  teacher: TeacherRow;
  subjects: RefRow[];
  rooms: RefRow[];
  classes: RefRow[];
  timeSlots: TimeSlotRow[];
}) {
  const { enabled, teacher, subjects, rooms, classes, timeSlots } = props;
  const router = useRouter();

  const [criteria, setCriteria] = useState<string>(teacher.restrictions ?? "");
  const [rules, setRules] = useState<TeachingRule[]>(() => {
    const raw = teacher.teaching_rules;
    if (!Array.isArray(raw)) return [];
    const out: TeachingRule[] = [];
    for (const item of raw) {
      const shift = normalizeShift((item as any)?.shift);
      const period_index = Number((item as any)?.period_index);
      const weekdays = Array.isArray((item as any)?.weekdays) ? (item as any).weekdays.map((n: any) => Number(n)).filter((n: number) => n >= 1 && n <= 5) : [];
      const subject_id = String((item as any)?.subject_id ?? "").trim();
      const class_id = String((item as any)?.class_id ?? "").trim();
      const room_id = String((item as any)?.room_id ?? "").trim();
      if (!shift || !Number.isFinite(period_index) || period_index < 1 || period_index > 6) continue;
      if (!weekdays.length) continue;
      if (!subject_id || !class_id || !room_id) continue;
      out.push({ shift, period_index, weekdays: [weekdays[0]], subject_id, class_id, room_id });
    }
    return out;
  });

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name ?? s.id])), [subjects]);
  const roomById = useMemo(() => new Map(rooms.map((r) => [r.id, r.name ?? r.id])), [rooms]);
  const classById = useMemo(() => new Map(classes.map((c) => [c.id, c.name ?? c.id])), [classes]);

  const periodsByShift = useMemo(() => {
    const map = new Map<Shift, number[]>();
    for (const ts of timeSlots) {
      const shift = normalizeShift(ts.shift);
      const p = ts.period_index == null ? null : Number(ts.period_index);
      if (!shift || !p || !Number.isFinite(p)) continue;
      map.set(shift, Array.from(new Set([...(map.get(shift) ?? []), p])).sort((a, b) => a - b));
    }
    // fallback padrão caso time_slots não tenha period_index
    (["MANHA", "TARDE", "NOITE"] as Shift[]).forEach((s) => {
      if (!map.get(s)?.length) map.set(s, s === "NOITE" ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6]);
    });
    return map;
  }, [timeSlots]);

  const [selected, setSelected] = useState<{ shift: Shift; period_index: number; weekday: number } | null>(null);
  const selectedRule = useMemo(() => {
    if (!selected) return null;
    const key = keyFromCell(selected.shift, selected.period_index, selected.weekday);
    return rules.find((r) => ruleKey(r) === key) ?? null;
  }, [selected, rules]);

  const [editClassId, setEditClassId] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [editRoomId, setEditRoomId] = useState("");

  function openCell(shift: Shift, period_index: number, weekday: number) {
    setSelected({ shift, period_index, weekday });
    const key = keyFromCell(shift, period_index, weekday);
    const existing = rules.find((r) => ruleKey(r) === key);
    setEditClassId(existing?.class_id ?? "");
    setEditSubjectId(existing?.subject_id ?? "");
    setEditRoomId(existing?.room_id ?? (teacher.default_room_id ?? ""));
  }

  function applyCell() {
    if (!selected) return;
    const { shift, period_index, weekday } = selected;

    if (!editClassId || !editSubjectId || !editRoomId) return;

    const key = keyFromCell(shift, period_index, weekday);
    const next: TeachingRule = {
      shift,
      period_index,
      weekdays: [weekday],
      class_id: editClassId,
      subject_id: editSubjectId,
      room_id: editRoomId,
    };

    setRules((prev) => {
      const idx = prev.findIndex((r) => ruleKey(r) === key);
      if (idx >= 0) return prev.map((r, i) => (i === idx ? next : r));
      return [...prev, next];
    });
  }

  function clearCell() {
    if (!selected) return;
    const { shift, period_index, weekday } = selected;
    const key = keyFromCell(shift, period_index, weekday);
    setRules((prev) => prev.filter((r) => ruleKey(r) !== key));
  }

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [questions, setQuestions] = useState<string[]>([]);

  async function generatePreview() {
    setLoading(true);
    setError(null);
    setSummary(null);
    setWarnings([]);
    setQuestions([]);

    try {
      const res = await fetch("/api/ai/teacher-schedule/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.id, criteria }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erro ao gerar horários.");
        return;
      }
      setRules(Array.isArray(json?.teaching_rules) ? json.teaching_rules : []);
      setSummary(json?.summary ?? null);
      setWarnings(Array.isArray(json?.warnings) ? json.warnings : []);
      setQuestions(Array.isArray(json?.questions) ? json.questions : []);
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  // Chat simples: manda o estado atual e um comando do usuário, recebe regras atualizadas.
  const [chatInput, setChatInput] = useState("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; content: string }[]>([]);

  async function sendChat() {
    const message = chatInput.trim();
    if (!message) return;

    setChatInput("");
    setChatLog((prev) => [...prev, { role: "user", content: message }]);
    setError(null);

    try {
      const res = await fetch("/api/ai/teacher-schedule/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.id, criteria, teaching_rules: rules, message, chatLog }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erro ao conversar com a IA.");
        return;
      }
      if (Array.isArray(json?.teaching_rules)) setRules(json.teaching_rules);
      if (typeof json?.assistant === "string" && json.assistant.trim()) {
        setChatLog((prev) => [...prev, { role: "assistant", content: json.assistant }]);
      } else {
        setChatLog((prev) => [...prev, { role: "assistant", content: "Ok — atualizei a grade." }]);
      }
      setWarnings(Array.isArray(json?.warnings) ? json.warnings : []);
      setQuestions(Array.isArray(json?.questions) ? json.questions : []);
      setSummary(json?.summary ?? null);
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/teacher-schedule/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacherId: teacher.id, criteria, teaching_rules: rules }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error ?? "Erro ao salvar.");
        return;
      }
      // Volta para a lista e abre o professor
      router.push(`/teachers?msg=${encodeURIComponent(json?.msg ?? "Horários salvos.")}&focus=${encodeURIComponent(teacher.id)}`);
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Erro inesperado.");
    } finally {
      setSaving(false);
    }
  }

  if (!enabled) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold">IA desabilitada</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Para habilitar, defina <code className="px-1">AI_SCHEDULER_ENABLED=true</code> e <code className="px-1">OPENAI_API_KEY</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">{teacher.name ?? "Professor"}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Escreva os <b>Critérios</b> em texto livre. A IA transforma isso em uma proposta de horários (por dia/turno/período) e você pode ajustar antes de salvar.
            </p>
          </div>

          <button
            type="button"
            onClick={generatePreview}
            disabled={loading || !criteria.trim()}
            className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {loading ? "Gerando..." : "Gerar com IA"}
          </button>
        </div>

        <label className="mt-4 grid gap-2">
          <span className="text-sm font-semibold">Critérios</span>
          <textarea
            rows={4}
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            placeholder="Ex.: 10 aulas de Matemática. Só posso Seg, Ter e Qua. Preferir 5º e 6º período da manhã. Turmas A e B."
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
          />
        </label>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        {summary ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-200">{summary}</p> : null}

        {questions.length ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="font-semibold">Pendências</p>
            <ul className="mt-2 list-disc pl-5">
              {questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {warnings.length ? (
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-700 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
            <p className="font-semibold">Avisos</p>
            <ul className="mt-2 list-disc pl-5">
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Proposta de horários</h3>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-emerald-500 dark:bg-emerald-500 dark:hover:bg-emerald-400"
            >
              {saving ? "Salvando..." : "Salvar no cadastro"}
            </button>
          </div>

          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Clique em uma célula para editar. Para salvar, a grade precisa ter disciplina, turma e sala em cada aula inserida.
          </p>

          <div className="mt-4 grid gap-6">
            {(Array.from(periodsByShift.entries()) as [Shift, number[]][]).map(([shift, periods]) => (
              <div key={shift} className="grid gap-2">
                <h4 className="text-sm font-semibold">
                  {shift === "MANHA" ? "Manhã" : shift === "TARDE" ? "Tarde" : "Noite"}
                </h4>

                <div className="overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="min-w-[720px] w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900/40">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                          Período
                        </th>
                        {WEEKDAYS.map((d) => (
                          <th
                            key={d.key}
                            className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                          >
                            {d.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map((p) => (
                        <tr key={p} className="border-t border-zinc-100 dark:border-zinc-900">
                          <td className="px-3 py-2 font-semibold text-zinc-700 dark:text-zinc-200">{p}º</td>
                          {WEEKDAYS.map((d) => {
                            const key = keyFromCell(shift, p, d.key);
                            const r = rules.find((x) => ruleKey(x) === key) ?? null;
                            const label = r
                              ? `${classById.get(r.class_id) ?? r.class_id} — ${subjectById.get(r.subject_id) ?? r.subject_id}${r.room_id ? ` (${roomById.get(r.room_id) ?? r.room_id})` : ""}`
                              : "—";
                            return (
                              <td
                                key={d.key}
                                className="px-3 py-2 align-top cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                                onClick={() => openCell(shift, p, d.key)}
                                role="button"
                                title="Clique para editar"
                              >
                                <div className={r ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400"}>{label}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold">Editor</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Selecione uma célula na grade para preencher/ajustar.
            </p>

            {selected ? (
              <div className="mt-4 grid gap-3">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-200">
                  <b>
                    {(WEEKDAYS.find((d) => d.key === selected.weekday)?.label ?? "Dia")} •{" "}
                    {selected.shift === "MANHA" ? "Manhã" : selected.shift === "TARDE" ? "Tarde" : "Noite"} • {selected.period_index}º período
                  </b>
                  {selectedRule ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Já possui uma aula. Você pode editar ou remover.</div> : null}
                </div>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Turma</span>
                  <select
                    value={editClassId}
                    onChange={(e) => setEditClassId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    <option value="">Selecione…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name ?? c.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Disciplina</span>
                  <select
                    value={editSubjectId}
                    onChange={(e) => setEditSubjectId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    <option value="">Selecione…</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name ?? s.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Sala</span>
                  <select
                    value={editRoomId}
                    onChange={(e) => setEditRoomId(e.target.value)}
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    <option value="">Selecione…</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name ?? r.id}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyCell}
                    disabled={!editClassId || !editSubjectId || !editRoomId}
                    className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    Aplicar
                  </button>
                  <button type="button" onClick={clearCell} className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900">
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                Nenhuma célula selecionada.
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <h3 className="text-sm font-semibold">Converse com a IA</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Use comandos do tipo: “mova a Turma B para terça 6º período”, “evite sexta”, “distribua 10 aulas de Matemática”.
            </p>

            <div className="mt-3 max-h-56 overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
              {chatLog.length === 0 ? (
                <div className="text-zinc-500 dark:text-zinc-400">Sem mensagens ainda.</div>
              ) : (
                <div className="grid gap-2">
                  {chatLog.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-200"}>
                      <span className="font-semibold">{m.role === "user" ? "Você" : "IA"}:</span> {m.content}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite uma instrução…"
                className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
              <button
                type="button"
                onClick={sendChat}
                disabled={!chatInput.trim()}
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white disabled:opacity-60 hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
