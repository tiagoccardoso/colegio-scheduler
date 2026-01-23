import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { getNavSections } from "@/components/nav";
import { requireStaff } from "@/lib/require-staff";
import { getEffectiveAccess } from "@/lib/billing";
import { TeamProfileForm } from "./TeamProfileForm";

export default async function TeamPage() {
  const { supabase, user, profile } = await requireStaff();

  // Apenas equipe pedagógica
  if (profile.role !== "pedagogical") redirect("/forbidden");

  const access = await getEffectiveAccess({
    supabase: supabase as any,
    profile: {
      user_id: profile.user_id,
      school_id: profile.school_id,
      role: profile.role as any,
      full_name: profile.full_name,
    },
  });

  const navSections = getNavSections({ subscribed: access.active });

  return (
    <Shell
      title="Painel da equipe"
      subtitle="Gerencie seus dados de acesso"
      isSubscribed={access.active}
      navSections={navSections}
      homeHref="/dashboard"
    >
      <div className="grid gap-4">
        <TeamProfileForm userId={user.id} initialName={profile.full_name ?? ""} initialEmail={user.email ?? ""} />
      </div>
    </Shell>
  );
}
