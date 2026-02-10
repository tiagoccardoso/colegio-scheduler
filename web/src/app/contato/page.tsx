import Link from "next/link";

import { SupportLinks } from "@/components/SupportLinks";
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/support";

export const metadata = {
  title: "Contato — Colégio Scheduler",
};

export default function ContatoPage() {
  return (
    <div className="page-container py-12">
      <div className="panel p-6">
        <div className="badge w-fit">Suporte</div>

        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Contato</h1>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          Precisa de ajuda, quer tirar dúvidas ou reportar um problema? Fale com a gente.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <a
            className="panel-inner block p-4 hover:opacity-95"
            href={`mailto:${SUPPORT_EMAIL}`}
          >
            <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">E-mail</div>
            <div className="mt-1 text-base font-semibold underline underline-offset-2">{SUPPORT_EMAIL}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Clique para abrir seu cliente de e-mail.</div>
          </a>

          <a
            className="panel-inner block p-4 hover:opacity-95"
            href={`tel:${SUPPORT_PHONE_TEL}`}
          >
            <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Telefone</div>
            <div className="mt-1 text-base font-semibold underline underline-offset-2">{SUPPORT_PHONE_DISPLAY}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">Clique para ligar (em dispositivos compatíveis).</div>
          </a>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/login" className="btn btn-secondary">
            Voltar para o login
          </Link>
          <Link href="/" className="btn btn-ghost">
            Ir para a página inicial
          </Link>
        </div>

        <footer className="mt-10 border-t border-zinc-200/60 pt-6 text-center text-xs text-zinc-500 dark:border-zinc-900/60 dark:text-zinc-500">
          <div className="flex flex-col items-center gap-2">
            <div>MVP — Colégio Scheduler</div>
            <SupportLinks showContatoLink={false} />
          </div>
        </footer>
      </div>
    </div>
  );
}
