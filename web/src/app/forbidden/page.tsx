import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto max-w-lg px-4 py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <h1 className="text-xl font-semibold">Acesso negado</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Sua conta não tem permissão para acessar o painel do diretor.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
