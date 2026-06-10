import Link from 'next/link'
import { APP_URL } from '@/lib/app-url'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1.8fr]">
          <div>
            <div className="text-sm font-semibold text-zinc-900">ClassFlow</div>
            <p className="mt-2 text-sm text-zinc-600">
              Plataforma de gestão acadêmica com IA para organizar cadastros, matriz curricular, grade, Novo Ensino Médio, jornada do aluno e documentos escolares.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Produto</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/produto">Visão geral</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/planos">Planos</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/treinamentos">Treinamentos</Link></li>
                <li><a className="text-zinc-600 hover:text-zinc-900" href={APP_URL}>Acessar sistema</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Legal</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/termos">Termos</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/politica-privacidade">Privacidade</Link></li>
              </ul>
            </div>
          </div>

        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>© {year} ClassFlow. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
