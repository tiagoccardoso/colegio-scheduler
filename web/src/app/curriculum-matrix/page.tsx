import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { CurriculumMatrixBoard } from "@/components/CurriculumMatrixBoard";

export default async function CurriculumMatrixPage() {
  await requireStaff();
  return (
    <Shell
      title="Matriz curricular"
      subtitle="Monte automaticamente a distribuição de disciplinas por turma, edite as células manualmente e zere a matriz quando precisar recomeçar."
    >
      <CurriculumMatrixBoard />
    </Shell>
  );
}
