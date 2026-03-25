import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { SchoolAddressFields } from "@/components/SchoolAddressFields";
import { requireDirector } from "@/lib/require-director";
import { decodeMsg, encodeMsg } from "@/lib/flash";

const BUCKET = "school-logos";
const logoPath = (schoolId: string) => `schools/${schoolId}/logo`;

function cleanOptionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanOptionalStateCode(value: FormDataEntryValue | null) {
  const stateCode = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : null;
}

type LogoPick = {
  path: string;
  version: string;
  size: number;
  mime?: string;
};

async function pickSchoolLogo(supabase: any, schoolId: string): Promise<LogoPick | null> {
  const base = `schools/${schoolId}`;

  const { data: top } = await supabase.storage.from(BUCKET).list(base, { limit: 100 });
  const { data: nested } = await supabase.storage.from(BUCKET).list(`${base}/logo`, { limit: 100 });

  const candidates: Array<any> = [];
  (top ?? []).forEach((it: any) => candidates.push({ where: "top", it }));
  (nested ?? []).forEach((it: any) => candidates.push({ where: "nested", it }));

  // Normalize into full paths
  const items = candidates
    .map(({ where, it }) => {
      const name = String(it?.name || "");
      const fullPath = where === "nested" ? `${base}/logo/${name}` : `${base}/${name}`;
      const size = Number(it?.metadata?.size ?? 0);
      const mime = String(it?.metadata?.mimetype ?? it?.metadata?.contentType ?? "");
      const updatedAt = String(it?.updated_at ?? it?.updatedAt ?? "");
      const version = updatedAt ? String(new Date(updatedAt).getTime()) : String(Date.now());
      return { name, path: fullPath, size, mime, version };
    })
    .filter((x) => {
      // Accept logo, logo.<ext>, or anything inside /logo/
      if (x.path.includes(`${base}/logo/`)) return true;
      return x.name === "logo" || x.name.startsWith("logo.");
    });

  // Prefer the canonical path the app uses (schools/<id>/logo)
  const preferred = items.find((x) => x.path === logoPath(schoolId));
  const byExt = items
    .filter((x) => x.name.startsWith("logo."))
    .sort((a, b) => {
      const order = ["png", "webp", "jpg", "jpeg", "svg"];
      const ea = a.name.split(".").pop() || "";
      const eb = b.name.split(".").pop() || "";
      return order.indexOf(ea) - order.indexOf(eb);
    })[0];
  const nestedFirst = items.find((x) => x.path.includes(`${base}/logo/`));

  const pick = preferred ?? byExt ?? nestedFirst;
  if (!pick) return null;

  // Treat empty or non-image payload as “no logo” (works even without DELETE policy).
  if (!pick.size || (pick.mime && !pick.mime.startsWith("image/"))) return null;

  return pick;
}

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
  const pendingEmail = typeof sp.pending_email === "string" ? sp.pending_email : null;

  const { data: school } = await supabase
    .from("schools")
    .select("id,name,public_enrollment_visible,zip_code,address_street,address_number,address_complement,address_neighborhood,city,state_code")
    .eq("id", profile.school_id)
    .maybeSingle();

  const pickedLogo = await pickSchoolLogo(supabase, profile.school_id);
  const { data: logoPublic } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(pickedLogo?.path ?? logoPath(profile.school_id));
  const logoUrl = pickedLogo?.path && logoPublic?.publicUrl
    ? `${logoPublic.publicUrl}?v=${bust || pickedLogo.version}`
    : null;


  async function saveAction(formData: FormData) {
    "use server";

    const { supabase, user, profile } = await requireDirector();

    const full_name = String(formData.get("full_name") || "").trim();
    const school_name = String(formData.get("school_name") || "").trim();
    const public_enrollment_visible = formData.get("public_enrollment_visible") === "on";
    const zip_code = cleanOptionalText(formData.get("zip_code"));
    const address_street = cleanOptionalText(formData.get("address_street"));
    const address_number = cleanOptionalText(formData.get("address_number"));
    const address_complement = cleanOptionalText(formData.get("address_complement"));
    const address_neighborhood = cleanOptionalText(formData.get("address_neighborhood"));
    const state_code = cleanOptionalStateCode(formData.get("state_code"));
    const city = cleanOptionalText(formData.get("city"));
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
          public_enrollment_visible,
          zip_code,
          address_street,
          address_number,
          address_complement,
          address_neighborhood,
          city,
          state_code,
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

  async function requestEmailChangeAction(formData: FormData) {
    "use server";

    const { supabase } = await requireDirector();
    const newEmail = String(formData.get("new_email") || "").trim().toLowerCase();
    if (!newEmail || !newEmail.includes("@")) {
      redirect("/director?error=" + encodeMsg("Informe um e-mail válido."));
    }

    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const emailRedirectTo = `${origin}/auth/callback?next=/director`;

    const { error } = await supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo });
    if (error) redirect("/director?error=" + encodeMsg(error.message));

    redirect(
      "/director?msg=" +
        encodeMsg("Enviamos um link de confirmação para o novo e-mail.") +
        `&pending_email=${encodeURIComponent(newEmail)}`,
    );
  }

  async function resendEmailChangeAction(formData: FormData) {
    "use server";

    const { supabase } = await requireDirector();
    const newEmail = String(formData.get("pending_email") || "").trim().toLowerCase();
    if (!newEmail || !newEmail.includes("@")) {
      redirect("/director?error=" + encodeMsg("Informe um e-mail válido para reenviar."));
    }

    const h = await headers();
    const origin = h.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const emailRedirectTo = `${origin}/auth/callback?next=/director`;

    // @ts-ignore: tipos variam por versão, mas a API existe no supabase-js v2
    const { error } = await supabase.auth.resend({ type: "email_change", email: newEmail, options: { emailRedirectTo } });
    if (error) redirect("/director?error=" + encodeMsg(error.message));

    redirect(
      "/director?msg=" +
        encodeMsg("Reenviamos o link de confirmação.") +
        `&pending_email=${encodeURIComponent(newEmail)}`,
    );
  }

  async function removeLogoAction() {
    "use server";

    const { supabase, profile } = await requireDirector();
    const base = `schools/${profile.school_id}`;

    const { data: top } = await supabase.storage.from(BUCKET).list(base, { limit: 100 });
    const { data: nested } = await supabase.storage.from(BUCKET).list(`${base}/logo`, { limit: 100 });

    const paths: string[] = [];
    (top ?? []).forEach((it: any) => {
      const name = String(it?.name || "");
      if (name === "logo" || name.startsWith("logo.")) paths.push(`${base}/${name}`);
    });
    (nested ?? []).forEach((it: any) => {
      const name = String(it?.name || "");
      if (name) paths.push(`${base}/logo/${name}`);
    });

    // Fallback: se não encontramos nada, ainda assim tentamos no caminho padrão.
    if (paths.length === 0) paths.push(logoPath(profile.school_id));

    // 1) Tenta apagar (funciona se você ativou a policy de DELETE).
    const { error: delError } = await supabase.storage.from(BUCKET).remove(paths);

    // 2) Se não puder apagar (RLS), sobrescreve com payload vazio e a UI trata como "Sem logo".
    if (delError) {
      const empty = new Blob([]);
      for (const p of paths) {
        await supabase.storage.from(BUCKET).upload(p, empty, {
          upsert: true,
          contentType: "application/octet-stream",
        });
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/director");
    redirect(
      "/director?msg=" +
        encodeMsg("Logomarca removida!") +
        `&v=${Date.now()}`,
    );
  }

  async function updatePasswordAction(formData: FormData) {
    "use server";

    const { supabase } = await requireDirector();
    const p1 = String(formData.get("new_password") || "");
    const p2 = String(formData.get("new_password2") || "");

    if (!p1 || p1.length < 6) {
      redirect("/director?error=" + encodeMsg("A nova senha deve ter pelo menos 6 caracteres."));
    }
    if (p1 !== p2) {
      redirect("/director?error=" + encodeMsg("As senhas não conferem."));
    }

    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (error) redirect("/director?error=" + encodeMsg(error.message));

    redirect("/director?msg=" + encodeMsg("Senha alterada!") + `&v=${Date.now()}`);
  }

  return (
    <Shell title="Perfil do diretor" subtitle="Edite seus dados e personalize a logomarca do colégio">
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Equipe pedagógica</h2>
              <p className="muted mt-1 text-sm">
                Cadastre pessoas para acessar Cadastros e Relatórios. O acesso ao Painel do diretor e Assinaturas fica restrito ao seu login.
              </p>
            </div>

            <Link href="/director/equipe-pedagogica" className="btn btn-primary">
              Equipe pedagógica
            </Link>
          </div>
        </section>

        <form action={saveAction} className="grid gap-4">
          <section className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Seu perfil</h2>
                <p className="muted mt-1 text-sm">Esses dados aparecem como referência no painel.</p>
              </div>

              <div className="panel-inner px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">
                <div className="font-semibold">Conta</div>
                <div className="mt-1 break-all">{user.email ?? ""}</div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nome do diretor</span>
                <input name="full_name" defaultValue={profile.full_name ?? ""} className="input" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">E-mail atual</span>
                <input value={user.email ?? ""} readOnly className="input opacity-80" />
              </label>
            </div>

            <div className="mt-4 panel-inner p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">Trocar e-mail</div>
                  <p className="muted mt-1 text-sm">
                    A troca precisa de confirmação via e-mail. Enquanto isso, seu e-mail atual continua valendo.
                  </p>
                  {pendingEmail ? (
                    <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                      Pendente: <span className="font-semibold">{pendingEmail}</span>
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Novo e-mail</span>
                  <input
                    name="new_email"
                    type="email"
                    placeholder="seu-novo@email.com"
                    defaultValue={pendingEmail ?? ""}
                    className="input"
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button type="submit" formAction={requestEmailChangeAction} className="btn btn-secondary">
                    Solicitar troca
                  </button>

                  <input type="hidden" name="pending_email" value={pendingEmail ?? ""} />
                  <button
                    type="submit"
                    formAction={resendEmailChangeAction}
                    className="btn btn-ghost"
                    disabled={!pendingEmail}
                    title={!pendingEmail ? "Nenhuma troca pendente" : ""}
                  >
                    Reenviar confirmação
                  </button>
                </div>
              </div>
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

            <div className="mt-4 panel-inner p-4">
              <div>
                <div className="text-sm font-semibold">Endereço da escola</div>
                <p className="muted mt-1 text-sm">Preencha o endereço completo para manter o cadastro institucional atualizado.</p>
              </div>

              <SchoolAddressFields
                defaultValues={{
                  zipCode: (school as any)?.zip_code ?? "",
                  street: (school as any)?.address_street ?? "",
                  number: (school as any)?.address_number ?? "",
                  complement: (school as any)?.address_complement ?? "",
                  neighborhood: (school as any)?.address_neighborhood ?? "",
                  city: (school as any)?.city ?? "",
                  stateCode: (school as any)?.state_code ?? "",
                }}
              />
            </div>

            <div className="mt-4 panel-inner p-4">
              <label className="flex items-start gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                <input
                  name="public_enrollment_visible"
                  type="checkbox"
                  defaultChecked={(school as any)?.public_enrollment_visible !== false}
                  className="mt-1 h-4 w-4"
                />
                <span className="grid gap-1">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Mostrar este colégio na lista pública de escolas disponíveis para matrícula
                  </span>
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Desmarque esta opção se você quiser ocultar o colégio da vitrine pública de matrículas.
                    As solicitações já recebidas continuam salvas normalmente.
                  </span>
                </span>
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

                <button
                  type="submit"
                  formAction={removeLogoAction}
                  className="btn btn-danger"
                  disabled={!logoUrl}
                  title={!logoUrl ? "Nenhuma logomarca enviada" : ""}
                >
                  Remover
                </button>
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

          <section className="panel p-5">
            <h2 className="text-lg font-semibold">Segurança</h2>
            <p className="muted mt-1 text-sm">Troque sua senha sempre que precisar.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nova senha</span>
                <input name="new_password" type="password" className="input" placeholder="••••••" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Confirmar nova senha</span>
                <input name="new_password2" type="password" className="input" placeholder="••••••" />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">Mínimo de 6 caracteres.</p>
              <button type="submit" formAction={updatePasswordAction} className="btn btn-secondary">
                Alterar senha
              </button>
            </div>
          </section>

          <div className="panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="muted">As mudanças refletem no painel e nos relatórios.</p>
              <button type="submit" className="btn btn-primary">
                Salvar alterações
              </button>
            </div>
          </div>
        </form>
      </div>
    </Shell>
  );
}
