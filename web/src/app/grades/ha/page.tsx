import { requireStaff } from "@/lib/require-staff";
import { Shell } from "@/components/Shell";
import { GradesHaClient } from "@/components/GradesHaClient";

export default async function Page() {
  await requireStaff();
  return (
    <Shell
      title="Hora Atividade"
      subtitle="Relatório de Hora Atividade (HA) por turno, pronto para impressão"
    >
      <GradesHaClient />
    </Shell>
  );
}
