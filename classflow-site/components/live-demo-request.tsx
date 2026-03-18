'use client'

import { useMemo, useState } from 'react'
import { Card } from '@/components/ui'
import { CONTACT_EMAIL, CONTACT_PHONE_E164 } from '@/lib/contact'

function buildBody(params: {
  nome: string
  escola: string
  contato: string
  horario: string
  mensagem: string
}) {
  const linhas = [
    'Olá! Gostaria de solicitar uma demonstração ao vivo do ClassFlow.',
    '',
    `Nome: ${params.nome || '-'}`,
    `Escola / Município: ${params.escola || '-'}`,
    `Contato (e-mail ou WhatsApp): ${params.contato || '-'}`,
    params.horario ? `Melhor horário: ${params.horario}` : '',
    '',
    params.mensagem ? `Mensagem: ${params.mensagem}` : 'Mensagem: -',
  ].filter(Boolean)

  return linhas.join('\n')
}

export function LiveDemoRequest() {
  const [nome, setNome] = useState('')
  const [escola, setEscola] = useState('')
  const [contato, setContato] = useState('')
  const [horario, setHorario] = useState('')
  const [mensagem, setMensagem] = useState('')

  const body = useMemo(() => buildBody({ nome, escola, contato, horario, mensagem }), [nome, escola, contato, horario, mensagem])

  const canSend = nome.trim().length > 1 && contato.trim().length > 3

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(body)
    return `https://wa.me/${CONTACT_PHONE_E164}?text=${text}`
  }, [body])

  const emailHref = useMemo(() => {
    const subject = encodeURIComponent('Demonstração ao vivo — ClassFlow')
    const encodedBody = encodeURIComponent(body)
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${encodedBody}`
  }, [body])

  return (
    <Card className="p-6">
      <div className="text-sm font-semibold text-zinc-900">Solicitar demonstração ao vivo</div>
      <p className="mt-2 text-sm text-zinc-600">
        Preencha os campos e envie a mensagem já montada por WhatsApp ou e-mail para agendar uma apresentação focada no seu cenário escolar.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Seu nome</span>
          <input
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Maria Souza"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-xs font-semibold text-zinc-700">Contato (e-mail ou WhatsApp)</span>
          <input
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            placeholder="Ex.: (11) 99999-9999 ou email@escola.com"
          />
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-zinc-700">Escola / Município</span>
          <input
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={escola}
            onChange={(e) => setEscola(e.target.value)}
            placeholder="Ex.: E.M. João XXIII — Pato Branco/PR"
          />
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-zinc-700">Melhor horário para falar (opcional)</span>
          <input
            className="h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={horario}
            onChange={(e) => setHorario(e.target.value)}
            placeholder="Ex.: manhã (8h–11h) / tarde / após 18h"
          />
        </label>

        <label className="grid gap-1 md:col-span-2">
          <span className="text-xs font-semibold text-zinc-700">Mensagem (opcional)</span>
          <textarea
            className="min-h-[110px] rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 shadow-soft focus:outline-none focus:ring-2 focus:ring-brand-200"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Ex.: Queremos ver o fluxo de cadastros, matriz curricular, grade com IA, NEM e documentos do aluno."
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className={
            'inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 ' +
            (canSend ? '' : 'pointer-events-none opacity-50')
          }
        >
          Enviar no WhatsApp
        </a>

        <a
          href={emailHref}
          className={
            'inline-flex h-11 items-center justify-center rounded-xl border border-black/10 bg-white px-5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50 ' +
            (canSend ? '' : 'pointer-events-none opacity-50')
          }
        >
          Enviar por e-mail
        </a>
      </div>

      {!canSend ? (
        <p className="mt-3 text-xs text-zinc-500">Preencha pelo menos seu nome e um contato para habilitar o envio.</p>
      ) : null}
    </Card>
  )
}
