"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ConflictKind = "teacher" | "room" | "class" | "slot";

type ConflictRow = {
  id: string;
  kind: ConflictKind;
  shift: string;
  weekday: number;
  period_index: number;
  slot: { id: string; label: string; starts_at: string | null; ends_at: string | null } | null;
  message: string;
  requested: {
    teacherId: string | null;
    teacherName: string;
    classId: string | null;
    className: string | null;
    subjectId?: string | null;
    subjectName: string | null;
    roomId?: string | null;
    roomName: string | null;
    ruleIndex?: number | null;
  };
  blockedBy: {
    source: "existing" | "planned";
    activityType: "AULA" | "HA";
    teacherId: string | null;
    teacherName: string;
    classId: string | null;
    className: string | null;
    subjectId?: string | null;
    subjectName: string | null;
    roomId?: string | null;
    roomName: string | null;
    scheduleId?: string | null;
  } | null;
};

type ConflictsResp = {
  ok: boolean;
  shift: string;
  counts: { total: number; teacher: number; room: number; class: number; slot: number };
  conflicts: ConflictRow[];
  error?: string;
};

function normShift(v: string | null | undefined) {
  const k = String(v || "").trim().toUpperCase();
  if (k.startsWith("MAN")) return "MANHA";
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return "MANHA";
}

function kindLabel(kind: ConflictKind) {
  if (kind === "teacher") return "Professor";
  if (kind === "room") return "Sala";
  if (kind === "class") return "Turma";
  return "Horário";
}

function weekdayShort(wd: number) {
  const n = Number(wd);
  if (n === 1) return "Seg";
  if (n === 2) return "Ter";
  if (n === 3) return "Qua";
  if (n === 4) return "Qui";
  if (n === 5) return "Sex";
  return "Dia";
}

function weekdayLong(wd: number) {
  const n = Number(wd);
  if (n === 1) return "Segunda";
  if (n === 2) return "Terça";
  if (n === 3) return "Quarta";
  if (n === 4) return "Quinta";
  if (n === 5) return "Sexta";
  if (n === 6) return "Sábado";
  if (n === 7) return "Domingo";
  return "Dia";
}

function slotFallbackLabel(weekday: number, periodIndex: number) {
  const p = Number(periodIndex);
  return `${weekdayShort(weekday)} ${p ? `${p}º` : ""}`.trim();
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function actionKey(a: any) {
  const t = safeStr(a?.type);
  const tid = safeStr(a?.teacher_id);
  const m = a?.match ?? {};
  const to = a?.to ?? {};
  return `${t}|${tid}|${safeStr(m?.class_id)}|${safeStr(m?.subject_id)}|${safeStr(m?.room_id)}|${safeStr(m?.shift)}|${Number(m?.weekday) || 0}|${Number(m?.period_index) || 0}|${Number(to?.weekday) || 0}|${Number(to?.period_index) || 0}`;
}

function dedupForApplyAll(actions: any[]): any[] {
  const out: any[] = [];
  const seenMatch = new Set<string>();
  const seenFull = new Set<string>();
  for (const a of actions || []) {
    const type = safeStr(a?.type);
    if (!type || type === "note") continue;
    const tid = safeStr(a?.teacher_id);
    const m = a?.match ?? {};
    const matchKey = `${type}|${tid}|${safeStr(m?.class_id)}|${safeStr(m?.subject_id)}|${safeStr(m?.room_id)}|${safeStr(m?.shift)}|${Number(m?.weekday) || 0}|${Number(m?.period_index) || 0}`;
    const fullKey = actionKey(a);
    if (seenMatch.has(matchKey)) continue; // evita mover/remover a mesma regra duas vezes
    if (seenFull.has(fullKey)) continue;
    seenMatch.add(matchKey);
    seenFull.add(fullKey);
    out.push(a);
  }
  return out;
}

export function ScheduleConflictsClient({ initialShift }: { initialShift?: string | null }) {
  const router = useRouter();
  const [shift, setShift] = useState(normShift(initialShift ?? "MANHA"));
  const [kind, setKind] = useState<"all" | ConflictKind>("all");
  const [query, setQuery] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConflictsResp | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [actionsJson, setActionsJson] = useState<string>("");
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLog, setChatLog] = useState<{ role: "user" | "assistant"; text: string }[]>([]);
  const [saveBanner, setSaveBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  async function loadConflicts(nextShift: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("shift", nextShift);
      const res = await fetch(`/api/ai/global-schedule-conflicts?${params.toString()}`);
      const json = (await res.json()) as ConflictsResp;
      if (!res.ok) {
        setError((json as any)?.error || "Falha ao carregar conflitos.");
        setData(null);
        return;
      }
      setData(json);
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao carregar conflitos.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConflicts(shift);
  }, [shift]);

  // Evita aplicar sugestões de um turno no outro
  useEffect(() => {
    setAiOpen(false);
    setAiResult(null);
    setActionsJson("");
    setChatLog([]);
    setAiError(null);
    setSaveBanner(null);
  }, [shift]);

  function flattenActions(r: any) {
    const out: any[] = [];
    const sugg = Array.isArray(r?.suggestions) ? r.suggestions : [];
    for (const s of sugg) {
      const acts = Array.isArray(s?.actions) ? s.actions : [];
      for (const a of acts) out.push(a);
    }
    return out;
  }

  function parseActionsText(text: string): any[] {
    try {
      const v = JSON.parse(text || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  function stageActions(actions: any[]) {
    const cur = parseActionsText(actionsJson);
    const merged = [...cur];
    const seen = new Set(merged.map((a) => actionKey(a)));
    for (const a of actions) {
      const k = actionKey(a);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(a);
    }
    setActionsJson(JSON.stringify(merged, null, 2));
  }

  function findConflictForAction(a: any): ConflictRow | null {
    const tid = safeStr(a?.teacher_id);
    const m = a?.match ?? {};
    const cls = safeStr(m?.class_id);
    const wd = Number(m?.weekday) || 0;
    const p = Number(m?.period_index) || 0;
    const list = data?.conflicts ?? [];
    return (
      list.find(
        (c) =>
          safeStr(c?.requested?.teacherId) === tid &&
          safeStr(c?.requested?.classId) === cls &&
          Number(c?.weekday) === wd &&
          Number(c?.period_index) === p,
      ) ?? null
    );
  }

  function describeAction(a: any): string {
    const type = safeStr(a?.type);
    if (type === "note") return safeStr(a?.note) ? `Nota: ${safeStr(a?.note)}` : "Nota";

    const m = a?.match ?? {};
    const to = a?.to ?? {};
    const fromWd = Number(m?.weekday) || 0;
    const fromP = Number(m?.period_index) || 0;
    const toWd = Number(to?.weekday) || 0;
    const toP = Number(to?.period_index) || 0;

    const c = findConflictForAction(a);
    const tName = c?.requested?.teacherName || (safeStr(a?.teacher_id) ? `Professor ${safeStr(a?.teacher_id).slice(0, 6)}…` : "Professor");
    const clsName = c?.requested?.className ? `Turma ${c.requested.className}` : safeStr(m?.class_id) ? `Turma ${safeStr(m?.class_id).slice(0, 6)}…` : "Turma";
    const subjName = c?.requested?.subjectName ? ` • ${c.requested.subjectName}` : "";
    const roomName = c?.requested?.roomName ? ` • ${c.requested.roomName}` : "";

    const fromLabel = c?.slot?.label || slotFallbackLabel(fromWd, fromP);
    const toLabel = slotFallbackLabel(toWd, toP);

    if (type === "delete_rule") {
      return `Remover: ${tName} • ${clsName}${subjName}${roomName} (${fromLabel})`;
    }
    return `Mover: ${tName} • ${clsName}${subjName}${roomName} — ${fromLabel} → ${toLabel}`;
  }

  async function applyActionsNow(actions: any[], label?: string) {
    if (!actions || actions.length === 0) return;
    setAiLoading(true);
    setAiError(null);
    setSaveBanner(null);
    try {
      const applyRes = await fetch("/api/ai/resolve-global-conflicts/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const applyJson = await applyRes.json();
      if (!applyRes.ok) {
        setAiError(applyJson?.error || "Falha ao aplicar alteração.");
        return;
      }
      const rebuild = await fetch("/api/ai/build-global-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, overwrite: true }),
      });
      const rebuildJson = await rebuild.json();
      if (!rebuild.ok) {
        setSaveBanner({ kind: "error", text: rebuildJson?.error || "Falha ao atualizar a grade." });
        return;
      }

      await loadConflicts(shift);
      router.refresh();
      setSaveBanner({ kind: "success", text: label ? `Aplicado: ${label}. Grade atualizada.` : "Alteração aplicada. Grade atualizada." });
      setChatLog((prev) => [...prev, { role: "assistant", text: label ? `Apliquei a sugestão “${label}”.` : "Apliquei a sugestão." }]);
    } catch (e: any) {
      setAiError(e?.message || "Erro ao aplicar alteração.");
    } finally {
      setAiLoading(false);
    }
  }

  async function applyAllSuggestionsNow() {
    const actions = dedupForApplyAll(flattenActions(aiResult));
    if (!actions.length) {
      setSaveBanner({ kind: "error", text: "Nenhuma ação aplicável nas sugestões atuais." });
      return;
    }
    await applyActionsNow(actions, "Aplicar todas");
  }

  async function runAi() {
    setAiLoading(true);
    setAiError(null);
    setSaveBanner(null);
    try {
      const res = await fetch("/api/ai/resolve-global-conflicts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, conflicts: data?.conflicts ?? [] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json?.error || "Falha ao gerar sugestões.");
        return;
      }
      setAiResult(json);
      const acts = flattenActions(json);
      setActionsJson(JSON.stringify(acts, null, 2));
      setChatLog([{ role: "assistant", text: String(json?.summary || "Sugestões geradas.") }]);
    } catch (e: any) {
      setAiError(e?.message || "Erro de rede ao chamar IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function sendChat() {
    const msg = chatInput.trim();
    if (!msg) return;
    setChatInput("");
    setAiLoading(true);
    setAiError(null);
    setSaveBanner(null);
    setChatLog((prev) => [...prev, { role: "user", text: msg }]);
    try {
      const res = await fetch("/api/ai/resolve-global-conflicts/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, conflicts: data?.conflicts ?? [], previous: aiResult, message: msg }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAiError(json?.error || "Falha ao conversar com a IA.");
        return;
      }
      setAiResult(json);
      const acts = flattenActions(json);
      setActionsJson(JSON.stringify(acts, null, 2));
      setChatLog((prev) => [...prev, { role: "assistant", text: String(json?.summary || "Atualizei as sugestões.") }]);
    } catch (e: any) {
      setAiError(e?.message || "Erro de rede ao conversar com a IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function saveAiChanges() {
    setAiLoading(true);
    setAiError(null);
    setSaveBanner(null);
    try {
      let actions: any[] = [];
      try {
        actions = JSON.parse(actionsJson || "[]");
      } catch {
        setAiError("JSON inválido em 'Ações'.");
        setAiLoading(false);
        return;
      }

      const applyRes = await fetch("/api/ai/resolve-global-conflicts/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ actions }),
      });
      const applyJson = await applyRes.json();
      if (!applyRes.ok) {
        setAiError(applyJson?.error || "Falha ao salvar regras.");
        return;
      }

      // Reprocessa a grade (reconstrói aulas a partir das regras atualizadas)
      const rebuild = await fetch("/api/ai/build-global-schedule", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ shift, overwrite: true }),
      });
      const rebuildJson = await rebuild.json();
      if (!rebuild.ok) {
        setSaveBanner({ kind: "error", text: rebuildJson?.error || "Falha ao remontar a grade." });
        return;
      }

      await loadConflicts(shift);
      router.refresh();
      setSaveBanner({ kind: "success", text: "Sugestões aplicadas. Grade atualizada." });
    } catch (e: any) {
      setAiError(e?.message || "Erro ao salvar.");
    } finally {
      setAiLoading(false);
    }
  }

  const rows = useMemo(() => {
    const base = (data?.conflicts ?? []).slice();
    const q = query.trim().toLowerCase();
    return base
      .filter((c) => (kind === "all" ? true : c.kind === kind))
      .filter((c) => {
        if (!q) return true;
        const hay = [
          c.message,
          c.requested.teacherName,
          c.requested.className,
          c.requested.subjectName,
          c.requested.roomName,
          c.blockedBy?.teacherName,
          c.blockedBy?.className,
          c.blockedBy?.subjectName,
          c.blockedBy?.roomName,
          c.slot?.label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
  }, [data, kind, query]);

  const weekdayGroups = useMemo(() => {
    // Mostra apenas os dias que realmente tiveram conflitos (depois dos filtros/busca)
    const map = new Map<number, ConflictRow[]>();
    for (const c of rows) {
      const wd = Number(c?.weekday) || 0;
      const key = wd || 0;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    }
    const orderKey = (wd: number) => (wd === 0 ? 99 : wd);
    return Array.from(map.entries())
      .sort(([a], [b]) => orderKey(a) - orderKey(b))
      .map(([weekday, items]) => ({
        weekday,
        label: weekday ? weekdayLong(weekday) : "Sem dia",
        items,
      }));
  }, [rows]);

  const counts = data?.counts ?? { total: 0, teacher: 0, room: 0, class: 0, slot: 0 };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href={`/schedule?shift=${encodeURIComponent(shift)}`}
          className="h-10 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
        >
          ← Voltar para Montar grade
        </a>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-semibold">Turno</label>
          <select
            value={shift}
            onChange={(e) => setShift(normShift(e.target.value))}
            className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-900 dark:bg-zinc-950"
          >
            <option value="MANHA">Manhã</option>
            <option value="TARDE">Tarde</option>
            <option value="NOITE">Noite</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-sm font-semibold">Resumo</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Total: {counts.total} • Professores: {counts.teacher} • Turmas: {counts.class} • Salas: {counts.room}
              {counts.slot ? ` • Horários ausentes: ${counts.slot}` : ""}
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Os conflitos são simulados na mesma ordem usada ao montar a grade (professores em ordem alfabética).
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-900 dark:bg-zinc-950"
            >
              <option value="all">Todos</option>
              <option value="teacher">Professor</option>
              <option value="class">Turma</option>
              <option value="room">Sala</option>
              <option value="slot">Horário</option>
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-10 w-[260px] max-w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:focus:border-zinc-700"
            />

            {counts.total > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setAiOpen((v) => !v);
                  if (!aiResult) void runAi();
                }}
                className="h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
                disabled={aiLoading}
                title="Gerar sugestões para resolver conflitos ajustando regras dos professores"
              >
                Resolver com IA
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {aiOpen ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid gap-1">
              <div className="text-sm font-semibold">Assistente de conflitos (IA)</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                A IA sugere alterações nas <span className="font-semibold">regras de aulas dos professores</span> para reduzir conflitos.
                Revise e edite as ações antes de salvar.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void runAi()}
                className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                disabled={aiLoading}
              >
                Regerar sugestões
              </button>
              <button
                type="button"
                onClick={() => void applyAllSuggestionsNow()}
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                disabled={aiLoading || !dedupForApplyAll(flattenActions(aiResult)).length}
                title="Aplicar todas as sugestões da IA de uma vez e atualizar a grade"
              >
                Aplicar todas
              </button>
              <button
                type="button"
                onClick={() => void saveAiChanges()}
                className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                disabled={aiLoading || !actionsJson.trim()}
              >
                Salvar e atualizar grade
              </button>
            </div>
          </div>

          {saveBanner ? (
            <div
              className={`mt-3 rounded-xl border p-3 text-sm ${
                saveBanner.kind === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-200"
                  : "border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200"
              }`}
            >
              {saveBanner.text}
            </div>
          ) : null}

          {aiError ? (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {aiError}
            </div>
          ) : null}

          {aiResult ? (
            <div className="mt-4 grid gap-4">
              <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-300">
                <div className="font-semibold">Resumo</div>
                <div className="mt-1">{String(aiResult?.summary ?? "")}</div>
                {Array.isArray(aiResult?.warnings) && aiResult.warnings.length ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="font-semibold">Avisos</div>
                    <ul className="mt-1 list-disc pl-5">
                      {aiResult.warnings.slice(0, 8).map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {Array.isArray(aiResult?.questions) && aiResult.questions.length ? (
                  <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="font-semibold">Perguntas</div>
                    <ul className="mt-1 list-disc pl-5">
                      {aiResult.questions.slice(0, 8).map((q: string, i: number) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>

              {Array.isArray(aiResult?.suggestions) && aiResult.suggestions.length ? (
                <div className="grid gap-2">
                  <div className="text-sm font-semibold">Sugestões</div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    As sugestões abaixo são <span className="font-semibold">clicáveis</span>: clique em um card para aplicar e atualizar a grade.
                    Você também pode adicionar as ações ao editor e ajustar manualmente.
                  </div>
                  <div className="grid gap-2">
                    {aiResult.suggestions.slice(0, 12).map((s: any, idx: number) => {
                      const title = String(s?.title ?? "Sugestão");
                      const rationale = String(s?.rationale ?? "");
                      const actions = Array.isArray(s?.actions) ? s.actions : [];
                      const actionCount = actions.length;

                      return (
                        <div
                          key={idx}
                          onClick={() => void applyActionsNow(actions, title)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              void applyActionsNow(actions, title);
                            }
                          }}
                          className="cursor-pointer rounded-xl border border-zinc-200 bg-white p-3 text-sm hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                          title="Clique para aplicar esta sugestão e atualizar a grade"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-[240px] flex-1">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
                              {rationale ? <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{rationale}</div> : null}
                              {actionCount ? (
                                <div className="mt-2 grid gap-1">
                                  {actions.slice(0, 4).map((a: any, i: number) => (
                                    <button
                                      key={i}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        void applyActionsNow([a], `${title} (ação ${i + 1})`);
                                      }}
                                      className="text-left text-xs text-zinc-700 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:decoration-zinc-700 dark:hover:text-zinc-100"
                                      title="Aplicar somente esta ação"
                                      disabled={aiLoading}
                                    >
                                      {describeAction(a)}
                                    </button>
                                  ))}
                                  {actions.length > 4 ? (
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400">+{actions.length - 4} ações…</div>
                                  ) : null}
                                </div>
                              ) : (
                                <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Sem ações aplicáveis.</div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  stageActions(actions);
                                  setSaveBanner({ kind: "success", text: "Ações adicionadas ao editor. Revise e clique em ‘Salvar e atualizar grade’." });
                                }}
                                className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                                disabled={aiLoading || actionCount === 0}
                                title="Adicionar as ações desta sugestão ao editor abaixo"
                              >
                                Adicionar
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void applyActionsNow(actions, title);
                                }}
                                className="h-9 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                                disabled={aiLoading || actionCount === 0}
                                title="Aplicar agora e atualizar grade"
                              >
                                Aplicar
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Ações (editável)</div>
                <textarea
                  value={actionsJson}
                  onChange={(e) => setActionsJson(e.target.value)}
                  rows={10}
                  spellCheck={false}
                  className="w-full rounded-xl border border-zinc-200 bg-white p-3 font-mono text-xs text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-700"
                />
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Tipos de ação: <span className="font-semibold">move_rule</span> (mover a regra para outro dia/período), <span className="font-semibold">delete_rule</span> (remover a regra), <span className="font-semibold">note</span>.
                </div>
              </div>

              <div className="grid gap-2">
                <div className="text-sm font-semibold">Converse com a IA</div>
                <div className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-900 dark:bg-zinc-950">
                  <div className="grid gap-2">
                    {chatLog.length ? (
                      <div className="grid gap-2">
                        {chatLog.slice(-8).map((m, i) => (
                          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
                            <div
                              className={`inline-block max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                                m.role === "user"
                                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                              }`}
                            >
                              {m.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">Envie uma mensagem para refinar as sugestões.</div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <input
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ex.: mantenha a turma A de manhã, priorize trocar períodos da terça…"
                        className="h-10 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-900 dark:bg-zinc-950 dark:focus:border-zinc-700"
                      />
                      <button
                        type="button"
                        onClick={() => void sendChat()}
                        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                        disabled={aiLoading || !chatInput.trim()}
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {aiLoading ? "Gerando sugestões…" : "Clique em ‘Regerar sugestões’ para iniciar."}
            </div>
          )}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-zinc-600 dark:text-zinc-400">Carregando conflitos…</div> : null}
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="overflow-x-auto">
            <table className="min-w-[980px] w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Tipo</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Horário</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Tentativa</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Bloqueado por</th>
                  <th className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {weekdayGroups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum conflito encontrado para este filtro.
                    </td>
                  </tr>
                ) : null}

                {weekdayGroups.map((g) => (
                  <Fragment key={`weekday-${g.weekday || "none"}`}>
                    <tr className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950">
                      <td colSpan={5} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                        {g.label} • {g.items.length} conflito(s)
                      </td>
                    </tr>

                    {g.items.map((c) => {
                      const attempt = [
                        c.requested.teacherName,
                        c.requested.className ? `Turma ${c.requested.className}` : null,
                        c.requested.subjectName,
                        c.requested.roomName,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      const blocked = c.blockedBy
                        ? [
                            c.blockedBy.activityType === "HA" ? "HA" : "Aula",
                            c.blockedBy.teacherName,
                            c.blockedBy.className ? `Turma ${c.blockedBy.className}` : null,
                            c.blockedBy.subjectName,
                            c.blockedBy.roomName,
                            c.blockedBy.source === "planned" ? "(regra anterior)" : "(já cadastrado)",
                          ]
                            .filter(Boolean)
                            .join(" • ")
                        : "—";

                      const focusTeacherId = c.requested.teacherId;
                      const focusBlockedTeacherId = c.blockedBy?.teacherId;

                      return (
                        <tr key={c.id} className="border-t border-zinc-100 dark:border-zinc-900">
                          <td className="px-4 py-3 align-top text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {kindLabel(c.kind)}
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-zinc-800 dark:text-zinc-200">
                            {c.slot?.label ?? "(horário ausente)"}
                            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                              {weekdayShort(c.weekday)} • {c.shift}
                            </div>
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{attempt}</div>
                            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">{c.message}</div>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-zinc-800 dark:text-zinc-200">{blocked}</td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap gap-2">
                              {focusTeacherId ? (
                                <a
                                  href={`/teachers?focus=${encodeURIComponent(focusTeacherId)}#teacher-${encodeURIComponent(focusTeacherId)}`}
                                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                                >
                                  Editar professor
                                </a>
                              ) : null}

                              {focusBlockedTeacherId && focusBlockedTeacherId !== focusTeacherId ? (
                                <a
                                  href={`/teachers?focus=${encodeURIComponent(focusBlockedTeacherId)}#teacher-${encodeURIComponent(focusBlockedTeacherId)}`}
                                  className="h-9 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-zinc-900 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                                >
                                  Ver professor bloqueador
                                </a>
                              ) : null}

                              {c.requested.classId ? (
                                <a
                                  href={`/schedule/manual?classId=${encodeURIComponent(c.requested.classId)}`}
                                  className="h-9 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                                >
                                  Ajustar turma
                                </a>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
