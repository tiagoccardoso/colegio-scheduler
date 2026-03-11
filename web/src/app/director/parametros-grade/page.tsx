import { Shell } from "@/components/Shell";
import { getNavSections } from "@/components/nav";
import { requireDirector } from "@/lib/require-director";
import {
  DEFAULT_GRADE_SOLVER_SETTINGS,
  normalizeGradeSolverSettings,
} from "@/lib/schedule/solver-settings";
import { GradeParametersClient } from "@/components/GradeParametersClient";

export default async function GradeParametersPage() {
  const { supabase, profile } = await requireDirector();

  const [{ data: school }, { data: settingsRow }, { data: matrixRows }, { data: classes }, { data: teachers }] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", profile.school_id).maybeSingle(),
    supabase
      .from("schedule_solver_settings")
      .select("*")
      .eq("school_id", profile.school_id)
      .maybeSingle(),
    supabase.from("class_subject_requirements").select("class_id").eq("school_id", profile.school_id),
    supabase.from("classes").select("id,default_room_id").eq("school_id", profile.school_id),
    supabase.from("teachers").select("id,default_room_id").eq("school_id", profile.school_id),
  ]);

  const navSections = getNavSections({ subscribed: true });

  return (
    <Shell
      title="Parâmetros da grade"
      subtitle="Configure as heurísticas do Solve e execute a montagem automática com as regras da escola."
      isSubscribed={true}
      navSections={navSections}
      homeHref="/dashboard"
    >
      <GradeParametersClient
        initialSettings={normalizeGradeSolverSettings(settingsRow ?? DEFAULT_GRADE_SOLVER_SETTINGS)}
        schoolName={school?.name ?? null}
        status={{
          matrixEntries: ((matrixRows as any[]) ?? []).length,
          classesWithMatrix: new Set((((matrixRows as any[]) ?? []).map((row) => String((row as any)?.class_id ?? "")).filter(Boolean))).size,
          classesWithDefaultRoom: (((classes as any[]) ?? []).filter((row) => String((row as any)?.default_room_id ?? "").trim()).length),
          teachersWithDefaultRoom: (((teachers as any[]) ?? []).filter((row) => String((row as any)?.default_room_id ?? "").trim()).length),
        }}
      />
    </Shell>
  );
}
