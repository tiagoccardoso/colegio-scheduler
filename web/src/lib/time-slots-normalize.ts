type BaseTimeSlot = {
  id: string;
  weekday: number;
  shift: string | null;
  starts_at: string;
  period_index: number | null;
};

function isValidPeriodIndex(v: any) {
  return Number.isFinite(v) && v >= 1;
}

/**
 * Normaliza period_index em memória.
 *
 * Alguns bancos antigos podem ter time_slots com period_index = null.
 * A UI da Grade Semanal (drag-and-drop) depende do period_index para montar a matriz.
 *
 * Esta função:
 * - agrupa por (shift, weekday)
 * - ordena por (period_index válido primeiro) e depois por starts_at
 * - preenche valores faltantes (e resolve duplicados) de forma determinística
 *
 * OBS: Não grava no banco; é só para exibição/consistência de chave.
 */
export function normalizeTimeSlotsPeriodIndex<T extends BaseTimeSlot>(rows: T[]): T[] {
  const byGroup = new Map<string, T[]>();

  for (const r of rows) {
    const gk = `${String(r.shift || "").toUpperCase()}|${r.weekday}`;
    const arr = byGroup.get(gk) ?? [];
    arr.push(r);
    byGroup.set(gk, arr);
  }

  const out: T[] = [];
  for (const [gk, list] of byGroup.entries()) {
    const shift = gk.split("|")[0] || null;

    const sorted = [...list].sort((a, b) => {
      const ap = isValidPeriodIndex(a.period_index) ? Number(a.period_index) : 9999;
      const bp = isValidPeriodIndex(b.period_index) ? Number(b.period_index) : 9999;
      if (ap !== bp) return ap - bp;
      return String(a.starts_at).localeCompare(String(b.starts_at));
    });

    const used = new Set<number>();
    for (const r of sorted) {
      if (isValidPeriodIndex(r.period_index)) used.add(Number(r.period_index));
    }

    let next = 1;
    for (const r of sorted) {
      let p = isValidPeriodIndex(r.period_index) ? Number(r.period_index) : null;
      if (!p || used.has(p)) {
        while (used.has(next)) next += 1;
        p = next;
        used.add(p);
      }

      // Não limita aqui: se o banco tiver dados fora do esperado,
      // preferimos manter índices únicos para não quebrar a grade.
      out.push({ ...r, period_index: p } as T);
    }
  }

  // Ordena globalmente para renderização estável.
  return out.sort((a, b) => {
    const ash = String(a.shift || "").toUpperCase();
    const bsh = String(b.shift || "").toUpperCase();
    if (ash !== bsh) return ash.localeCompare(bsh);
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return Number(a.period_index ?? 0) - Number(b.period_index ?? 0);
  });
}

export function buildTimeSlotPeriodMap(rows: Array<{ id: string; period_index: number | null }>) {
  return new Map(rows.map((r) => [r.id, r.period_index ?? null]));
}
