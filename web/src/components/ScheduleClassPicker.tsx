"use client";

import { useMemo, useState } from "react";

type Shift = "MANHA" | "TARDE" | "NOITE";
type ClassRow = { id: string; name: string; shift: string | null };

function normShift(v: any): Shift {
  const k = String(v ?? "").trim().toUpperCase();
  if (k.startsWith("TAR")) return "TARDE";
  if (k.startsWith("NOI")) return "NOITE";
  return "MANHA";
}

export function ScheduleClassPicker({
  classes,
  initialClassId,
  initialShift,
}: {
  classes: ClassRow[];
  initialClassId?: string | null;
  initialShift?: string | null;
}) {
  const [selected, setSelected] = useState(initialClassId ?? "");
  const [shift, setShift] = useState<Shift>(normShift(initialShift));

  const canLoad = useMemo(() => Boolean(selected), [selected]);

  function go(next?: { classId?: string; shift?: Shift }) {
    const classId = next?.classId ?? selected;
    const s = next?.shift ?? shift;
    if (!classId) return;

    const base = window.location.pathname || "/schedule";
    const url = `${base}?classId=${encodeURIComponent(classId)}&shift=${encodeURIComponent(s)}`;
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
        <span className="text-sm font-semibold">Turno</span>
        <select
          name="shift"
          value={shift}
          onChange={(e) => setShift(normShift(e.target.value))}
          className="select w-[160px]"
        >
          <option value="MANHA">Manhã</option>
          <option value="TARDE">Tarde</option>
          <option value="NOITE">Noite</option>
        </select>
      </label>

      <label className="grid gap-2">
        <span className="text-sm font-semibold">Turma</span>
        <select
          name="classId"
          value={selected}
          onChange={(e) => {
            const id = e.target.value;
            setSelected(id);

            const cls = classes.find((c) => c.id === id);
            if (cls?.shift) setShift(normShift(cls.shift));
          }}
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
