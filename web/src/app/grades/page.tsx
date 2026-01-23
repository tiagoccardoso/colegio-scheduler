
import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { GradesByClassClient } from "@/components/GradesByClassClient";

export default async function Page() {
  await requireStaff();
  return (
    <Shell title="Grade por turma" subtitle="Impressão no formato do quadro (colunas por turma)">
      <GradesByClassClient />
    </Shell>
  );
}
