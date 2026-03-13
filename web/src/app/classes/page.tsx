import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { Flash } from "@/components/Flash";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ClassRequirementsEditor } from "@/components/ClassRequirementsEditor";
import { decodeMsg, encodeMsg } from "@/lib/flash";

type Row = {
  id: string;
  name: string | null;
  shift: string | null;
  level?: string | null;
  stage?: string | null;
  default_room_id?: string | null;
  display_order?: number | null;
};

type SubjectRow = {
  id: string;
  name: string | null;
};

type RequirementRow = {
  id: string;
  class_id: string;
  subject_id: string;
  lessons_per_week: number;
};

type RequirementInput = {
  subject_id: string;
  lessons_per_week: number;
};

type SanitizeRequirementsResult =
  | { error: string }
  | { items: RequirementInput[] };

const SHIFT_OPTIONS: { key: string; label: string }[] = [
  { key: "MANHA", label: "Manhã" },
  { key: "TARDE", label: "Tarde" },
  { key: "NOITE", label: "Noite" },
];

function normalizeShift(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim().toUpperCase();
  return SHIFT_OPTIONS.some((item) => item.key === raw) ? raw : null;
}

function shiftLabel(shift: string | null | undefined) {
  const key = String(shift ?? "").trim().toUpperCase();
  const label = SHIFT_OPTIONS.find((item) => item.key === key)?.label;
  return label || key || "—";
}

function sanitizeRequirementsJson(raw: FormDataEntryValue | null, validSubjectIds: Set<string>): SanitizeRequirementsResult {
  const source = String(raw ?? "[]").trim() || "[]";
  let parsed: any[];

  try {
    const value = JSON.parse(source);
    parsed = Array.isArray(value) ? value : [];
  } catch {
    return { error: "As disciplinas da turma estão em um formato inválido." } as const;
  }

  const items: RequirementInput[] = [];
  const seen = new Set<string>();

  for (const entry of parsed) {
    const subjectId = String(entry?.subject_id ?? "").trim();
    if (!subjectId) continue;
    if (!validSubjectIds.has(subjectId)) {
      return { error: "Uma das disciplinas selecionadas não pertence a esta escola." } as const;
    }
    if (seen.has(subjectId)) {
      return { error: "Há disciplinas repetidas na turma. Deixe apenas uma linha por disciplina." } as const;
    }

    const lessons = Math.max(1, Math.min(40, Number(entry?.lessons_per_week ?? 0) || 0));
    if (!lessons) {
      return { error: "Informe a quantidade de aulas por semana para cada disciplina." } as const;
    }

    seen.add(subjectId);
    items.push({ subject_id: subjectId, lessons_per_week: lessons });
  }

  return { items } as const;
}

async function syncClassRequirements(args: {
  supabase: any;
  schoolId: string;
  classId: string;
  requirements: RequirementInput[];
}) {
  const { supabase, schoolId, classId, requirements } = args;

  const { data: existingRows, error: existingError } = await supabase
    .from("class_subject_requirements")
    .select("id,subject_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId);

  if (existingError) {
    throw new Error(existingError.message || "Não foi possível carregar as disciplinas da turma.");
  }

  const existing = (existingRows as Array<{ id: string; subject_id: string }> | null) ?? [];
  const incomingSubjectIds = new Set(requirements.map((item) => item.subject_id));
  const deleteIds = existing
    .filter((item) => !incomingSubjectIds.has(String(item.subject_id)))
    .map((item) => String(item.id));

  if (deleteIds.length) {
    const { error } = await supabase
      .from("class_subject_requirements")
      .delete()
      .eq("school_id", schoolId)
      .in("id", deleteIds);

    if (error) {
      throw new Error(error.message || "Não foi possível remover disciplinas antigas da turma.");
    }
  }

  if (requirements.length) {
    const payload = requirements.map((item) => ({
      school_id: schoolId,
      class_id: classId,
      subject_id: item.subject_id,
      lessons_per_week: item.lessons_per_week,
    }));

    const { error } = await supabase
      .from("class_subject_requirements")
      .upsert(payload, { onConflict: "school_id,class_id,subject_id" });

    if (error) {
      throw new Error(error.message || "Não foi possível salvar as disciplinas da turma.");
    }
  }
}

function revalidateClassPaths() {
  revalidatePath("/classes");
  revalidatePath("/curriculum-matrix");
  revalidatePath("/director/matriz-curricular");
  revalidatePath("/director/parametros-grade");
}

export default async function Page({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, profile } = await requireStaff();
  const sp = (await searchParams) ?? {};

  const qRaw = typeof sp.q === "string" ? sp.q : "";
  const q = qRaw.trim().replace(/,/g, " ");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(q);
  const like = `%${q}%`;

  const msg = typeof sp.msg === "string" ? decodeMsg(sp.msg) : null;
  const error = typeof sp.error === "string" ? decodeMsg(sp.error) : null;

  let classesQuery = supabase
    .from("classes")
    .select("id, name, shift, level, stage, default_room_id, display_order")
    .eq("school_id", profile.school_id);

  if (q) {
    classesQuery = classesQuery.or(
      isUuid
        ? `id.eq.${q},name.ilike.${like},shift.ilike.${like},level.ilike.${like},stage.ilike.${like}`
        : `name.ilike.${like},shift.ilike.${like},level.ilike.${like},stage.ilike.${like}`,
    );
  }

  const [classesRes, subjectsRes, requirementsRes] = await Promise.all([
    classesQuery.order("display_order", { ascending: true, nullsFirst: false }).order("name", { ascending: true }),
    supabase.from("subjects").select("id,name").eq("school_id", profile.school_id).order("name", { ascending: true }),
    supabase
      .from("class_subject_requirements")
      .select("id,class_id,subject_id,lessons_per_week")
      .eq("school_id", profile.school_id),
  ]);

  const rows = (classesRes.data as Row[] | null) ?? [];
  const loadError = classesRes.error;
  const subjects = ((subjectsRes.data as SubjectRow[] | null) ?? []).map((item) => ({
    id: String(item.id),
    name: item.name ?? null,
  }));
  const requirements = ((requirementsRes.data as RequirementRow[] | null) ?? []).map((item) => ({
    id: String(item.id),
    class_id: String(item.class_id),
    subject_id: String(item.subject_id),
    lessons_per_week: Number(item.lessons_per_week ?? 0),
  }));

  const subjectIds = subjects.map((item) => item.id);
  const subjectById = new Map(subjects.map((item) => [item.id, item.name ?? "Sem nome"]));
  const requirementsByClass = new Map<string, RequirementRow[]>();
  for (const item of requirements) {
    const list = requirementsByClass.get(item.class_id) ?? [];
    list.push(item);
    requirementsByClass.set(item.class_id, list);
  }
  for (const list of requirementsByClass.values()) {
    list.sort((a, b) => String(subjectById.get(a.subject_id) ?? "").localeCompare(String(subjectById.get(b.subject_id) ?? ""), "pt-BR"));
  }

  async function createAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const payload: any = {
      school_id: profile.school_id,
      name: String(formData.get("name") || "").trim() || null,
      shift: normalizeShift(formData.get("shift")),
    };

    if (!payload.name) {
      redirect("/classes?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const normalizedRequirements = sanitizeRequirementsJson(formData.get("requirements_json"), new Set(subjectIds));
    if ("error" in normalizedRequirements) {
      const errorMessage = normalizedRequirements.error;
      redirect("/classes?error=" + encodeMsg(errorMessage));
    }

    const { data: created, error } = await supabase
      .from("classes")
      .insert(payload)
      .select("id")
      .single();

    if (error || !created?.id) {
      redirect("/classes?error=" + encodeMsg(error?.message || "Não foi possível criar a turma."));
    }

    try {
      await syncClassRequirements({
        supabase,
        schoolId: profile.school_id,
        classId: String(created.id),
        requirements: normalizedRequirements.items,
      });
    } catch (e: any) {
      await supabase.from("classes").delete().eq("id", created.id).eq("school_id", profile.school_id);
      redirect("/classes?error=" + encodeMsg(e?.message || "Não foi possível salvar as disciplinas da turma."));
    }

    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma criada com sucesso."));
  }

  async function updateAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "").trim();
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));

    const payload: any = {
      name: String(formData.get("name") || "").trim() || null,
      shift: normalizeShift(formData.get("shift")),
      level: String(formData.get("level") || "").trim() || null,
      stage: String(formData.get("stage") || "").trim() || null,
      default_room_id: String(formData.get("default_room_id") || "").trim() || null,
      display_order: formData.get("display_order") ? Number(formData.get("display_order")) : null,
    };

    if (!payload.name) {
      redirect("/classes?error=" + encodeMsg("Preencha o campo Nome."));
    }

    const normalizedRequirements = sanitizeRequirementsJson(formData.get("requirements_json"), new Set(subjectIds));
    if ("error" in normalizedRequirements) {
      const errorMessage = normalizedRequirements.error;
      redirect("/classes?error=" + encodeMsg(errorMessage));
    }

    const { error } = await supabase.from("classes").update(payload).eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    try {
      await syncClassRequirements({
        supabase,
        schoolId: profile.school_id,
        classId: id,
        requirements: normalizedRequirements.items,
      });
    } catch (e: any) {
      redirect("/classes?error=" + encodeMsg(e?.message || "Não foi possível salvar as disciplinas da turma."));
    }

    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma atualizada."));
  }

  async function deleteAction(formData: FormData) {
    "use server";
    const { supabase, profile } = await requireStaff();

    const id = String(formData.get("id") || "").trim();
    if (!id) redirect("/classes?error=" + encodeMsg("ID inválido."));

    const { error } = await supabase.from("classes").delete().eq("id", id).eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Turma removida."));
  }

  async function deleteAllAction() {
    "use server";
    const { supabase, profile } = await requireStaff();

    const { error } = await supabase.from("classes").delete().eq("school_id", profile.school_id);
    if (error) redirect("/classes?error=" + encodeMsg(error.message));

    revalidateClassPaths();
    redirect("/classes?msg=" + encodeMsg("Todas as turmas foram removidas."));
  }

  return (
    <Shell title="Turmas">
      <div className="grid gap-4">
        <Flash
          message={error || msg || (loadError ? loadError.message : null)}
          variant={error ? "error" : msg ? "success" : "info"}
        />

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <details open>
            <summary className="cursor-pointer text-sm font-semibold">Cadastrar</summary>
            <form action={createAction} className="mt-4 grid max-w-4xl gap-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <span className="text-sm font-semibold">Turno</span>
                  <select
                    name="shift"
                    defaultValue=""
                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                  >
                    <option value="">—</option>
                    {SHIFT_OPTIONS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <ClassRequirementsEditor subjects={subjects} />

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
          <div className="flex flex-col gap-3 border-b border-zinc-100 p-4 dark:border-zinc-900 sm:flex-row sm:items-center sm:justify-between">
            <form action="/classes" method="GET" className="flex w-full max-w-md gap-2">
              <input
                name="q"
                type="text"
                placeholder="Pesquisar por nome, turno (ou ID)"
                defaultValue={q}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
              />
              <button type="submit" className="btn btn-secondary">
                Pesquisar
              </button>
              {q ? (
                <a href="/classes" className="btn btn-ghost">
                  Limpar
                </a>
              ) : null}
            </form>

            <form action={deleteAllAction}>
              <ConfirmButton confirmText="Tem certeza que deseja excluir TODOS os registros?" type="submit" className="btn btn-danger">
                Excluir todos
              </ConfirmButton>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Nome</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Turno</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Disciplinas / semana</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const classRequirements = requirementsByClass.get(row.id) ?? [];
                  const totalLessons = classRequirements.reduce((sum, item) => sum + Number(item.lessons_per_week || 0), 0);
                  return (
                    <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-900">
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{row.name ?? ""}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">{shiftLabel(row.shift)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200">
                        {classRequirements.length ? (
                          <div className="grid gap-2">
                            <div className="flex flex-wrap gap-2">
                              {classRequirements.map((item) => (
                                <span
                                  key={item.id}
                                  className="inline-flex rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs dark:border-zinc-800 dark:bg-zinc-900"
                                >
                                  {subjectById.get(item.subject_id) ?? item.subject_id} • {item.lessons_per_week}
                                </span>
                              ))}
                            </div>
                            <div className="text-xs text-zinc-500 dark:text-zinc-400">
                              {classRequirements.length} disciplina(s) • {totalLessons} aula(s) por semana
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">Nenhuma disciplina vinculada.</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <details>
                            <summary className="cursor-pointer text-sm font-semibold">Editar</summary>
                            <form action={updateAction} className="mt-3 grid w-[min(720px,92vw)] gap-3">
                              <input type="hidden" name="id" value={row.id} />
                              <input type="hidden" name="level" value={row.level ?? ""} />
                              <input type="hidden" name="stage" value={row.stage ?? ""} />
                              <input type="hidden" name="default_room_id" value={row.default_room_id ?? ""} />
                              <input type="hidden" name="display_order" value={row.display_order ?? ""} />

                              <div className="grid gap-3 md:grid-cols-2">
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
                                  <span className="text-sm font-semibold">Turno</span>
                                  <select
                                    name="shift"
                                    defaultValue={(row.shift ?? "").toUpperCase()}
                                    className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-600"
                                  >
                                    <option value="">—</option>
                                    {SHIFT_OPTIONS.map((s) => (
                                      <option key={s.key} value={s.key}>
                                        {s.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </div>

                              <ClassRequirementsEditor
                                subjects={subjects}
                                initialValue={classRequirements.map((item) => ({
                                  subject_id: item.subject_id,
                                  lessons_per_week: item.lessons_per_week,
                                }))}
                              />

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
                            <ConfirmButton confirmText="Tem certeza que deseja excluir?" type="submit" className="btn btn-danger">
                              Excluir
                            </ConfirmButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 ? (
                  <tr className="border-t border-zinc-100 dark:border-zinc-900">
                    <td colSpan={4} className="px-4 py-6 text-sm text-zinc-600 dark:text-zinc-400">
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
