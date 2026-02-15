import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { decodeMsg, encodeMsg } from "@/lib/flash";
import { TeacherTeachingRulesEditor } from "@/components/TeacherTeachingRulesEditor";
import { deriveLegacyFieldsFromTeachingRules, parseTeachingRulesJson } from "@/lib/schedule/teaching-rules";

type Row = {
  id: string;
  name: string | null;
  short_name?: string | null;
  email: string | null;
  shifts: string[] | null;
  subject_id: string | null;
  default_room_id: string | null;
  class_ids: string[] | null;
  restrictions: string | null;
  availability: any | null;
  allow_interjornada_lt_11?: boolean | null;

  teaching_rules?: any | null;

  // Legacy fields (kept for backward compatibility with existing AI endpoints)
  subject_ids: string[] | null;
  room_ids: string[] | null;
  available_weekdays: number[] | null;
};

type RefRow = { id: string; name: string | null; shift?: string | null };

const SHIFTS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  // Usado por telas auxiliares (ex.: Conflitos) para abrir direto o professor.
  const focusId = typeof (sp as any)?.focus === "string" ? String((sp as any).focus) : null;

  const q = typeof (sp as any)?.q === "string" ? String((sp as any).q).trim() : "";

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  const { data: rows, error: loadError } = await supabase
    .from("teachers")
    .select(
      "id,name,email,shifts,subject_id,default_room_id,class_ids,restrictions,availability,allow_interjornada_lt_11,teaching_rules,subject_ids,room_ids,available_weekdays",
    )
    .eq("school_id", profile.school_id)
    .order("created_at", { ascending: false });

  const { data: subjects } = await supabase
    .from("subjects")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: classes } = await supabase
    .from("classes")
    .select("id,name,shift")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id,name")
    .eq("school_id", profile.school_id)
    .order("name", { ascending: true });

  const subjectById = new Map(((subjects as RefRow[] | null) ?? []).map((s) => [s.id, s.name ?? ""]));
  const classById = new Map(((classes as RefRow[] | null) ?? []).map((c) => [c.id, c.name ?? ""]));
  const roomById = new Map(((rooms as RefRow[] | null) ?? []).map((r) => [r.id, r.name ?? ""]));

  function labelList(ids: string[] | null | undefined, dict: Map<string, string>, emptyLabel = "—") {
    const arr = (ids ?? []).map((id) => dict.get(id) || id).filter(Boolean);
    return arr.length ? arr.join(", ") : emptyLabel;
  }

  function labelShiftList(shifts: string[] | null | undefined) {
    const arr = (shifts ?? []).map((s) => SHIFTS.find((x) => x.key === s)?.label ?? s).filter(Boolean);
    return arr.length ? uniq(arr).join(", ") : "—";
  }

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const criteria = String(formData.get("restrictions") || "").trim();

    const parsedRules = parseTeachingRulesJson(formData.get("teaching_rules_json"));
    if (parsedRules.length === 0 && !criteria) {
      redirect("/teachers?error=" + encodeMsg("Informe pelo menos uma turma vinculada ou preencha o campo Critérios."));
    }

    const derived = deriveLegacyFieldsFromTeachingRules(parsedRules);

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      restrictions: criteria || null,
      allow_interjornada_lt_11: Boolean(formData.get("allow_interjornada_lt_11")),

      teaching_rules: parsedRules,

      // Campos derivados (compatibilidade/legado)
      shifts: derived.shifts,
      availability: derived.availability,
      available_weekdays: derived.available_weekdays,
      subject_id: derived.subject_id,
      default_room_id: derived.default_room_id,
      subject_ids: derived.subject_ids ?? [],
      room_ids: derived.room_ids ?? [],
      class_ids: derived.class_ids ?? [],
    };

    if (!payload.name) redirect("/teachers?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("teachers").insert(payload);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professor cadastrado com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));

    const criteria = String(formData.get("restrictions") || "").trim();

    const parsedRules = parseTeachingRulesJson(formData.get("teaching_rules_json"));
    if (parsedRules.length === 0 && !criteria) {
      redirect("/teachers?error=" + encodeMsg("Informe pelo menos uma turma vinculada ou preencha o campo Critérios."));
    }

    const derived = deriveLegacyFieldsFromTeachingRules(parsedRules);

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      short_name: String(formData.get("short_name") || "").trim() || null,
      email: String(formData.get("email") || "").trim() || null,
      restrictions: criteria || null,
      allow_interjornada_lt_11: Boolean(formData.get("allow_interjornada_lt_11")),

      teaching_rules: parsedRules,

      // Campos derivados (compatibilidade/legado)
      shifts: derived.shifts,
      availability: derived.availability,
      available_weekdays: derived.available_weekdays,
      subject_id: derived.subject_id,
      default_room_id: derived.default_room_id,
      subject_ids: derived.subject_ids ?? [],
      room_ids: derived.room_ids ?? [],
      class_ids: derived.class_ids ?? [],
    };

    if (!payload.name) redirect("/teachers?error=" + encodeMsg("Preencha o campo Nome."));

    const { error } = await supabase.from("teachers").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professor atualizado."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "");
    if (!id) redirect("/teachers?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("teachers").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Professor removido."));

  }

  async function deleteAllAction() {
    "use server";
    const { supabase, profile } = await requireStaff();

    // Primeiro, "desvincula" professores de aulas existentes (evita falha por FK, se houver)
    const { error: unassignError } = await supabase
      .from("schedules")
      .update({ teacher_id: null })
      .eq("school_id", profile.school_id);

    if (unassignError) redirect("/teachers?error=" + encodeMsg(unassignError.message));

    const { error } = await supabase.from("teachers").delete().eq("school_id", profile.school_id);
    if (error) redirect("/teachers?error=" + encodeMsg(error.message));

    revalidatePath("/teachers");
    redirect("/teachers?msg=" + encodeMsg("Todos os professores foram removidos."));

  }

  const rowsTyped = (rows as Row[] | null) ?? [];

  const qNorm = q.toLowerCase();
  const filteredRows = qNorm
    ? rowsTyped.filter((r) => {
        const hay = `${r.name ?? ""} ${r.short_name ?? ""} ${r.email ?? ""}`.toLowerCase();
        return hay.includes(qNorm);
      })
    : rowsTyped;

  return (
    <Shell title="Professores">
      <div className="grid gap-4">
        <Flash
          message={error || msg || (loadError ? loadError.message : null)}
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar</summary>
            <form action={createAction} className="mt-4 grid max-w-3xl gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Nome</span>
                  <input
                    name="name"
                    type="text"
                    required
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">E-mail</span>
                  <input
                    name="email"
                    type="email"
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  />
                </label>
              </div>

              <TeacherTeachingRulesEditor
                subjects={(((subjects as RefRow[] | null) ?? []) as any).map((s: any) => ({ id: s.id, name: s.name }))}
                rooms={(((rooms as RefRow[] | null) ?? []) as any).map((r: any) => ({ id: r.id, name: r.name }))}
                classes={(((classes as RefRow[] | null) ?? []) as any).map((c: any) => ({ id: c.id, name: c.name, shift: c.shift }))}
              />

              <label className="grid gap-2">
                <span className="text-sm font-semibold">Critérios (opcional se houver turma vinculada)</span>
                <textarea
                  name="restrictions"
                  rows={3}
                  placeholder="Ex.: 10 aulas de Matemática; só Seg–Qua; preferir últimos períodos da manhã; Turmas A e B..."
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </label>


              <label className="flex items-center gap-2">
                <input
                  name="allow_interjornada_lt_11"
                  type="checkbox"
                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span className="text-sm font-medium">Permitir Interjornada inferior a 11 horas</span>
              </label>



              <button
                type="submit"
                className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Salvar
              </button>

            </form>
          </details>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 md:flex-row md:items-center md:justify-between">
            <form action="/teachers" method="get" className="flex w-full flex-col gap-2 md:max-w-xl md:flex-row md:items-center">
              <label className="grid w-full gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Pesquisar professor</span>
                <input
                  name="q"
                  type="text"
                  defaultValue={q}
                  placeholder="Digite nome ou e-mail..."
                  className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                />
              </label>
              <div className="flex gap-2 md:mt-5">
                <button
                  type="submit"
                  className="h-10 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Buscar
                </button>
                {q ? (
                  <a
                    href="/teachers"
                    className="inline-flex h-10 items-center rounded-xl border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                  >
                    Limpar
                  </a>
                ) : null}
              </div>
            </form>

            <div className="flex flex-col gap-2 md:items-end">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Exibindo <span className="font-semibold">{filteredRows.length}</span> de{" "}
                <span className="font-semibold">{rowsTyped.length}</span>
              </div>

              <form action={deleteAllAction}>
                <ConfirmButton
                  confirmText="Isso vai excluir TODOS os professores cadastrados. Deseja continuar?"
                  type="submit"
                  className="btn btn-danger"
                >
                  Excluir todos
                </ConfirmButton>
              </form>
            </div>
          </div>

<div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">E-mail</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turnos</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disciplinas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turmas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Salas</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const subjectsLabel = row.subject_id
                    ? subjectById.get(row.subject_id) || row.subject_id
                    : labelList(row.subject_ids, subjectById, "—");
                  const classesLabel = labelList(row.class_ids, classById, "Todas");
                  const roomsLabel = row.default_room_id
                    ? roomById.get(row.default_room_id) || row.default_room_id
                    : labelList(row.room_ids, roomById, "Todas");

                  return (
                    <tr
                      key={row.id}
                      id={`teacher-${row.id}`}
                      className="border-t border-zinc-100 dark:border-zinc-900"
                    >
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.name ?? ""}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.email ?? ""}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{labelShiftList(row.shifts)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{subjectsLabel}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{classesLabel}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{roomsLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={`/teachers/ai?teacherId=${row.id}`}
                            className="h-9 rounded-xl border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                          >
                            Horários (IA)
                          </a>
                          <details open={Boolean(focusId && focusId === row.id)}>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[860px] max-w-[calc(100vw-3rem)] gap-4">
                              <input type="hidden" name="id" value={row.id} />

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">Nome</span>
                                  <input
                                    name="name"
                                    type="text"
                                    defaultValue={row.name ?? ""}
                                    required
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                                  />
                                </label>

                                <label className="grid gap-2">
                                  <span className="text-sm font-semibold">E-mail</span>
                                  <input
                                    name="email"
                                    type="email"
                                    defaultValue={row.email ?? ""}
                                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                                  />
                                </label>
                              </div>

                              <TeacherTeachingRulesEditor
                                subjects={(((subjects as RefRow[] | null) ?? []) as any).map((s: any) => ({ id: s.id, name: s.name }))}
                                rooms={(((rooms as RefRow[] | null) ?? []) as any).map((r: any) => ({ id: r.id, name: r.name }))}
                                classes={(((classes as RefRow[] | null) ?? []) as any).map((c: any) => ({ id: c.id, name: c.name, shift: c.shift }))}
                                initialRules={(row.teaching_rules as any) ?? []}
                              />

                              <label className="grid gap-2">
                                <span className="text-sm font-semibold">Critérios (opcional se houver turma vinculada)</span>
                                <textarea
                                  name="restrictions"
                                  rows={3}
                                  placeholder="Ex.: 10 aulas de Matemática; só Seg–Qua; preferir últimos períodos da manhã; Turmas A e B..."
                                  defaultValue={row.restrictions ?? ""}
                                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                                />
                              </label>

                              <label className="flex items-center gap-2">
                                <input
                                  name="allow_interjornada_lt_11"
                                  type="checkbox"
                                  defaultChecked={Boolean(row.allow_interjornada_lt_11)}
                                  className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                                />
                                <span className="text-sm font-medium">Permitir Interjornada inferior a 11 horas</span>
                              </label>

                              <button
                                type="submit"
                                className="w-fit rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                              >
                                Atualizar
                              </button>
                            </form>
                          </details>

                          <form action={deleteAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <ConfirmButton
                              confirmText="Tem certeza que deseja excluir?"
                              type="submit"
                              className="btn btn-danger"
                            >
                              Excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredRows.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={7} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
                      Nenhum registro encontrado.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Shell>
  );
}
