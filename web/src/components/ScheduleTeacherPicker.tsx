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
          className="select sm:min-w-[320px]"
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
          "btn h-10 " +
          (canLoad
            ? "btn-primary"
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
        className="btn btn-secondary h-10"
      >
        Limpar
      </button>
    </form>
  );
}
