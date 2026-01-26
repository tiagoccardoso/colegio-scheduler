import Link from 'next/link'

export function SiteFooter() {
  const year = new Date().getFullYear()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'

  return (
    <footer className="border-t border-black/5 bg-white/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">ClassFlow</div>
            <p className="mt-2 text-sm text-zinc-600">
              A inteligência artificial auxilia na organização das regras da escola e monta automaticamente uma grade de horários sem conflitos.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2 text-xs text-brand-900">
              <span className="h-2 w-2 rounded-full bg-brand-600" />
              Funcionando bem na Vercel + Supabase + Stripe
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Produto</div>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/produto">Visão geral</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/planos">Planos</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href="/treinamentos">Treinamentos</Link></li>
                <li><Link className="text-zinc-600 hover:text-zinc-900" href={appUrl}>Acessar sistema</Link></li>
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

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Contato</div>
            <p className="mt-3 text-sm text-zinc-600">
              Para demonstração, implantação e dúvidas.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <p className="text-zinc-700"><span className="font-semibold">E-mail:</span> contato@classflow.app</p>
              <p className="text-zinc-700"><span className="font-semibold">WhatsApp:</span> (00) 00000-0000</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs text-zinc-500 md:flex-row md:items-center md:justify-between">
          <p>© {year} ClassFlow. Todos os direitos reservados.</p>
          <p>Feito para deixar o motor de grade bem feliz.</p>
        </div>
      </div>
    </footer>
  )
}
