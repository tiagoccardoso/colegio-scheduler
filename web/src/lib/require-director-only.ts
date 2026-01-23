import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { isDirectorRole } from "@/lib/authz";

export type DirectorProfile = {
  user_id: string;
  school_id: string;
  role: "director";
  full_name: string | null;
};

export async function requireDirectorOnly() {
  const { supabase, user } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, school_id, role, full_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !profile) redirect("/onboarding");
  if (!isDirectorRole((profile as any)?.role)) redirect("/forbidden");

  return { supabase, user, profile: profile as DirectorProfile };
}
