
import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { GradesByRoomClient } from "@/components/GradesByRoomClient";

export default async function Page() {
  await requireDirector();
  return (
    <Shell title="Grade por sala" subtitle="Impressão no formato do quadro (colunas por sala)">
      <GradesByRoomClient />
    </Shell>
  );
}
