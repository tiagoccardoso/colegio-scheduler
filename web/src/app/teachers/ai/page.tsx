import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { TeacherScheduleAIBuilder } from "@/components/TeacherScheduleAIBuilder";

type SearchParams = Record<string, string | string[] | undefined>;

type TeacherRow = {
  id: string;
  name: string | null;
  restrictions: string | null;
  teaching_rules: any | null;
  default_room_id: string | null;
};

export default async function Page({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const teacherId = typeof sp.teacherId === "string" ? sp.teacherId : null;
  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  if (!teacherId) {
    redirect("/teachers?error=" + encodeMsg("Informe o teacherId na URL."));
  }

  const { data: teacher, error: tErr } = await supabase
    .from("teachers")
    .select("id,name,restrictions,teaching_rules,default_room_id")
    .eq("id", teacherId)
    .eq("school_id", profile.school_id)
    .maybeSingle();

  if (tErr || !teacher) {
    redirect("/teachers?error=" + encodeMsg("Professor não encontrado."));
  }

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: classes } = await supabase
    .from("classes")
    .select("id,name,shift,default_room_id")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("id,weekday,starts_at,ends_at,shift,period_index")
    .eq("school_id", profile.school_id)
    .order("weekday", { ascending: true })
    .order("starts_at", { ascending: true });

  const enabled = process.env.AI_SCHEDULER_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY);

  return (
    <Shell title="Horários do professor (IA)">
      <div className="grid gap-4">
        <Flash message={error || msg} variant={error ? "error" : msg ? "success" : "info"} />

        <TeacherScheduleAIBuilder
          enabled={enabled}
          teacher={teacher as TeacherRow}
          subjects={(subjects as any[]) ?? []}
          rooms={(rooms as any[]) ?? []}
          classes={(classes as any[]) ?? []}
          timeSlots={(timeSlots as any[]) ?? []}
        />
      </div>
    </Shell>
  );
}
