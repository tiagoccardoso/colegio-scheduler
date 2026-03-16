import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { requireDirector } from "@/lib/require-director";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import {
  cleanNullableText,
  documentSettingsCompleteness,
  type DocumentSettingsRow,
} from "@/lib/novo-ensino-medio-documents";

export default async function DirectorDocumentsNemPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, profile } = await requireDirector();
  const sp = (await searchParams) ?? {};

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const [schoolRes, settingsRes] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", profile.school_id).maybeSingle(),
    supabase.from("school_document_settings").select("*").eq("school_id", profile.school_id).maybeSingle(),
  ]);

  const schoolName = String((schoolRes.data as any)?.name ?? "Minha escola").trim() || "Minha escola";
  const settings = (settingsRes.data as DocumentSettingsRow | null) ?? null;
  const completeness = documentSettingsCompleteness(settings);

  async function saveAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireDirector();

    const payload = {
      school_id: profile.school_id,
      institution_name_override: cleanNullableText(formData.get("institution_name_override")),
      network_name: cleanNullableText(formData.get("network_name")),
      city: cleanNullableText(formData.get("city")),
      state_code: String(formData.get("state_code") ?? "").trim().toUpperCase() || null,
      ordinance_reference: cleanNullableText(formData.get("ordinance_reference")),
      header_text: cleanNullableText(formData.get("header_text")),
      footer_text: cleanNullableText(formData.get("footer_text")),
      principal_name: cleanNullableText(formData.get("principal_name")),
      principal_role_label: cleanNullableText(formData.get("principal_role_label")) || "Direção",
      secretary_name: cleanNullableText(formData.get("secretary_name")),
      secretary_role_label: cleanNullableText(formData.get("secretary_role_label")) || "Secretaria Escolar",
      default_history_observation: cleanNullableText(formData.get("default_history_observation")),
    };

    const { error } = await supabase.from("school_document_settings").upsert(payload, { onConflict: "school_id" });
    if (error) {
      redirect("/director/documentos-nem?error=" + encodeMsg(error.message));
    }

    revalidatePath("/director/documentos-nem");
    revalidatePath("/students/documentos");
    redirect("/director/documentos-nem?msg=" + encodeMsg("Configurações de documentos atualizadas."));
  }

  return (
    <Shell
      title="Documentos NEM"
      subtitle="Configure cabeçalho, signatários e base textual para emissão de histórico e declarações do Novo Ensino Médio."
    >
      <div className="grid gap-4">
        {msg ? <Flash message={msg} variant="success" /> : null}
        {error ? <Flash message={error} variant="error" /> : null}

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <form action={saveAction} className="panel grid gap-4 p-5">
            <div>
              <h2 className="text-lg font-semibold">Identificação institucional</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                Use estes campos para moldar o layout oficial da rede. Sem isso, o documento sai, mas com cara de rascunho que tomou café demais.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span>Nome institucional no documento</span>
                <input
                  name="institution_name_override"
                  defaultValue={settings?.institution_name_override ?? schoolName}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Rede / mantenedora</span>
                <input
                  name="network_name"
                  defaultValue={settings?.network_name ?? ""}
                  placeholder="Rede Estadual / Municipal / Particular"
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Cidade</span>
                <input
                  name="city"
                  defaultValue={settings?.city ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>UF</span>
                <input
                  name="state_code"
                  defaultValue={settings?.state_code ?? ""}
                  maxLength={2}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 uppercase dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span>Portaria, deliberação ou ato interno de referência</span>
                <input
                  name="ordinance_reference"
                  defaultValue={settings?.ordinance_reference ?? ""}
                  placeholder="Ex.: Deliberação CEE 42/2025 + Regimento Escolar"
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span>Nome do(a) diretor(a)</span>
                <input
                  name="principal_name"
                  defaultValue={settings?.principal_name ?? profile.full_name ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Cargo do(a) diretor(a)</span>
                <input
                  name="principal_role_label"
                  defaultValue={settings?.principal_role_label ?? "Direção"}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Nome do(a) secretário(a)</span>
                <input
                  name="secretary_name"
                  defaultValue={settings?.secretary_name ?? ""}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span>Cargo do(a) secretário(a)</span>
                <input
                  name="secretary_role_label"
                  defaultValue={settings?.secretary_role_label ?? "Secretaria Escolar"}
                  className="rounded-xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
                />
              </label>
            </div>

            <label className="grid gap-1 text-sm">
              <span>Cabeçalho complementar</span>
              <textarea
                name="header_text"
                defaultValue={settings?.header_text ?? ""}
                rows={3}
                placeholder="Ex.: endereço, INEP, CNPJ, resolução da escola"
                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Rodapé padrão</span>
              <textarea
                name="footer_text"
                defaultValue={settings?.footer_text ?? ""}
                rows={3}
                placeholder="Ex.: autenticidade sujeita a conferência na secretaria escolar"
                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span>Observação padrão para histórico</span>
              <textarea
                name="default_history_observation"
                defaultValue={settings?.default_history_observation ?? ""}
                rows={3}
                placeholder="Ex.: currículo organizado em Formação Geral Básica e itinerários formativos."
                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-zinc-500">Escola base: {schoolName}</div>
              <button className="btn btn-primary" type="submit">
                Salvar configurações
              </button>
            </div>
          </form>

          <div className="grid gap-4">
            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Prontidão documental</h2>
              <div className="mt-2 text-4xl font-semibold tracking-tight">{completeness}/9</div>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Quanto mais perto de 9, menos chance de o documento sair com aquele ar de “foi feito na correria do recreio”.
              </p>
            </div>

            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Checklist mínimo</h2>
              <ul className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li>{settings?.institution_name_override ? "✅" : "⬜"} Nome institucional do documento</li>
                <li>{settings?.network_name ? "✅" : "⬜"} Rede ou mantenedora</li>
                <li>{settings?.city && settings?.state_code ? "✅" : "⬜"} Cidade e UF</li>
                <li>{settings?.ordinance_reference ? "✅" : "⬜"} Base normativa / ato interno</li>
                <li>{settings?.principal_name ? "✅" : "⬜"} Diretor(a)</li>
                <li>{settings?.secretary_name ? "✅" : "⬜"} Secretário(a)</li>
              </ul>
            </div>

            <div className="panel p-5">
              <h2 className="text-lg font-semibold">Fluxo recomendado</h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                <li>Configure cabeçalho e signatários nesta tela.</li>
                <li>Lance histórico e trilhas em <strong>Histórico e trilhas</strong>.</li>
                <li>Emita o documento em <strong>Documentos do aluno</strong>.</li>
                <li>Revise antes de imprimir, porque o papel não tem botão de undo.</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
}
