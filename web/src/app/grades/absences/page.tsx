import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { GradesAbsencesClient } from "@/components/GradesAbsencesClient";

export default async function Page() {
  await requireStaff();
  return (
    <Shell
      title="Relatório de Faltas"
      subtitle="Lista faltas e substituições dos professores, pronta para impressão"
    >
      <GradesAbsencesClient />
    </Shell>
  );
}
