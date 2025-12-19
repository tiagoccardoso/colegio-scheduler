"use client";

import { useMemo, useState } from "react";

type ClassRow = { id: string; name: string; shift: string | null };

export function ScheduleClassPicker({
  classes,
  initialClassId,
}: {
  classes: ClassRow[];
  initialClassId?: string | null;
}) {
  const [selected, setSelected] = useState(initialClassId ?? "");

  const canLoad = useMemo(() => Boolean(selected), [selected]);

  function go() {
    if (!selected) return;
    const base = window.location.pathname || "/schedule";
    const url = `${base}?classId=${encodeURIComponent(selected)}`;
    window.location.assign(url);
  }

  return (
    <form
      method="GET"
      onSubmit={(e) => {
        if (!selected) {
          e.preventDefault();
          return;
        }
        // With JS enabled, force a full navigation (most robust across dev/prod setups).
        e.preventDefault();
        go();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="grid gap-2">
        <span className="text-sm font-semibold">Turma</span>
        <select
          name="classId"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600 dark:focus:ring-zinc-600/30 sm:min-w-[260px]"
        >
          <option value="" disabled>
            Selecione...
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.shift ? `(${c.shift})` : ""}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        onClick={() => {
          // Extra safety: some browsers/users click faster than submit fires.
          if (canLoad) go();
        }}
        disabled={!canLoad}
        className={
          "h-10 rounded-xl px-4 text-sm font-semibold transition " +
          (canLoad
            ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            : "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500")
        }
      >
        Carregar
      </button>
    </form>
  );
}
