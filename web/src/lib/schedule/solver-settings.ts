export type GradeSolverSettings = {
  prefer_consecutive_weight: number;
  compact_teacher_days_weight: number;
  reduce_teacher_gaps_weight: number;
  avoid_last_period_penalty: number;
  spread_subjects_weight: number;
  respect_requirements: boolean;
  prioritize_default_room: boolean;
  updated_at?: string | null;
};

export const DEFAULT_GRADE_SOLVER_SETTINGS: GradeSolverSettings = {
  prefer_consecutive_weight: 6,
  compact_teacher_days_weight: 5,
  reduce_teacher_gaps_weight: 7,
  avoid_last_period_penalty: 4,
  spread_subjects_weight: 6,
  respect_requirements: true,
  prioritize_default_room: true,
  updated_at: null,
};

function clampInt(v: any, fallback: number, min = 0, max = 50) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeGradeSolverSettings(row: any): GradeSolverSettings {
  return {
    prefer_consecutive_weight: clampInt(
      row?.prefer_consecutive_weight,
      DEFAULT_GRADE_SOLVER_SETTINGS.prefer_consecutive_weight,
    ),
    compact_teacher_days_weight: clampInt(
      row?.compact_teacher_days_weight,
      DEFAULT_GRADE_SOLVER_SETTINGS.compact_teacher_days_weight,
    ),
    reduce_teacher_gaps_weight: clampInt(
      row?.reduce_teacher_gaps_weight,
      DEFAULT_GRADE_SOLVER_SETTINGS.reduce_teacher_gaps_weight,
    ),
    avoid_last_period_penalty: clampInt(
      row?.avoid_last_period_penalty,
      DEFAULT_GRADE_SOLVER_SETTINGS.avoid_last_period_penalty,
    ),
    spread_subjects_weight: clampInt(
      row?.spread_subjects_weight,
      DEFAULT_GRADE_SOLVER_SETTINGS.spread_subjects_weight,
    ),
    respect_requirements:
      typeof row?.respect_requirements === "boolean"
        ? row.respect_requirements
        : DEFAULT_GRADE_SOLVER_SETTINGS.respect_requirements,
    prioritize_default_room:
      typeof row?.prioritize_default_room === "boolean"
        ? row.prioritize_default_room
        : DEFAULT_GRADE_SOLVER_SETTINGS.prioritize_default_room,
    updated_at: row?.updated_at ? String(row.updated_at) : null,
  };
}
