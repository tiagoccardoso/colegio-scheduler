import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireDirector } from "@/lib/require-director";
import { decodeMsg, encodeMsg } from "@/lib/flash";

const BUCKET = "school-logos";
const logoPath = (schoolId: string) => `schools/${schoolId}/logo`;

export default async function DirectorProfilePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;
  const bust = typeof sp.v === "string" ? sp.v : "";

  const { data: school } = await supabase
    .from("schools")
    .select("id,name")
    .eq("id", profile.school_id)
    .maybeSingle();

  const { data: logoPublic } = supabase.storage.from(BUCKET).getPublicUrl(logoPath(profile.school_id));
  const logoUrl = logoPublic?.publicUrl ? `${logoPublic.publicUrl}${bust ? `?v=${bust}` : ""}` : null;

  async function saveAction(formData: FormData) {
    "use server";

    const { supabase, user, profile } = await requireDirector();

    const full_name = String(formData.get("full_name") || "").trim();
    const school_name = String(formData.get("school_name") || "").trim();
    const logo = formData.get("logo") as File | null;

    if (!full_name) redirect("/director?error=" + encodeMsg("Informe seu nome."));
    if (!school_name) redirect("/director?error=" + encodeMsg("Informe o nome do colégio."));

    // Atualiza colégio
    const { error: schoolError } = await supabase
      .from("schools")
      .upsert(
        {
          id: profile.school_id,
          name: school_name,
        },
        { onConflict: "id" },
      );

    if (schoolError) redirect("/director?error=" + encodeMsg(schoolError.message));

    // Atualiza perfil do diretor
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name })
      .eq("user_id", user.id);

    if (profileError) redirect("/director?error=" + encodeMsg(profileError.message));

    // Upload (opcional) da logomarca
    if (logo && typeof logo === "object" && "size" in logo && logo.size > 0) {
      // Limite de bom senso: 2MB
      if (logo.size > 2 * 1024 * 1024) {
        redirect(
          "/director?error=" +
            encodeMsg("Arquivo muito grande. Envie uma imagem de até 2MB."),
        );
      }

      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(logoPath(profile.school_id), logo, {
        upsert: true,
        contentType: (logo as any).type || undefined,
      });

      if (uploadError) {
        redirect(
          "/director?error=" +
            encodeMsg(
              uploadError.message ||
                `Não foi possível enviar a logomarca. Verifique se o bucket “${BUCKET}” existe e está acessível.`,
            ),
        );
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/director");
    redirect(
      "/director?msg=" +
        encodeMsg("Perfil atualizado!") +
        `&v=${Date.now()}`,
    );
  }

  return (
    <Shell title="Perfil do diretor" subtitle="Edite seus dados e personalize a logomarca do colégio">
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}

        <form action={saveAction} className="grid gap-4">
          <section className="panel p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Seu perfil</h2>
                <p className="muted mt-1 text-sm">Esses dados aparecem como referência no painel.</p>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                <div className="font-semibold">Conta</div>
                <div className="mt-1">{user.email ?? ""}</div>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nome do diretor</span>
                <input name="full_name" defaultValue={profile.full_name ?? ""} className="input" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">E-mail</span>
                <input value={user.email ?? ""} readOnly className="input opacity-80" />
              </label>
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Colégio</h2>
            <p className="muted mt-1 text-sm">Nome do colégio aparece em relatórios e impressões.</p>

            <div className="mt-4 grid gap-3 md:grid-cols-1">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nome do colégio</span>
                <input name="school_name" defaultValue={(school as any)?.name ?? ""} className="input" />
              </label>
            </div>
          </section>

          <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Logomarca</h2>
                <p className="muted mt-1 text-sm">
                  Envie uma imagem (PNG/JPG). Dica: use fundo transparente para ficar elegante.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="grid h-14 w-14 place-items-center overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logomarca atual" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs font-semibold text-zinc-500">Sem logo</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              <input
                type="file"
                name="logo"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="block w-full text-sm file:mr-4 file:rounded-2xl file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800 dark:file:bg-white dark:file:text-zinc-950 dark:hover:file:bg-zinc-200"
              />
              <p className="text-xs text-zinc-500">Tamanho sugerido: até 512×512 (máx. 2MB).</p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary">
              Salvar alterações
            </button>
            <p className="muted text-sm">As mudanças refletem no painel e nos relatórios.</p>
          </div>
        </form>
      </div>
    </Shell>
  );
}
