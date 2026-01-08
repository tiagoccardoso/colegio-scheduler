
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { GradesByTeacherClient } from "@/components/GradesByTeacherClient";

export default async function Page() {
  await requireDirector();
  return (
    <Shell
      title="Grade Professor"
      subtitle="Relatório de grade filtrado por professor, pronto para impressão"
    >
      <GradesByTeacherClient />
    </Shell>
  );
}
