import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { isStaffRole, type StaffRole } from "@/lib/authz";

export type StaffProfile = {
  user_id: string;
  school_id: string;
  role: StaffRole;
  full_name: string | null;
};

export async function requireStaff() {
  const { supabase, user } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, school_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile) redirect("/onboarding");

  const role = (profile as any)?.role;
  if (!isStaffRole(role)) redirect("/forbidden");

  // Equipe pedagógica pode ser inativada pelo diretor.
  // Segurança (RLS) deve reforçar isso, mas aqui garantimos o bloqueio na UI também.
  if (role === "pedagogical") {
    const res = await supabase
      .from("pedagogical_team")
      .select("disabled_at")
      .eq("user_id", user.id)
      .maybeSingle();

    // Se a tabela/coluna ainda não existe, não quebramos o app.
    if (!res.error) {
      const disabledAt = (res.data as any)?.disabled_at;
      if (disabledAt) redirect("/forbidden");
    }
  }

  return { supabase, user, profile: profile as StaffProfile };
}
