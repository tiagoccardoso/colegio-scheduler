import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { ScheduleGeneralClient } from "@/components/ScheduleGeneralClient";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  // Next.js 16 pode tipar searchParams como Promise nos types gerados.
  searchParams?: Promise<SearchParams>;
}) {
  await requireStaff();

  const sp = (await searchParams) ?? {};
  const classId = typeof sp?.classId === "string" ? sp.classId : null;
  const shift = typeof sp?.shift === "string" ? sp.shift : "MANHA";

  return (
    <Shell
      title="Montar grade"
      subtitle="Ao entrar nesta tela, o sistema monta automaticamente a grade geral do turno (todas as turmas) a partir do cadastro de Professores e da Hora Atividade (HA)."
    >
      <ScheduleGeneralClient initialShift={shift} initialClassId={classId} />
    </Shell>
  );
}
