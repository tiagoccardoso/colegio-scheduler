"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type RefRow = {
  id: string;
  name: string | null;
  default_room_id?: string | null;
  shift?: string | null;
};

type RoomRow = {
  id: string;
  name: string | null;
};

function shiftLabel(shift: string | null | undefined) {
  const key = String(shift ?? "").trim().toUpperCase();
  if (key === "MANHA") return "Manhã";
  if (key === "TARDE") return "Tarde";
  if (key === "NOITE") return "Noite";
  return key || "—";
}

export function DefaultRoomsClient(props: {
  schoolName?: string | null;
  classes: RefRow[];
  teachers: RefRow[];
  rooms: RoomRow[];
}) {
  const [classes, setClasses] = useState<RefRow[]>(props.classes);
  const [teachers, setTeachers] = useState<RefRow[]>(props.teachers);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [classFilter, setClassFilter] = useState("");
  const [teacherFilter, setTeacherFilter] = useState("");

  const roomById = useMemo(() => new Map(props.rooms.map((room) => [room.id, room.name ?? ""])), [props.rooms]);

  const filteredClasses = useMemo(() => {
    const q = classFilter.trim().toLowerCase();
    const ordered = [...classes].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"));
    if (!q) return ordered;
    return ordered.filter((item) => {
      const hay = `${item.name ?? ""} ${shiftLabel(item.shift)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [classFilter, classes]);

  const filteredTeachers = useMemo(() => {
    const q = teacherFilter.trim().toLowerCase();
    const ordered = [...teachers].sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR"));
    if (!q) return ordered;
    return ordered.filter((item) => String(item.name ?? "").toLowerCase().includes(q));
  }, [teacherFilter, teachers]);

  const stats = useMemo(
    () => ({
      classesConfigured: classes.filter((item) => String(item.default_room_id ?? "").trim()).length,
      teachersConfigured: teachers.filter((item) => String(item.default_room_id ?? "").trim()).length,
    }),
    [classes, teachers],
  );

  async function saveRoom(target: "class" | "teacher", item: RefRow) {
    setSavingKey(`${target}:${item.id}`);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/director/default-rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          target,
          id: item.id,
          default_room_id: item.default_room_id || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Não foi possível salvar a sala padrão.");
        return;
      }
      setMessage(target === "class" ? "Sala padrão da turma atualizada." : "Sala padrão do professor atualizada.");
    } catch (e: any) {
      setError(e?.message || "Erro de rede ao salvar a sala padrão.");
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Sala padrão</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Defina a sala preferencial das turmas e dos professores.
              {props.schoolName ? ` Escola: ${props.schoolName}.` : ""} Quando a opção estiver ativa em Parâmetros da grade, o Solve passa a favorecer essas salas na montagem automática.
            </p>
          </div>
          <Link
            href="/director/parametros-grade"
            className="h-10 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
          >
            Ver parâmetros da grade
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turmas com sala padrão</div>
            <div className="mt-1 text-2xl font-semibold">{stats.classesConfigured}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">de {classes.length} turmas cadastradas</div>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Professores com sala padrão</div>
            <div className="mt-1 text-2xl font-semibold">{stats.teachersConfigured}</div>
            <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">de {teachers.length} professores cadastrados</div>
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

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Sala padrão por turma</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Útil para manter a mesma turma sempre na sua sala-base quando possível.
                </p>
              </div>
              <input
                type="search"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                placeholder="Filtrar turmas"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 md:w-64 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Turma</th>
                    <th className="px-3 py-2 font-medium">Turno</th>
                    <th className="px-3 py-2 font-medium">Sala padrão</th>
                    <th className="px-3 py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClasses.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-3 py-3">{item.name ?? "Sem nome"}</td>
                      <td className="px-3 py-3">{shiftLabel(item.shift)}</td>
                      <td className="px-3 py-3">
                        <select
                          value={String(item.default_room_id ?? "")}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setClasses((current) =>
                              current.map((row) => (row.id === item.id ? { ...row, default_room_id: value } : row)),
                            );
                          }}
                          className="h-10 min-w-[220px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                        >
                          <option value="">Sem sala padrão</option>
                          {props.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name ?? "Sem nome"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => saveRoom("class", item)}
                            disabled={savingKey !== null}
                            className="h-9 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                          >
                            {savingKey === `class:${item.id}` ? "Salvando..." : "Salvar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredClasses.length === 0 ? (
                    <tr className="border-t border-zinc-100 dark:border-zinc-900">
                      <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Nenhuma turma encontrada.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Sala padrão por professor</h3>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Funciona como preferência/fallback. As habilitações por horário do professor continuam valendo normalmente.
                </p>
              </div>
              <input
                type="search"
                value={teacherFilter}
                onChange={(e) => setTeacherFilter(e.target.value)}
                placeholder="Filtrar professores"
                className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 md:w-64 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Professor</th>
                    <th className="px-3 py-2 font-medium">Sala padrão</th>
                    <th className="px-3 py-2 font-medium text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((item) => (
                    <tr key={item.id} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-3 py-3">{item.name ?? "Sem nome"}</td>
                      <td className="px-3 py-3">
                        <select
                          value={String(item.default_room_id ?? "")}
                          onChange={(e) => {
                            const value = e.target.value || null;
                            setTeachers((current) =>
                              current.map((row) => (row.id === item.id ? { ...row, default_room_id: value } : row)),
                            );
                          }}
                          className="h-10 min-w-[220px] rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                        >
                          <option value="">Sem sala padrão</option>
                          {props.rooms.map((room) => (
                            <option key={room.id} value={room.id}>
                              {room.name ?? "Sem nome"}
                            </option>
                          ))}
                        </select>
                        {item.default_room_id ? (
                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            Atual: {roomById.get(String(item.default_room_id)) || "Sala cadastrada"}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => saveRoom("teacher", item)}
                            disabled={savingKey !== null}
                            className="h-9 rounded-xl bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-60 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
                          >
                            {savingKey === `teacher:${item.id}` ? "Salvando..." : "Salvar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredTeachers.length === 0 ? (
                    <tr className="border-t border-zinc-100 dark:border-zinc-900">
                      <td colSpan={3} className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Nenhum professor encontrado.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
