import { Shell } from "@/components/Shell";
import { getNavSections } from "@/components/nav";
import { requireDirector } from "@/lib/require-director";
import { DirectorCalendar } from "@/components/calendar/DirectorCalendar";

export default async function DirectorCalendarPage() {
  const { supabase, profile } = await requireDirector();

  // Apenas para manter consistência da UI do Shell (menu e status de assinatura).
  // O calendário é um recurso de diretor, mas respeita a liberação do sistema.
  const { data: school } = await supabase
    .from("schools")
    .select("id,name")
    .eq("id", profile.school_id)
    .maybeSingle();

  const navSections = getNavSections({ subscribed: true });

  return (
    <Shell
      title="Calendário"
      subtitle={school?.name ? `Datas importantes — ${school.name}` : "Datas importantes"}
      isSubscribed={true}
      navSections={navSections}
      homeHref="/dashboard"
    >
      <DirectorCalendar schoolId={profile.school_id} />
    </Shell>
  );
}
