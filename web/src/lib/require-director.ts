import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";

export type Profile = {
  user_id: string;
  school_id: string;
  role: "director" | "teacher";
  full_name: string | null;
};

export async function requireDirector() {
  const { supabase, user } = await requireAuth();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("user_id, school_id, role, full_name")
    .eq("user_id", user.id)
    .single();

  if (error || !profile) redirect("/onboarding");
  if (profile.role !== "director") redirect("/forbidden");

  return { supabase, user, profile: profile as Profile };
}
