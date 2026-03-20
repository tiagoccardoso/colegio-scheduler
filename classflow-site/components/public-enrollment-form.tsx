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
  student_zip_code: string
  student_address_line1: string
  student_address_number: string
  student_address_line2: string
  student_neighborhood: string
  student_city: string
  student_state: string
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
  student_zip_code: '',
  student_address_line1: '',
  student_address_number: '',
  student_address_line2: '',
  student_neighborhood: '',
  student_city: '',
  student_state: '',
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

function calculateAge(dateString: string) {
  if (!dateString) return null
  const birth = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? age : null
}

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

  const studentAge = useMemo(() => calculateAge(form.student_birth_date), [form.student_birth_date])
  const isAdultStudent = studentAge != null && studentAge >= 18

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

    if (!isAdultStudent && (!form.guardian_name.trim() || !form.guardian_email.trim() || !form.guardian_phone.trim())) {
      setSubmitError('Para estudantes menores de 18 anos, os dados do responsável são obrigatórios.')
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

          {studentAge != null ? (
            <div className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              <span className="font-semibold text-zinc-900">Idade calculada automaticamente:</span> {studentAge} {studentAge === 1 ? 'ano' : 'anos'}.
              {isAdultStudent ? ' Como o aluno tem 18 anos ou mais, os dados do responsável são opcionais.' : ' Como o aluno é menor de idade, os dados do responsável são obrigatórios.'}
            </div>
          ) : null}

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

          <div className="rounded-2xl border border-black/5 p-4">
            <div className="text-sm font-semibold text-zinc-900">Endereço do estudante</div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="CEP" required>
                <input className={inputClass} value={form.student_zip_code} onChange={(e) => update('student_zip_code', e.target.value)} required />
              </Field>
              <Field label="Cidade" required>
                <input className={inputClass} value={form.student_city} onChange={(e) => update('student_city', e.target.value)} required />
              </Field>
              <Field label="UF" required>
                <input className={inputClass} value={form.student_state} onChange={(e) => update('student_state', e.target.value)} maxLength={2} required />
              </Field>
              <Field label="Logradouro" required>
                <input className={inputClass} value={form.student_address_line1} onChange={(e) => update('student_address_line1', e.target.value)} required />
              </Field>
              <Field label="Número" required>
                <input className={inputClass} value={form.student_address_number} onChange={(e) => update('student_address_number', e.target.value)} required />
              </Field>
              <Field label="Complemento">
                <input className={inputClass} value={form.student_address_line2} onChange={(e) => update('student_address_line2', e.target.value)} />
              </Field>
              <Field label="Bairro" required>
                <input className={inputClass} value={form.student_neighborhood} onChange={(e) => update('student_neighborhood', e.target.value)} required />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-zinc-900">Responsável</div>
              <span className="text-xs text-zinc-500">{isAdultStudent ? 'Opcional para maiores de 18 anos' : 'Obrigatório para menores de 18 anos'}</span>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Nome do responsável" required={!isAdultStudent}>
                <input className={inputClass} value={form.guardian_name} onChange={(e) => update('guardian_name', e.target.value)} required={!isAdultStudent} />
              </Field>
              <Field label="E-mail do responsável" required={!isAdultStudent}>
                <input type="email" className={inputClass} value={form.guardian_email} onChange={(e) => update('guardian_email', e.target.value)} required={!isAdultStudent} />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <Field label="Telefone do responsável" required={!isAdultStudent}>
                <input className={inputClass} value={form.guardian_phone} onChange={(e) => update('guardian_phone', e.target.value)} required={!isAdultStudent} />
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
          </div>

          <Field label="Escola de origem">
            <input className={inputClass} value={form.previous_school} onChange={(e) => update('previous_school', e.target.value)} />
          </Field>

          <Field label="Observações adicionais">
            <textarea className={`${inputClass} min-h-[110px] py-3`} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
          </Field>

          <button type="submit" className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting || loadingSchools}>
            {submitting ? 'Enviando solicitação...' : 'Enviar solicitação de matrícula'}
          </button>
        </form>
      </Card>
    </div>
  )
}
