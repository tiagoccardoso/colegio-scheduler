'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui'

type SchoolOption = {
  id: string
  name: string
}

type FormState = {
  school_id: string
  school_name: string
  student_name: string
  student_birth_date: string
  student_cpf: string
  student_email: string
  student_phone: string
  guardian_name: string
  guardian_email: string
  guardian_phone: string
  desired_grade: string
  shift_preference: string
  previous_school: string
  notes: string
}

const initialState: FormState = {
  school_id: '',
  school_name: '',
  student_name: '',
  student_birth_date: '',
  student_cpf: '',
  student_email: '',
  student_phone: '',
  guardian_name: '',
  guardian_email: '',
  guardian_phone: '',
  desired_grade: '',
  shift_preference: '',
  previous_school: '',
  notes: '',
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-zinc-900">
        {label}
        {required ? <span className="text-brand-700"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'h-11 rounded-xl border border-black/10 bg-white px-3 text-sm text-zinc-900 shadow-soft outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100'

export function PublicEnrollmentForm() {
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [schoolError, setSchoolError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(initialState)

  useEffect(() => {
    let active = true

    async function loadSchools() {
      try {
        setLoadingSchools(true)
        const response = await fetch('/api/public-enrollment/schools', { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok) throw new Error(json?.error || 'Erro ao carregar colégios.')
        if (active) setSchools(Array.isArray(json.schools) ? json.schools : [])
      } catch (error: any) {
        if (active) setSchoolError(error?.message || 'Erro ao carregar colégios.')
      } finally {
        if (active) setLoadingSchools(false)
      }
    }

    loadSchools()
    return () => {
      active = false
    }
  }, [])

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === form.school_id) || null,
    [schools, form.school_id]
  )

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    if (submitError) setSubmitError(null)
    if (success) setSuccess(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSuccess(null)

    if (!selectedSchool) {
      setSubmitError('Selecione o colégio em que deseja solicitar a matrícula.')
      return
    }

    setSubmitting(true)

    try {
      const payload = {
        ...form,
        school_name: selectedSchool.name,
      }

      const response = await fetch('/api/public-enrollment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await response.json()
      if (!response.ok) throw new Error(json?.error || 'Erro ao enviar matrícula.')

      setSuccess(
        'Sua solicitação foi enviada com sucesso. Agora o colégio poderá revisar os dados no sistema e aprovar a efetivação da matrícula.'
      )
      setForm(initialState)
    } catch (error: any) {
      setSubmitError(error?.message || 'Erro ao enviar matrícula.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <div className="text-sm font-semibold text-zinc-900">Como funciona</div>
        <ol className="mt-4 space-y-4 text-sm text-zinc-600">
          <li>
            <span className="font-semibold text-zinc-900">1. Escolha o colégio.</span> A lista é consultada diretamente no mesmo banco do sistema.
          </li>
          <li>
            <span className="font-semibold text-zinc-900">2. Preencha os dados do estudante e do responsável.</span> O envio cria uma pré-matrícula temporária para análise.
          </li>
          <li>
            <span className="font-semibold text-zinc-900">3. Aguarde a aprovação do colégio.</span> A equipe da escola verá o pedido no sistema e poderá efetivar o cadastro.
          </li>
        </ol>

        <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-zinc-700">
          <div className="font-semibold text-zinc-900">Importante</div>
          <p className="mt-2 leading-6">
            Este envio não cria a matrícula definitiva automaticamente. Ele registra uma solicitação para revisão interna do colégio.
          </p>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-zinc-900">Formulário público de matrícula</div>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Preencha os campos abaixo para enviar a solicitação de matrícula. Os dados serão encaminhados ao colégio escolhido para conferência e aprovação.
        </p>

        {schoolError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{schoolError}</div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
        ) : null}

        {submitError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        ) : null}

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <Field label="Colégio" required>
            <select
              className={inputClass}
              value={form.school_id}
              onChange={(e) => update('school_id', e.target.value)}
              disabled={loadingSchools}
              required
            >
              <option value="">{loadingSchools ? 'Carregando colégios...' : 'Selecione o colégio'}</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do estudante" required>
              <input className={inputClass} value={form.student_name} onChange={(e) => update('student_name', e.target.value)} required />
            </Field>
            <Field label="Data de nascimento" required>
              <input type="date" className={inputClass} value={form.student_birth_date} onChange={(e) => update('student_birth_date', e.target.value)} required />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="CPF do estudante">
              <input className={inputClass} value={form.student_cpf} onChange={(e) => update('student_cpf', e.target.value)} />
            </Field>
            <Field label="E-mail do estudante">
              <input type="email" className={inputClass} value={form.student_email} onChange={(e) => update('student_email', e.target.value)} />
            </Field>
            <Field label="Telefone do estudante">
              <input className={inputClass} value={form.student_phone} onChange={(e) => update('student_phone', e.target.value)} />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome do responsável" required>
              <input className={inputClass} value={form.guardian_name} onChange={(e) => update('guardian_name', e.target.value)} required />
            </Field>
            <Field label="E-mail do responsável" required>
              <input type="email" className={inputClass} value={form.guardian_email} onChange={(e) => update('guardian_email', e.target.value)} required />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Telefone do responsável" required>
              <input className={inputClass} value={form.guardian_phone} onChange={(e) => update('guardian_phone', e.target.value)} required />
            </Field>
            <Field label="Série pretendida" required>
              <input className={inputClass} value={form.desired_grade} onChange={(e) => update('desired_grade', e.target.value)} placeholder="Ex.: 1º ano" required />
            </Field>
            <Field label="Turno de preferência">
              <select className={inputClass} value={form.shift_preference} onChange={(e) => update('shift_preference', e.target.value)}>
                <option value="">Selecione</option>
                <option value="Manhã">Manhã</option>
                <option value="Tarde">Tarde</option>
                <option value="Noite">Noite</option>
                <option value="Integral">Integral</option>
              </select>
            </Field>
          </div>

          <Field label="Escola de origem">
            <input className={inputClass} value={form.previous_school} onChange={(e) => update('previous_school', e.target.value)} />
          </Field>

          <Field label="Observações adicionais">
            <textarea
              className="min-h-[120px] rounded-xl border border-black/10 bg-white px-3 py-3 text-sm text-zinc-900 shadow-soft outline-none transition focus:border-brand-300 focus:ring-2 focus:ring-brand-100"
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Conte alguma informação importante para o colégio analisar sua solicitação."
            />
          </Field>

          <button
            type="submit"
            disabled={submitting || loadingSchools}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Enviando solicitação...' : 'Enviar solicitação de matrícula'}
          </button>
        </form>
      </Card>
    </div>
  )
}
