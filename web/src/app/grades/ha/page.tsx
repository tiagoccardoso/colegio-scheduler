import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { GradesHaClient } from "@/components/GradesHaClient";

export default async function Page() {
  await requireDirector();
  return (
    <Shell
      title="Hora Atividade"
      subtitle="Relatório de Hora Atividade (HA) por turno, pronto para impressão"
    >
      <GradesHaClient />
    </Shell>
  );
}
