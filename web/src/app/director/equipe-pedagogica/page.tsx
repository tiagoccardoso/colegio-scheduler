import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { requireDirectorOnly } from "@/lib/require-director-only";
import { createAdminClient } from "@/lib/supabase/admin";

type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  disabled_at: string | null;
};

function isCourtesyActive(override: { access_override?: string | null; access_override_until?: string | null } | null) {
  if (!override) return false;
  if (override.access_override !== "complimentary") return false;
  if (!override.access_override_until) return true;
  const until = new Date(String(override.access_override_until));
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > Date.now();
}

function isMissingTable(err: any) {
  const code = String(err?.code ?? "");
  const msg = String(err?.message ?? "").toLowerCase();
  return code === "42P01" || (msg.includes("relation") && msg.includes("does not exist")) || msg.includes("does not exist");
}

export default async function PedagogicalTeamPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { profile } = await requireDirectorOnly();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const admin = createAdminClient();

  // Lista a equipe pedagógica do colégio (bypass RLS com service role)
  // Preferência: tabela própria (pedagogical_team). Fallback: profiles.role = 'pedagogical'
  let teamRows: any[] = [];
  const teamRes = await admin
    .from("pedagogical_team")
    .select("user_id, full_name, disabled_at")
    .eq("school_id", profile.school_id)
    .order("full_name", { ascending: true });

  if (teamRes.error) {
    const { data: fallback } = await admin
      .from("profiles")
      .select("user_id, full_name")
      .eq("school_id", profile.school_id)
      .eq("role", "pedagogical")
      .order("full_name", { ascending: true });

    teamRows = (fallback as any[]) ?? [];
  } else {
    teamRows = (teamRes.data as any[]) ?? [];
  }

  // Se o diretor está com cortesia ativa (override), replicamos essa liberação para a equipe pedagógica.
  // Assim, a equipe herda exatamente a mesma condição de uso do sistema.
  try {
    const { data: directorOverride, error: ovErr } = await admin
      .from("user_access_overrides")
      .select("access_override, access_override_until")
      .eq("user_id", profile.user_id)
      .maybeSingle();

    if (!ovErr) {
      const active = isCourtesyActive((directorOverride as any) ?? null);
      const noteMarker = `inherited_from_director:${profile.user_id}`;
      const teamUserIds = (teamRows ?? [])
        .map((p) => String((p as any)?.user_id ?? "").trim())
        .filter((id) => id && id !== profile.user_id);

      if (teamUserIds.length) {
        if (active) {
          // Upsert em lote não existe aqui; fazemos uma chamada por usuário.
          await Promise.all(
            teamUserIds.map((uid) =>
              admin
                .from("user_access_overrides")
                .upsert(
                  {
                    user_id: uid,
                    access_override: "complimentary",
                    access_override_until: (directorOverride as any)?.access_override_until ?? null,
                    note: noteMarker,
                  },
                  { onConflict: "user_id" },
                ),
            ),
          );
        } else {
          // Remove apenas overrides que nós mesmos criamos por herança.
          await admin
            .from("user_access_overrides")
            .delete()
            .in("user_id", teamUserIds)
            .eq("note", noteMarker);
        }
      }
    }
  } catch {
    // Se a tabela não existir ou houver qualquer erro, não quebra a página.
  }

  const members: TeamMember[] = await Promise.all(
    (teamRows ?? []).map(async (p) => {
      const userId = String((p as any)?.user_id || "");
      let email: string | null = null;
      try {
        const { data } = await admin.auth.admin.getUserById(userId);
        email = (data?.user?.email as string | undefined) ?? null;
      } catch {
        email = null;
      }
      return {
        user_id: userId,
        full_name: (p as any)?.full_name ?? null,
        email,
        disabled_at: (p as any)?.disabled_at ?? null,
      };
    }),
  );

  async function setMemberStatusAction(formData: FormData) {
    "use server";

    const { profile } = await requireDirectorOnly();
    const admin = createAdminClient();

    const user_id = String(formData.get("user_id") || "").trim();
    const action = String(formData.get("action") || "").trim();

    if (!user_id) redirect("/director/equipe-pedagogica?error=" + encodeMsg("ID inválido."));
    if (user_id === profile.user_id) {
      redirect(
        "/director/equipe-pedagogica?error=" + encodeMsg("Você não pode inativar o próprio usuário do diretor."),
      );
    }

    // Garante que o membro pertença à escola
    const { data: pRow } = await admin
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const schoolId = String((pRow as any)?.school_id ?? "");
    if (!schoolId || schoolId !== profile.school_id) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Este usuário não pertence ao seu colégio (ou não possui perfil)."),
      );
    }

    if (String((pRow as any)?.role ?? "") === "director") {
      redirect(
        "/director/equipe-pedagogica?error=" + encodeMsg("Não é permitido inativar um diretor."),
      );
    }

    if (action === "deactivate") {
      const now = new Date().toISOString();
      const { error: upErr } = await admin
        .from("pedagogical_team")
        .upsert(
          {
            user_id,
            school_id: profile.school_id,
            disabled_at: now,
            disabled_by: profile.user_id,
          },
          { onConflict: "user_id" },
        );

      if (upErr) {
        redirect(
          "/director/equipe-pedagogica?error=" +
            encodeMsg(
              "Falha ao inativar membro. Rode db/pedagogical_team.sql no Supabase. Detalhe: " + upErr.message,
            ),
        );
      }

      revalidatePath("/director/equipe-pedagogica");
      redirect("/director/equipe-pedagogica?msg=" + encodeMsg("Membro inativado."));
    }

    if (action === "activate") {
      const { error: upErr } = await admin
        .from("pedagogical_team")
        .update({ disabled_at: null, disabled_by: null })
        .eq("user_id", user_id)
        .eq("school_id", profile.school_id);

      if (upErr) {
        redirect(
          "/director/equipe-pedagogica?error=" +
            encodeMsg(
              "Falha ao reativar membro. Rode db/pedagogical_team.sql no Supabase. Detalhe: " + upErr.message,
            ),
        );
      }

      revalidatePath("/director/equipe-pedagogica");
      redirect("/director/equipe-pedagogica?msg=" + encodeMsg("Membro reativado."));
    }

    redirect("/director/equipe-pedagogica?error=" + encodeMsg("Ação inválida."));
  }

  async function deleteMemberAction(formData: FormData) {
    "use server";

    const { profile } = await requireDirectorOnly();
    const admin = createAdminClient();

    const user_id = String(formData.get("user_id") || "").trim();
    if (!user_id) redirect("/director/equipe-pedagogica?error=" + encodeMsg("ID inválido."));
    if (user_id === profile.user_id) {
      redirect(
        "/director/equipe-pedagogica?error=" + encodeMsg("Você não pode excluir o próprio usuário do diretor."),
      );
    }

    const { data: pRow } = await admin
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const schoolId = String((pRow as any)?.school_id ?? "");
    if (!schoolId || schoolId !== profile.school_id) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Este usuário não pertence ao seu colégio (ou não possui perfil)."),
      );
    }

    if (String((pRow as any)?.role ?? "") === "director") {
      redirect(
        "/director/equipe-pedagogica?error=" + encodeMsg("Não é permitido excluir um diretor."),
      );
    }

    // Limpeza (best-effort)
    await admin.from("user_access_overrides").delete().eq("user_id", user_id);
    await admin.from("pedagogical_team").delete().eq("user_id", user_id);
    await admin.from("profiles").delete().eq("user_id", user_id);

    try {
      await admin.auth.admin.deleteUser(user_id);
    } catch {
      // ignore
    }

    revalidatePath("/director/equipe-pedagogica");
    redirect("/director/equipe-pedagogica?msg=" + encodeMsg("Acesso excluído."));
  }

  async function createMemberAction(formData: FormData) {
    "use server";

    const { profile } = await requireDirectorOnly();
    const admin = createAdminClient();

    const full_name = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const password2 = String(formData.get("password2") || "");

    if (!full_name) redirect("/director/equipe-pedagogica?error=" + encodeMsg("Informe o nome."));
    if (!email || !email.includes("@"))
      redirect("/director/equipe-pedagogica?error=" + encodeMsg("Informe um e-mail válido."));
    if (password.length < 6)
      redirect("/director/equipe-pedagogica?error=" + encodeMsg("A senha deve ter pelo menos 6 caracteres."));
    if (password !== password2) redirect("/director/equipe-pedagogica?error=" + encodeMsg("As senhas não conferem."));

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (error || !data?.user?.id) {
      redirect("/director/equipe-pedagogica?error=" + encodeMsg(error?.message || "Não foi possível criar o usuário."));
    }

    const user_id = data.user.id;

    // Mantém o perfil como fonte de autorização (role + school_id)
    const { error: profErr } = await admin
      .from("profiles")
      .upsert(
        {
          user_id,
          school_id: profile.school_id,
          role: "pedagogical",
          full_name,
        },
        { onConflict: "user_id" },
      );

    if (profErr) {
      // Evita deixar usuário "órfão" (criado no Auth, mas sem perfil válido)
      try {
        await admin.auth.admin.deleteUser(user_id);
      } catch {
        // ignore
      }

      const msg = String((profErr as any)?.message ?? "");
      const isRoleConstraint =
        msg.includes("profiles_role_check") ||
        msg.toLowerCase().includes("role_check") ||
        msg.toLowerCase().includes("check constraint");

      const hint = isRoleConstraint
        ? "Atualize o banco rodando o script db/patch_profiles_role_check.sql no Supabase (SQL Editor) para liberar o papel 'pedagogical'."
        : "Tente novamente.";

      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Falha ao vincular o perfil. O usuário não foi criado. " + hint + " Detalhe: " + msg),
      );
    }

    // Se o diretor estiver com acesso por cortesia, replicamos a cortesia para o novo usuário.
    // (Assinatura é por escola e já vale para todos.)
    try {
      const { data: directorOverride, error: ovErr } = await admin
        .from("user_access_overrides")
        .select("access_override, access_override_until")
        .eq("user_id", profile.user_id)
        .maybeSingle();

      if (!ovErr && isCourtesyActive((directorOverride as any) ?? null)) {
        await admin
          .from("user_access_overrides")
          .upsert(
            {
              user_id,
              access_override: "complimentary",
              access_override_until: (directorOverride as any)?.access_override_until ?? null,
              note: `inherited_from_director:${profile.user_id}`,
            },
            { onConflict: "user_id" },
          );
      }
    } catch {
      // ignora (tabela pode não existir)
    }

    // Registra na tabela específica (se existir)
    const { error: teamErr } = await admin
      .from("pedagogical_team")
      .upsert(
        { user_id, school_id: profile.school_id, full_name, created_by: profile.user_id },
        { onConflict: "user_id" },
      );

    if (teamErr && !isMissingTable(teamErr)) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Usuário criado, mas falhou ao registrar a equipe: " + teamErr.message),
      );
    }

    redirect(
      "/director/equipe-pedagogica?msg=" +
        encodeMsg("Acesso criado! Envie o e-mail e a senha para a pessoa entrar."),
    );
  }

  async function updateMemberAction(formData: FormData) {
    "use server";

    const { profile } = await requireDirectorOnly();
    const admin = createAdminClient();

    const user_id = String(formData.get("user_id") || "").trim();
    const full_name = String(formData.get("full_name") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const password2 = String(formData.get("password2") || "");

    if (!user_id) redirect("/director/equipe-pedagogica?error=" + encodeMsg("ID inválido."));
    if (user_id === profile.user_id) {
      redirect(
        "/director/equipe-pedagogica?error=" + encodeMsg("Edite o próprio cadastro do diretor no seu perfil."),
      );
    }
    if (!full_name) redirect("/director/equipe-pedagogica?error=" + encodeMsg("Informe o nome."));
    if (!email || !email.includes("@"))
      redirect("/director/equipe-pedagogica?error=" + encodeMsg("Informe um e-mail válido."));
    if (password) {
      if (password.length < 6)
        redirect(
          "/director/equipe-pedagogica?error=" +
            encodeMsg("A nova senha deve ter pelo menos 6 caracteres (ou deixe em branco para não alterar)."),
        );
      if (password !== password2)
        redirect("/director/equipe-pedagogica?error=" + encodeMsg("As senhas não conferem."));
    }

    // Garante que o membro pertença à escola e não seja diretor
    const { data: pRow } = await admin
      .from("profiles")
      .select("school_id, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const schoolId = String((pRow as any)?.school_id ?? "");
    if (!schoolId || schoolId !== profile.school_id) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Este usuário não pertence ao seu colégio (ou não possui perfil)."),
      );
    }

    if (String((pRow as any)?.role ?? "") === "director") {
      redirect("/director/equipe-pedagogica?error=" + encodeMsg("Não é permitido editar um diretor."));
    }

    // 1) Atualiza Auth (email/senha)
    const authPayload: any = {
      email,
      email_confirm: true,
      user_metadata: { full_name },
    };
    if (password) authPayload.password = password;

    const { error: authErr } = await admin.auth.admin.updateUserById(user_id, authPayload);
    if (authErr) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Falha ao atualizar o acesso (Auth): " + authErr.message),
      );
    }

    // 2) Atualiza profile
    const { error: profErr } = await admin
      .from("profiles")
      .update({ full_name })
      .eq("user_id", user_id);

    if (profErr) {
      redirect(
        "/director/equipe-pedagogica?error=" +
          encodeMsg("Acesso atualizado no Auth, mas falhou ao atualizar o perfil: " + profErr.message),
      );
    }

    // 3) Atualiza tabela pedagogical_team (best-effort)
    try {
      await admin
        .from("pedagogical_team")
        .update({ full_name })
        .eq("user_id", user_id)
        .eq("school_id", profile.school_id);
    } catch {
      // ignore
    }

    revalidatePath("/director/equipe-pedagogica");
    redirect("/director/equipe-pedagogica?msg=" + encodeMsg("Acesso atualizado."));
  }

  return (
    <Shell
      title="Equipe pedagógica"
      subtitle="Cadastre pessoas para acessar Cadastros e Relatórios. O acesso ao Painel do diretor e Assinaturas fica restrito ao diretor."
    >
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}

        <section className="panel p-5">
          <h2 className="text-lg font-semibold">Novo acesso</h2>
          <p className="muted mt-1 text-sm">
            Crie um usuário com e-mail e senha. A pessoa poderá fazer login e usar o sistema, mas não verá Painel do diretor nem Assinaturas.
          </p>

          <form action={createMemberAction} className="mt-5 grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Nome</span>
                <input name="full_name" className="input" placeholder="Ex.: Maria Silva" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">E-mail</span>
                <input name="email" type="email" className="input" placeholder="maria@colegio.com" />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Senha</span>
                <input name="password" type="password" className="input" placeholder="••••••" />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Confirmar senha</span>
                <input name="password2" type="password" className="input" placeholder="••••••" />
              </label>
            </div>

            <button type="submit" className="btn btn-primary w-fit">
              Criar acesso
            </button>
          </form>
        </section>

        <section className="panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Acessos cadastrados</h2>
              <p className="muted mt-1 text-sm">Lista de usuários com papel de equipe pedagógica neste colégio.</p>
            </div>
          </div>

          {members.length ? (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500">
                    <th className="py-2 pr-4">Nome</th>
                    <th className="py-2 pr-4">E-mail</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">ID</th>
                    <th className="py-2 pr-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.user_id} className="border-t border-zinc-200/70 dark:border-zinc-800">
                      <td className="py-2 pr-4 font-semibold">{m.full_name ?? "(sem nome)"}</td>
                      <td className="py-2 pr-4">{m.email ?? "—"}</td>
                      <td className="py-2 pr-4">
                        {m.disabled_at ? (
                          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            Inativo
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100">
                            Ativo
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-zinc-500">{m.user_id}</td>
                      <td className="py-2 pr-4">
                        <div className="flex flex-wrap gap-2">
                          <details className="relative">
                            <summary className="btn btn-secondary h-9 list-none cursor-pointer select-none [&::-webkit-details-marker]:hidden">
                              Editar
                            </summary>
                            <div className="absolute right-0 z-20 mt-2 w-[360px] panel p-4 shadow-lg">
                              <div className="text-sm font-semibold">Editar acesso</div>
                              <form action={updateMemberAction} className="mt-3 grid gap-3">
                                <input type="hidden" name="user_id" value={m.user_id} />

                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Nome</span>
                                  <input name="full_name" defaultValue={m.full_name ?? ""} className="input" />
                                </label>

                                <label className="grid gap-1">
                                  <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">E-mail</span>
                                  <input name="email" type="email" defaultValue={m.email ?? ""} className="input" />
                                </label>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <label className="grid gap-1">
                                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Nova senha (opcional)</span>
                                    <input name="password" type="password" className="input" placeholder="••••••" />
                                  </label>
                                  <label className="grid gap-1">
                                    <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">Confirmar</span>
                                    <input name="password2" type="password" className="input" placeholder="••••••" />
                                  </label>
                                </div>

                                <button type="submit" className="btn btn-primary h-9 w-fit">
                                  Salvar
                                </button>
                              </form>
                            </div>
                          </details>

                          <form action={setMemberStatusAction}>
                            <input type="hidden" name="user_id" value={m.user_id} />
                            <input type="hidden" name="action" value={m.disabled_at ? "activate" : "deactivate"} />
                            <ConfirmButton
                              confirmText={
                                m.disabled_at
                                  ? "Reativar este acesso?"
                                  : "Inativar este acesso? A pessoa não conseguirá usar o sistema."
                              }
                              className={
                                "btn btn-secondary h-9 " +
                                (m.disabled_at
                                  ? ""
                                  : "border-amber-300 text-amber-950 hover:bg-amber-50 dark:border-amber-900/60 dark:text-amber-100 dark:hover:bg-amber-950/40")
                              }
                              type="submit"
                            >
                              {m.disabled_at ? "Reativar" : "Inativar"}
                            </ConfirmButton>
                          </form>

                          <form action={deleteMemberAction}>
                            <input type="hidden" name="user_id" value={m.user_id} />
                            <ConfirmButton
                              confirmText="Excluir este acesso definitivamente?"
                              className="btn btn-secondary h-9 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-200 dark:hover:bg-red-950/40"
                              type="submit"
                            >
                              Excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted mt-4 text-sm">Nenhum acesso cadastrado ainda.</p>
          )}
        </section>
      </div>
    </Shell>
  );
}
