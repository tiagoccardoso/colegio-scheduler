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
          className="select sm:min-w-[260px]"
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
          "btn h-10 " +
          (canLoad
            ? "btn-primary"
            : "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500")
        }
      >
        Carregar
      </button>
    </form>
  );
}
