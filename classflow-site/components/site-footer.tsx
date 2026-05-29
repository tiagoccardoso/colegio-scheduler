import Link from 'next/link'
import { APP_URL } from '@/lib/app-url'
import { CONTACT_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE_DISPLAY, CONTACT_TEL_URL, CONTACT_WHATSAPP_URL } from '@/lib/contact'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-black/5 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 text-white shadow-soft">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M7 4h10a3 3 0 0 1 3 3v13a2 2 0 0 1-2 2H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M7 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M7 16h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </span>
              <span className="text-sm font-bold tracking-tight text-zinc-900">ClassFlow</span>
            </div>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Plataforma de gestão acadêmica com IA para organizar cadastros, matriz curricular, grade, Novo Ensino Médio, jornada do aluno e documentos escolares.
            </p>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brand-700 mb-3">Produto</div>
              <ul className="space-y-2.5 text-sm">
                <li><Link className="text-zinc-500 hover:text-zinc-900 transition-colors" href="/produto">Visão geral</Link></li>
                <li><Link className="text-zinc-500 hover:text-zinc-900 transition-colors" href="/planos">Planos</Link></li>
                <li><Link className="text-zinc-500 hover:text-zinc-900 transition-colors" href="/treinamentos">Treinamentos</Link></li>
                <li><a className="text-zinc-500 hover:text-zinc-900 transition-colors" href={APP_URL}>Acessar sistema</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-brand-700 mb-3">Legal</div>
              <ul className="space-y-2.5 text-sm">
                <li><Link className="text-zinc-500 hover:text-zinc-900 transition-colors" href="/termos">Termos</Link></li>
                <li><Link className="text-zinc-500 hover:text-zinc-900 transition-colors" href="/politica-privacidade">Privacidade</Link></li>
              </ul>
            </div>
          </div>

          {/* Contact */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-brand-700 mb-3">Contato</div>
            <p className="text-sm text-zinc-500 leading-relaxed mb-4">
              Para demonstração, implantação, treinamentos e dúvidas sobre a plataforma.
            </p>
            <div className="space-y-2 text-sm">
              <p className="text-zinc-600">
                <span className="font-semibold text-zinc-800">E-mail:</span>{' '}
                <a className="hover:text-brand-700 transition-colors" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </p>
              <p className="text-zinc-600">
                <span className="font-semibold text-zinc-800">Telefone / WhatsApp:</span>{' '}
                <a className="hover:text-brand-700 transition-colors" href={CONTACT_TEL_URL}>
                  {CONTACT_PHONE_DISPLAY}
                </a>
                <span className="text-zinc-400"> · </span>
                <a className="hover:text-brand-700 transition-colors" href={CONTACT_WHATSAPP_URL} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              </p>
              <p className="text-zinc-600">
                <span className="font-semibold text-zinc-800">Endereço:</span>{' '}
                {CONTACT_ADDRESS}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-black/5 pt-6 text-xs text-zinc-400 md:flex-row md:items-center md:justify-between">
          <p>© {year} ClassFlow. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  )
}
