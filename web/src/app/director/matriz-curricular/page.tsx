import { Shell } from "@/components/Shell";
import { getNavSections } from "@/components/nav";
import { CurriculumMatrixClient } from "@/components/CurriculumMatrixClient";
import { requireDirector } from "@/lib/require-director";

export default async function DirectorCurriculumMatrixPage() {
  const { supabase, profile } = await requireDirector();

  const [{ data: school }, { data: classes }, { data: subjects }, { data: rows }] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", profile.school_id).maybeSingle(),
    supabase
      .from("classes")
      .select("id,name,shift")
      .eq("school_id", profile.school_id)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("subjects")
      .select("id,name")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true }),
    supabase
      .from("class_subject_requirements")
      .select("id,class_id,subject_id,lessons_per_week")
      .eq("school_id", profile.school_id),
  ]);

  return (
    <Shell
      title="Matriz Curricular"
      subtitle="Cadastre a carga semanal por disciplina e turma para orientar a montagem automática da grade."
      isSubscribed={true}
      navSections={getNavSections({ subscribed: true })}
      homeHref="/dashboard"
    >
      <CurriculumMatrixClient
        schoolName={school?.name ?? null}
        classes={((classes as any[]) ?? []).map((item) => ({
          id: String(item.id),
          name: item.name ? String(item.name) : null,
          shift: item.shift ? String(item.shift) : null,
        }))}
        subjects={((subjects as any[]) ?? []).map((item) => ({
          id: String(item.id),
          name: item.name ? String(item.name) : null,
        }))}
        initialRows={((rows as any[]) ?? []).map((item) => ({
          id: String(item.id),
          class_id: String(item.class_id),
          subject_id: String(item.subject_id),
          lessons_per_week: Number(item.lessons_per_week ?? 0),
        }))}
      />
    </Shell>
  );
}
