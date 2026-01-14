import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";
import { ScheduleConflictsClient } from "@/components/ScheduleConflictsClient";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({
  searchParams,
}: {
  // Next.js 16 pode tipar searchParams como Promise nos types gerados.
  searchParams?: Promise<SearchParams>;
}) {
  await requireDirector();

  const sp = (await searchParams) ?? {};
  const shift = typeof sp?.shift === "string" ? sp.shift : "MANHA";

  return (
    <Shell
      title="Conflitos de horários"
      subtitle="Lista conflitos detectados ao tentar montar a grade a partir das habilitações por horário (professores)."
    >
      <ScheduleConflictsClient initialShift={shift} />
    </Shell>
  );
}
