"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type CalendarSource = {
  id: string;
  name: string;
  url: string;
              type: "site" | "pdf";
  active: boolean;
};

type CalendarEvent = {
  id: string;
              title: string;
  start_at: string; // ISO
  end_at?: string | null;
  category: string;
  source_url?: string | null;
  source_name?: string | null;
  source_id?: string | null;
};

type DayEvent = CalendarEvent & {
  __segment?: "single" | "start" | "mid" | "end";
  __displayTitle?: string;
};

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

function formatMonth(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function clampText(s: string, max = 90) {
  const t = (s || "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function fmtShortDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function fmtShortDateYear(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function DirectorCalendar({ schoolId }: { schoolId: string }) {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  const [dayOpen, setDayOpen] = useState(false);
  const [daySelected, setDaySelected] = useState<Date | null>(null);

  const [manualOpen, setManualOpen] = useState(false);
  const [manualDate, setManualDate] = useState<string>(() => toISODate(new Date()));
  const [manualTime, setManualTime] = useState<string>("09:00");
  const [manualEndTime, setManualEndTime] = useState<string>("");
  const [manualTitle, setManualTitle] = useState<string>("");
  const [manualCategory, setManualCategory] = useState<string>("Manual");

  function openManualForDate(d: Date) {
    setManualDate(toISODate(d));
    setManualTime("09:00");
    setManualEndTime("");
    setManualCategory("Manual");
    setManualTitle("");
    setManualOpen(true);
  }

  function openDayDetails(d: Date) {
    setDaySelected(d);
    setDayOpen(true);
  }

  const monthStart = useMemo(() => startOfMonth(month), [month]);
  const monthEnd = useMemo(() => endOfMonth(month), [month]);

  async function loadSources() {
    const r = await fetch("/api/calendar/sources", { cache: "no-store" });
    if (!r.ok) throw new Error(await r.text());
    const data = (await r.json()) as { sources: CalendarSource[] };
    setSources(data.sources ?? []);
  }

  async function loadEvents() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("start", toISODate(monthStart));
      params.set("end", toISODate(monthEnd));
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (sourceId) params.set("source", sourceId);

      const r = await fetch(`/api/calendar/events?${params.toString()}`, { cache: "no-store" });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { events: CalendarEvent[] };
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }

  async function createManualEvent() {
    setMsg("");
    const title = manualTitle.trim();
    if (!title) {
      setMsg("Informe um título para o evento.");
      return;
    }

    // Interpretar como horário LOCAL (evita deslocamento de data para eventos criados manualmente)
    const [y, m, d] = manualDate.split("-").map((x) => Number(x));
    const [hh, mm] = manualTime.split(":").map((x) => Number(x));
    const start = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0);

    let endIso: string | null = null;
    if (manualEndTime.trim()) {
      const [eh, em] = manualEndTime.split(":").map((x) => Number(x));
      const end = new Date(y, (m || 1) - 1, d || 1, eh || 0, em || 0, 0);
      if (!isNaN(end.getTime()) && end.getTime() > start.getTime()) endIso = end.toISOString();
    }

    try {
      const r = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          start_at: start.toISOString(),
          end_at: endIso,
          category: (manualCategory || "Manual").trim() || "Manual",
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      setMsg("Evento manual criado.");
      setManualOpen(false);
      setManualTitle("");
      setManualEndTime("");
      await loadEvents();
    } catch (e: any) {
      setMsg(e?.message || "Não foi possível criar o evento manual.");
    }
  }

  async function deleteEvent(id: string) {
    setMsg("");
    if (!confirm("Excluir este evento do calendário?")) return;
    setEvents((prev) => prev.filter((e) => e.id !== id));
    try {
      const r = await fetch(`/api/calendar/events?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error(await r.text());
      setMsg("Evento excluído.");
      await loadEvents();
    } catch (e: any) {
      setMsg(e?.message || "Não foi possível excluir o evento.");
      await loadEvents();
    }
  }



  async function clearAllEvents() {
    setMsg("");
    if (!confirm("Isso vai excluir TODOS os eventos do calendário. Deseja continuar?")) return;
    if (!confirm("Confirma novamente: zerar o calendário agora?")) return;

    setRefreshing(true);
    try {
      const r = await fetch("/api/calendar/events/clear", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { deleted?: number; cache_reset?: boolean; warning?: string };

      const deleted = data.deleted ?? 0;
      const cacheReset = data.cache_reset !== false;

      setMsg(
        cacheReset
          ? `Calendário zerado. ${deleted} evento(s) removido(s). Cache das fontes resetado — clique em “Atualizar” para reimportar.`
          : `Calendário zerado. ${deleted} evento(s) removido(s). (Aviso: não consegui resetar o cache das fontes: ${
              data.warning || "erro desconhecido"
            })`,
      );

      await loadEvents();
    } catch (e: any) {
      setMsg(e?.message || "Não foi possível zerar o calendário.");
    } finally {
      setRefreshing(false);
    }
  }


  async function refresh() {
    setRefreshing(true);
    setMsg("");
    try {
      const r = await fetch("/api/calendar/refresh", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const data = (await r.json()) as { message?: string };
      setMsg(data.message || "Calendário atualizado.");
      await loadEvents();
    } catch (e: any) {
      setMsg(e?.message || "Não foi possível atualizar o calendário.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadSources().catch(() => {});
  }, []);

  useEffect(() => {
    loadEvents().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStart.getTime(), monthEnd.getTime(), category, sourceId]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadEvents().catch(() => {});
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const eventsByDay = useMemo(() => {
    const m = new Map<string, DayEvent[]>();

    for (const ev of events) {
      const start = new Date(ev.start_at);
      const end = ev.end_at ? new Date(ev.end_at) : start;

      // Normalize to local-day boundaries for spreading
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

      const multi = !sameLocalDay(start, end);

      while (cur.getTime() <= last.getTime()) {
        const k = dayKey(cur);
        const arr = m.get(k) ?? [];

        let seg: DayEvent["__segment"] = "single";
        if (multi) {
          if (sameLocalDay(cur, start)) seg = "start";
          else if (sameLocalDay(cur, end)) seg = "end";
          else seg = "mid";
        }

        const marker = seg === "start" ? "↦" : seg === "end" ? "↤" : seg === "mid" ? "↔" : "";

        const displayTitle = multi
          ? seg === "start"
            ? `${marker} ${ev.title} (${fmtShortDate(start)}–${fmtShortDate(end)})`
            : `${marker} ${ev.title}`
          : ev.title;

        arr.push({ ...ev, __segment: seg, __displayTitle: displayTitle });
        m.set(k, arr);

        cur.setDate(cur.getDate() + 1);
      }
    }

    // Sort events per day
    for (const [k, arr] of m.entries()) {
      arr.sort((a, b) => {
        const ta = new Date(a.start_at).getTime();
        const tb = new Date(b.start_at).getTime();
        if (ta !== tb) return ta - tb;
        return String(a.title || "").localeCompare(String(b.title || ""));
      });
      m.set(k, arr);
    }

    return m;
  }, [events]);

  const gridDays = useMemo(() => {
    const first = new Date(monthStart);
    const dow = (first.getDay() + 6) % 7; // 0 = segunda
    const start = new Date(first);
    start.setDate(first.getDate() - dow);

    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [monthStart]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(e.category || "Outros");
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [events]);

  return (
    <div className="grid gap-4">
      <div className="panel p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-base font-semibold">{formatMonth(monthStart)}</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
              Dados cacheados (rápido). Use “Atualizar” quando quiser puxar novidades das fontes.
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary" onClick={() => setSourcesOpen(true)} type="button">
              Fontes
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => {
                openManualForDate(new Date());
              }}
              type="button"
            >
              Novo evento
            </button>

            <button
              className="btn btn-danger"
              onClick={clearAllEvents}
              type="button"
              disabled={refreshing}
              title="Exclui todos os eventos do calendário"
            >
              Zerar calendário
            </button>

            <button
              className="btn btn-primary"
              onClick={refresh}
              type="button"
              disabled={refreshing}
              title="Atualiza eventos a partir das fontes ativas"
            >
              {refreshing ? "Atualizando…" : "Atualizar"}
            </button>
          </div>
        </div>

        {msg ? (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200">
            {msg}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">Buscar</label>
            <input
              className="input mt-1 w-full"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ex.: conselho, recessos, distribuição"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">Categoria</label>
            <select className="input mt-1 w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">Fonte</label>
            <select className="input mt-1 w-full" value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">Todas</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.active ? "" : " (inativa)"}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))}
            >
              ◀
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setMonth(new Date())} title="Ir para o mês atual">
              Hoje
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="panel p-4">
          <div className="grid grid-cols-7 gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
              <div key={d} className="px-1 py-1 font-semibold">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {gridDays.map((d) => {
              const k = dayKey(d);
              const inMonth = d.getMonth() === monthStart.getMonth();
              const dayEvents = eventsByDay.get(k) ?? [];
              return (
                <div
                  key={k}
                  onClick={() => openDayDetails(d)}
                  className={
                    "min-h-[88px] cursor-pointer rounded-xl border p-2 transition hover:shadow-sm " +
                    (inMonth
                      ? "border-zinc-200 bg-white dark:border-zinc-900 dark:bg-zinc-950"
                      : "border-zinc-100 bg-zinc-50 text-zinc-500 dark:border-zinc-900/50 dark:bg-zinc-950/40")
                  }
                  title="Clique para ver todos os eventos deste dia"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold">{d.getDate()}</div>
                    <div className="flex items-center gap-1">
                      {dayEvents.length ? <div className="text-[10px] text-zinc-500">{dayEvents.length}</div> : null}
                      <button
                        type="button"
                        className="rounded-md border border-zinc-200 bg-white px-1 text-[10px] text-zinc-600 hover:bg-zinc-100 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                        title="Adicionar evento manual"
                        onClick={(e) => {
                          e.stopPropagation();
                          openManualForDate(d);
                        }}
                      >
                        ＋
                      </button>
                    </div>
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const t = new Date(ev.start_at);
                      const label = ev.__displayTitle || ev.title;
                      const isMulti = Boolean(ev.end_at && !sameLocalDay(new Date(ev.start_at), new Date(ev.end_at)));
                      return (
                        <div
                          key={`${ev.id}-${ev.__segment || "single"}`}
                          className="group relative rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] text-zinc-800 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-200"
                          title={label}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="mr-1 text-[10px] text-zinc-500">{formatTime(t)}</span>
                          {clampText(label, 42)}

                          <button
                            type="button"
                            className="absolute right-1 top-1 hidden rounded-md px-1 text-[10px] text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 group-hover:block dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                            title="Excluir"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEvent(ev.id).catch(() => {});
                            }}
                          >
                            ✕
                          </button>

                          {isMulti ? <span className="ml-1 text-[10px] text-zinc-500">(período)</span> : null}
                        </div>
                      );
                    })}
                    {dayEvents.length > 3 ? <div className="text-[11px] text-zinc-500">+{dayEvents.length - 3} mais</div> : null}
                  </div>
                </div>
              );
            })}
          </div>

          {loading ? <div className="mt-3 text-sm text-zinc-500">Carregando eventos…</div> : null}
        </div>

        <div className="panel p-4">
          <div className="text-base font-semibold">Próximos eventos</div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Lista do mês selecionado (inclui períodos).</div>
          <div className="mt-3 space-y-2">
            {events
              .slice()
              .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
              .slice(0, 40)
              .map((ev) => {
                const d = new Date(ev.start_at);
                const end = ev.end_at ? new Date(ev.end_at) : null;
                const hasEndDay = Boolean(end && !sameLocalDay(d, end));

                return (
                  <div key={ev.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-900">
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{ev.title}</div>
                      <button
                        className="btn btn-danger px-2 py-1 text-xs"
                        type="button"
                        title="Excluir evento"
                        onClick={() => {
                          deleteEvent(ev.id).catch(() => {});
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      {fmtShortDateYear(d)}
                      {" · "}
                      {formatTime(d)}
                      {hasEndDay && end ? ` → ${fmtShortDateYear(end)}` : ""}
                      {ev.category ? ` · ${ev.category}` : ""}
                    </div>
                    {ev.source_url ? (
                      <div className="mt-2">
                        <Link className="text-xs text-blue-600 hover:underline dark:text-blue-400" href={ev.source_url} target="_blank" rel="noreferrer">
                          Abrir fonte
                        </Link>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            {!events.length ? (
              <div className="rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
                Nenhum evento no período. Cadastre fontes em <strong>Fontes</strong> e clique em <strong>Atualizar</strong>.
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {dayOpen && daySelected ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Eventos do dia</div>
                <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                  {daySelected.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-secondary"
                  type="button"
                  onClick={() => {
                    openManualForDate(daySelected);
                    setDayOpen(false);
                  }}
                >
                  Adicionar manual
                </button>
                <button className="btn btn-secondary" type="button" onClick={() => setDayOpen(false)}>
                  Fechar
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {(eventsByDay.get(dayKey(daySelected)) ?? [])
                .slice()
                .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
                .map((ev) => {
                  const start = new Date(ev.start_at);
                  const end = ev.end_at ? new Date(ev.end_at) : null;
                  const multi = Boolean(end && !sameLocalDay(start, end));
                  const seg = ev.__segment;

                  const timeLabel = multi
                    ? `${fmtShortDateYear(start)} → ${fmtShortDateYear(end!)}`
                    : `${formatTime(start)}${end ? `–${formatTime(end)}` : ""}`;

                  const segLabel =
                    seg === "start" ? "↦" : seg === "end" ? "↤" : seg === "mid" ? "↔" : "";

                  return (
                    <div
                      key={`${ev.id}-${seg || "single"}-modal`}
                      className="rounded-xl border border-zinc-200 bg-white p-3 text-sm dark:border-zinc-900 dark:bg-zinc-950"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{timeLabel}</div>
                            {segLabel ? <div className="text-xs text-zinc-500">{segLabel}</div> : null}
                            {ev.category ? (
                              <div className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
                                {ev.category}
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-1 font-semibold">{ev.__displayTitle || ev.title}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {ev.source_name ? (
                              <>
                                Fonte:{" "}
                                {ev.source_url ? (
                                  <Link className="underline" href={ev.source_url} target="_blank">
                                    {ev.source_name}
                                  </Link>
                                ) : (
                                  ev.source_name
                                )}
                              </>
                            ) : (
                              <span>Fonte: manual</span>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          title="Excluir evento"
                          onClick={async () => {
                            await deleteEvent(ev.id);
                            // se o último evento do dia for removido, continua mostrando o modal (vazio)
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}

              {(eventsByDay.get(dayKey(daySelected)) ?? []).length === 0 ? (
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-900 dark:bg-zinc-950 dark:text-zinc-300">
                  Nenhum evento registrado neste dia.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}


      {sourcesOpen ? (
        <SourcesModal
          schoolId={schoolId}
          onClose={() => {
            setSourcesOpen(false);
            loadSources().catch(() => {});
          }}
        />
      ) : null}

      {manualOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl dark:bg-zinc-950">
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold">Novo evento (manual)</div>
              <button className="btn btn-secondary" type="button" onClick={() => setManualOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-zinc-600 dark:text-zinc-300">Título</label>
                <input
                  className="input mt-1 w-full"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="ex.: Reunião pedagógica, entrega de notas..."
                />
              </div>
              <div>
                <label className="text-xs text-zinc-600 dark:text-zinc-300">Data</label>
                <input className="input mt-1 w-full" type="date" value={manualDate} onChange={(e) => setManualDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-600 dark:text-zinc-300">Categoria</label>
                <input className="input mt-1 w-full" value={manualCategory} onChange={(e) => setManualCategory(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-600 dark:text-zinc-300">Hora início</label>
                <input className="input mt-1 w-full" type="time" value={manualTime} onChange={(e) => setManualTime(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-zinc-600 dark:text-zinc-300">Hora fim (opcional)</label>
                <input
                  className="input mt-1 w-full"
                  type="time"
                  value={manualEndTime}
                  onChange={(e) => setManualEndTime(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button className="btn btn-secondary" type="button" onClick={() => setManualOpen(false)}>
                Cancelar
              </button>
              <button className="btn btn-primary" type="button" onClick={() => createManualEvent().catch(() => {})}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SourcesModal({ onClose }: { schoolId: string; onClose: () => void }) {
  const [sources, setSources] = useState<CalendarSource[]>([]);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  async function reload() {
    const r = await fetch("/api/calendar/sources", { cache: "no-store" });
    const data = (await r.json()) as { sources: CalendarSource[] };
    setSources(data.sources ?? []);
  }

  useEffect(() => {
    reload().catch(() => {});
  }, []);

  async function addSource() {
    setErr("");
    setSaving(true);
    try {
      const r = await fetch("/api/calendar/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, url }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || (await r.text()));
      setName("");
      setUrl("");
      await reload();
    } catch (e: any) {
      setErr(e?.message || "Não foi possível adicionar a fonte.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPdf() {
    setErr("");
    if (!pdfFile) {
      setErr("Selecione um arquivo PDF.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", pdfFile);
      if (name.trim()) fd.set("name", name.trim());

      const r = await fetch("/api/calendar/sources/upload", {
        method: "POST",
        body: fd,
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.error || (await r.text()));

      setPdfFile(null);
      setName("");
      await reload();
    } catch (e: any) {
      setErr(e?.message || "Não foi possível enviar o PDF.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const r = await fetch("/api/calendar/sources", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, active }),
    });
    if (r.ok) await reload();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/calendar/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (r.ok) await reload();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-900 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">Fontes do calendário</div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">Links de sites ou PDFs, ou um PDF local do seu computador.</div>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onClose}>
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_180px_auto]">
          <div>
            <label className="text-xs text-zinc-600 dark:text-zinc-300">Nome</label>
            <input className="input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-zinc-600 dark:text-zinc-300">Link (site ou PDF)</label>
            <div className="mt-1 flex gap-2">
              <input className="input w-full" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              <button className="btn btn-primary" type="button" onClick={addSource} disabled={saving}>
                {saving ? "Salvando…" : "Adicionar"}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-zinc-200 p-3 dark:border-zinc-900">
          <div className="text-sm font-semibold">PDF local</div>
          <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
            Envia o PDF para o storage (bucket <code className="text-[11px]">calendar-pdfs</code> ou <code className="text-[11px]">CALENDAR_PDF_BUCKET</code>) e cadastra como fonte.
          </div>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              className="input w-full"
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />
            <button className="btn btn-primary" type="button" onClick={uploadPdf} disabled={uploading}>
              {uploading ? "Enviando…" : "Enviar PDF"}
            </button>
          </div>
        </div>

        {err ? <div className="mt-2 text-sm text-red-600">{err}</div> : null}

        <div className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-900">
          {sources.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{s.name}</div>
                <div className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-300">{s.url}</div>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn btn-secondary" type="button" onClick={() => toggleActive(s.id, !s.active)}>
                  {s.active ? "Desativar" : "Ativar"}
                </button>
                <a className="btn btn-secondary" href={s.url} target="_blank" rel="noreferrer">
                  Abrir
                </a>
                <button className="btn btn-danger" type="button" onClick={() => remove(s.id)}>
                  Excluir
                </button>
              </div>
            </div>
          ))}
          {!sources.length ? <div className="p-4 text-sm text-zinc-600 dark:text-zinc-300">Nenhuma fonte cadastrada.</div> : null}
        </div>
      </div>
    </div>
  );
}
