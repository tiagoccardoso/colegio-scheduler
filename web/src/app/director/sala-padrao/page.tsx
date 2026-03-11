import { Shell } from "@/components/Shell";
import { getNavSections } from "@/components/nav";
import { DefaultRoomsClient } from "@/components/DefaultRoomsClient";
import { requireDirector } from "@/lib/require-director";

export default async function DirectorDefaultRoomsPage() {
  const { supabase, profile } = await requireDirector();

  const [{ data: school }, { data: classes }, { data: teachers }, { data: rooms }] = await Promise.all([
    supabase.from("schools").select("id,name").eq("id", profile.school_id).maybeSingle(),
    supabase
      .from("classes")
      .select("id,name,shift,default_room_id")
      .eq("school_id", profile.school_id)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase
      .from("teachers")
      .select("id,name,default_room_id")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true }),
    supabase
      .from("rooms")
      .select("id,name")
      .eq("school_id", profile.school_id)
      .order("name", { ascending: true }),
  ]);

  return (
    <Shell
      title="Sala Padrão"
      subtitle="Centralize as salas-base de turmas e professores para apoiar a parametrização da grade."
      isSubscribed={true}
      navSections={getNavSections({ subscribed: true })}
      homeHref="/dashboard"
    >
      <DefaultRoomsClient
        schoolName={school?.name ?? null}
        classes={((classes as any[]) ?? []).map((item) => ({
          id: String(item.id),
          name: item.name ? String(item.name) : null,
          shift: item.shift ? String(item.shift) : null,
          default_room_id: item.default_room_id ? String(item.default_room_id) : null,
        }))}
        teachers={((teachers as any[]) ?? []).map((item) => ({
          id: String(item.id),
          name: item.name ? String(item.name) : null,
          default_room_id: item.default_room_id ? String(item.default_room_id) : null,
        }))}
        rooms={((rooms as any[]) ?? []).map((item) => ({
          id: String(item.id),
          name: item.name ? String(item.name) : null,
        }))}
      />
    </Shell>
  );
}
