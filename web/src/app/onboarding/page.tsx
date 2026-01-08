
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/require-auth";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { encodeMsg, decodeMsg } from "@/lib/flash";

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, user } = await requireAuth();
  const sp = (await searchParams) ?? {};


  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  async function finishAction(formData: FormData) {
    "use server";
    const { supabase, user } = await requireAuth();

    const full_name = String(formData.get("full_name") || "").trim();
    const school_name = String(formData.get("school_name") || "").trim();
    const term_label = String(formData.get("term_label") || "").trim();

    if (!full_name) redirect("/onboarding?error=" + encodeMsg("Informe seu nome."));
    if (!school_name) redirect("/onboarding?error=" + encodeMsg("Informe o nome do colégio."));

    // school_id = user.id (modelo 1 diretor -> 1 colégio)
    const school_id = user.id;

    // create school row (best-effort)
    await supabase.from("schools").upsert({ id: school_id, name: school_name, term_label: term_label || null }, { onConflict: "id" });

    // create/update profile
    const { error } = await supabase.from("profiles").upsert(
      { user_id: user.id, school_id, role: "director", full_name },
      { onConflict: "user_id" }
    );

    if (error) redirect("/onboarding?error=" + encodeMsg(error.message));

    revalidatePath("/dashboard");
    redirect("/dashboard?msg=" + encodeMsg("Cadastro concluído!"));
  }

  return (
    <Shell title="Finalizar cadastro" subtitle="Crie o colégio e conclua seu perfil para usar o sistema">
      {msg ? <Flash message={msg} variant="success" /> : null}
      {error ? <Flash message={error} variant="error" /> : null}

      <form action={finishAction} className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Seu nome</span>
          <input name="full_name" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950" />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Nome do colégio</span>
          <input name="school_name" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950" />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Período (opcional)</span>
          <input name="term_label" placeholder="Ex: 2º SEMESTRE 2025-2" className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950" />
        </label>

        <button type="submit" className="mt-2 w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white">
          Concluir
        </button>
      </form>
    </Shell>
  );
}
