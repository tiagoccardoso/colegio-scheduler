"use client";

import { useMemo, useState } from "react";

type TeacherRow = { id: string; name: string | null };

export function ScheduleTeacherPicker({
  teachers,
  initialTeacherId,
  label = "Professor",
}: {
  teachers: TeacherRow[];
  initialTeacherId?: string | null;
  label?: string;
}) {
  const [selected, setSelected] = useState(initialTeacherId ?? "");

  const canLoad = useMemo(() => Boolean(selected), [selected]);

  function go(id: string) {
    const base = window.location.pathname || "/schedule";
    const url = `${base}?teacherId=${encodeURIComponent(id)}`;
    window.location.assign(url);
  }

  function clear() {
    const base = window.location.pathname || "/schedule";
    window.location.assign(base);
  }

  return (
    <form
      method="GET"
      onSubmit={(e) => {
        e.preventDefault();
        if (!selected) return;
        go(selected);
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="grid gap-2">
        <span className="text-sm font-semibold">{label}</span>
        <select
          name="teacherId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/30 sm:min-w-[320px]"
        >
          <option value="">Todos</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name ?? "(sem nome)"}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={!canLoad}
        onClick={() => {
          if (canLoad) go(selected);
        }}
        className={
          "h-10 rounded-xl px-4 text-sm font-semibold transition " +
          (canLoad
            ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            : "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500")
        }
      >
        Filtrar
      </button>

      <button
        type="button"
        onClick={() => {
          setSelected("");
          clear();
        }}
        className="h-10 rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        Limpar
      </button>
    </form>
  );
}
