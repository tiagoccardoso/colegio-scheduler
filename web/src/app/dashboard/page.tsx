import { requireDirector } from "@/lib/require-director";
import { Shell } from "@/components/Shell";

export default async function DashboardPage() {
  const { profile } = await requireDirector();

  return (
    <Shell title="Dashboard" subtitle={profile.full_name ? `Olá, ${profile.full_name}` : "Olá!"}>
      <div className="grid gap-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <h2 className="text-lg font-semibold">Fluxo recomendado</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
            <li>Cadastre <strong>Disciplinas</strong></li>
            <li>Cadastre <strong>Salas</strong></li>
            <li>Cadastre <strong>Turmas</strong></li>
            <li>Cadastre <strong>Horários</strong></li>
            <li>Cadastre <strong>Professores</strong></li>
            <li>Monte a grade em <strong>Montar grade</strong></li>
            <li>Revise e ajuste em <strong>Relatórios</strong></li>
          </ol>
        </div>
      </div>
    </Shell>
  );
}
