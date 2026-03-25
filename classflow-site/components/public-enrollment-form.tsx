'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card } from '@/components/ui'

type SchoolOption = {
  id: string
  name: string
  city: string
  state_code: string
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
  className,
  children,
}: {
  label: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <label className={`grid min-w-0 gap-2 ${className || ''}`}>
      <span className="text-sm font-semibold text-zinc-900">
        {label}
        {required ? <span className="text-brand-700"> *</span> : null}
      </span>
      {children}
    </label>
  )
}

const inputClass =
  'h-11 w-full min-w-0 rounded-xl border border-black/10 bg-white px-3 text-sm leading-5 text-zinc-900 shadow-soft outline-none transition placeholder:text-zinc-400 focus:border-brand-300 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500'

const sectionClass = 'rounded-2xl border border-black/5 bg-zinc-50/80 p-4 sm:p-5'

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

function compareTextAsc(a: string, b: string) {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

export function PublicEnrollmentForm() {
  const [schools, setSchools] = useState<SchoolOption[]>([])
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [schoolError, setSchoolError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(initialState)
  const [selectedStateCode, setSelectedStateCode] = useState('')
  const [selectedSchoolCity, setSelectedSchoolCity] = useState('')

  useEffect(() => {
    let active = true

    async function loadSchools() {
      try {
        setLoadingSchools(true)
        setSchoolError(null)
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

  const availableStates = useMemo(() => {
    const uniqueStates = new Set(
      schools.map((school) => school.state_code?.trim().toUpperCase()).filter(Boolean)
    )

    return Array.from(uniqueStates).sort(compareTextAsc)
  }, [schools])

  const availableCities = useMemo(() => {
    if (!selectedStateCode) return []

    const uniqueCities = new Set(
      schools
        .filter((school) => school.state_code === selectedStateCode)
        .map((school) => school.city?.trim())
        .filter(Boolean)
    )

    return Array.from(uniqueCities).sort(compareTextAsc)
  }, [schools, selectedStateCode])

  const hasSchoolLocations = availableStates.length > 0

  const filteredSchools = useMemo(() => {
    return schools.filter((school) => {
      if (selectedStateCode && school.state_code !== selectedStateCode) return false
      if (selectedSchoolCity && school.city !== selectedSchoolCity) return false
      return true
    })
  }, [schools, selectedStateCode, selectedSchoolCity])

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

  function handleStateChange(value: string) {
    setSelectedStateCode(value)
    setSelectedSchoolCity('')
    update('school_id', '')
  }

  function handleCityChange(value: string) {
    setSelectedSchoolCity(value)
    update('school_id', '')
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    setSuccess(null)

    if (!selectedStateCode) {
      setSubmitError('Selecione o estado do colégio desejado.')
      return
    }

    if (!selectedSchoolCity) {
      setSubmitError('Selecione a cidade do colégio desejado.')
      return
    }

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
      setSelectedStateCode('')
      setSelectedSchoolCity('')
    } catch (error: any) {
      setSubmitError(error?.message || 'Erro ao enviar matrícula.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_minmax(0,1.1fr)]">
      <Card className="h-fit">
        <div className="text-sm font-semibold text-zinc-900">Como funciona</div>
        <ol className="mt-4 space-y-4 text-sm text-zinc-600">
          <li>
            <span className="font-semibold text-zinc-900">1. Escolha o estado e a cidade.</span> O site mostra apenas os colégios públicos cadastrados para a localidade selecionada.
          </li>
          <li>
            <span className="font-semibold text-zinc-900">2. Escolha o colégio.</span> A lista é consultada diretamente no mesmo banco do sistema.
          </li>
          <li>
            <span className="font-semibold text-zinc-900">3. Preencha os dados do estudante e do responsável.</span> O envio cria uma pré-matrícula temporária para análise.
          </li>
          <li>
            <span className="font-semibold text-zinc-900">4. Aguarde a aprovação do colégio.</span> A equipe da escola verá o pedido no sistema e poderá efetivar o cadastro.
          </li>
        </ol>

        <div className="mt-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-zinc-700">
          <div className="font-semibold text-zinc-900">Importante</div>
          <p className="mt-2 leading-6">
            Este envio não cria a matrícula definitiva automaticamente. Ele registra uma solicitação para revisão interna do colégio.
          </p>
        </div>
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="text-sm font-semibold text-zinc-900">Formulário público de matrícula</div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          Primeiro selecione o estado e a cidade do colégio desejado. Depois escolha a escola e preencha os dados para enviar a solicitação de matrícula.
        </p>

        {schoolError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{schoolError}</div>
        ) : null}

        {!loadingSchools && !schoolError && !hasSchoolLocations ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Nenhum colégio com estado e cidade cadastrados foi encontrado. Verifique se a tabela <strong>schools</strong> possui os campos de localização preenchidos para as escolas liberadas na matrícula pública.
          </div>
        ) : null}

        {success ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div>
        ) : null}

        {submitError ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</div>
        ) : null}

        <form className="mt-6 grid gap-6" onSubmit={onSubmit}>
          <div className={sectionClass}>
            <div className="text-sm font-semibold text-zinc-900">Colégio e estudante</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Comece escolhendo a localização do colégio. Depois a lista exibirá somente as escolas da cidade selecionada.</p>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Estado do colégio" required>
                  <select
                    className={inputClass}
                    value={selectedStateCode}
                    onChange={(e) => handleStateChange(e.target.value)}
                    disabled={loadingSchools || !!schoolError}
                    required
                  >
                    <option value="">
                      {loadingSchools
                        ? 'Carregando estados...'
                        : availableStates.length
                          ? 'Selecione o estado'
                          : hasSchoolLocations
                            ? 'Selecione o estado'
                            : 'Nenhum estado cadastrado'}
                    </option>
                    {availableStates.map((stateCode) => (
                      <option key={stateCode} value={stateCode}>
                        {stateCode}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Cidade do colégio" required>
                  <select
                    className={inputClass}
                    value={selectedSchoolCity}
                    onChange={(e) => handleCityChange(e.target.value)}
                    disabled={loadingSchools || !!schoolError || !selectedStateCode}
                    required
                  >
                    <option value="">
                      {!selectedStateCode
                        ? 'Selecione primeiro o estado'
                        : availableCities.length
                          ? 'Selecione a cidade'
                          : 'Nenhuma cidade cadastrada para este estado'}
                    </option>
                    {availableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Colégio" required>
                <select
                  className={inputClass}
                  value={form.school_id}
                  onChange={(e) => update('school_id', e.target.value)}
                  disabled={loadingSchools || !!schoolError || !selectedStateCode || !selectedSchoolCity}
                  required
                >
                  <option value="">
                    {!selectedStateCode
                      ? 'Selecione primeiro o estado'
                      : !selectedSchoolCity
                        ? 'Selecione primeiro a cidade'
                        : filteredSchools.length
                          ? 'Selecione o colégio'
                          : 'Nenhum colégio disponível para a cidade selecionada'}
                  </option>
                  {filteredSchools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="grid gap-4 lg:grid-cols-12">
                <Field label="Nome do estudante" required className="lg:col-span-7">
                  <input
                    className={inputClass}
                    value={form.student_name}
                    onChange={(e) => update('student_name', e.target.value)}
                    autoComplete="name"
                    required
                  />
                </Field>
                <Field label="Data de nascimento" required className="lg:col-span-5">
                  <input
                    type="date"
                    className={inputClass}
                    value={form.student_birth_date}
                    onChange={(e) => update('student_birth_date', e.target.value)}
                    required
                  />
                </Field>
              </div>
            </div>
          </div>

          {studentAge != null ? (
            <div className="rounded-xl border border-black/10 bg-zinc-50 px-4 py-3 text-sm leading-6 text-zinc-700">
              <span className="font-semibold text-zinc-900">Idade calculada automaticamente:</span> {studentAge}{' '}
              {studentAge === 1 ? 'ano' : 'anos'}.
              {isAdultStudent
                ? ' Como o aluno tem 18 anos ou mais, os dados do responsável são opcionais.'
                : ' Como o aluno é menor de idade, os dados do responsável são obrigatórios.'}
            </div>
          ) : null}

          <div className={sectionClass}>
            <div className="text-sm font-semibold text-zinc-900">Contato do estudante</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Esses dados ajudam a escola a confirmar informações e retornar o contato quando necessário.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="CPF do estudante">
                <input
                  className={inputClass}
                  value={form.student_cpf}
                  onChange={(e) => update('student_cpf', e.target.value)}
                  autoComplete="off"
                  inputMode="numeric"
                />
              </Field>
              <Field label="E-mail do estudante">
                <input
                  type="email"
                  className={inputClass}
                  value={form.student_email}
                  onChange={(e) => update('student_email', e.target.value)}
                  autoComplete="email"
                />
              </Field>
              <Field label="Telefone do estudante">
                <input
                  className={inputClass}
                  value={form.student_phone}
                  onChange={(e) => update('student_phone', e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="text-sm font-semibold text-zinc-900">Endereço do estudante</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Preencha o endereço completo para facilitar a conferência cadastral.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
              <Field label="CEP" required className="xl:col-span-2">
                <input
                  className={inputClass}
                  value={form.student_zip_code}
                  onChange={(e) => update('student_zip_code', e.target.value)}
                  autoComplete="postal-code"
                  inputMode="numeric"
                  required
                />
              </Field>
              <Field label="Cidade" required className="xl:col-span-3">
                <input
                  className={inputClass}
                  value={form.student_city}
                  onChange={(e) => update('student_city', e.target.value)}
                  autoComplete="address-level2"
                  required
                />
              </Field>
              <Field label="UF" required className="xl:col-span-1">
                <input
                  className={`${inputClass} uppercase`}
                  value={form.student_state}
                  onChange={(e) => update('student_state', e.target.value.toUpperCase())}
                  autoComplete="address-level1"
                  maxLength={2}
                  required
                />
              </Field>
              <Field label="Logradouro" required className="xl:col-span-3">
                <input
                  className={inputClass}
                  value={form.student_address_line1}
                  onChange={(e) => update('student_address_line1', e.target.value)}
                  autoComplete="address-line1"
                  required
                />
              </Field>
              <Field label="Número" required className="xl:col-span-1">
                <input
                  className={inputClass}
                  value={form.student_address_number}
                  onChange={(e) => update('student_address_number', e.target.value)}
                  autoComplete="address-line2"
                  required
                />
              </Field>
              <Field label="Complemento" className="xl:col-span-2">
                <input
                  className={inputClass}
                  value={form.student_address_line2}
                  onChange={(e) => update('student_address_line2', e.target.value)}
                />
              </Field>
              <Field label="Bairro" required className="md:col-span-2 xl:col-span-3">
                <input
                  className={inputClass}
                  value={form.student_neighborhood}
                  onChange={(e) => update('student_neighborhood', e.target.value)}
                  autoComplete="address-level3"
                  required
                />
              </Field>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="sm:flex sm:items-start sm:justify-between sm:gap-4">
              <div>
                <div className="text-sm font-semibold text-zinc-900">Responsável</div>
                <p className="mt-1 text-sm leading-6 text-zinc-600">Informe abaixo os dados do responsável legal quando o estudante for menor de idade.</p>
              </div>
              <span className="mt-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-500 sm:mt-0 sm:shrink-0">
                {isAdultStudent ? 'Opcional para maiores de 18 anos' : 'Obrigatório para menores de 18 anos'}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Nome do responsável" required={!isAdultStudent}>
                <input
                  className={inputClass}
                  value={form.guardian_name}
                  onChange={(e) => update('guardian_name', e.target.value)}
                  autoComplete="name"
                  required={!isAdultStudent}
                />
              </Field>
              <Field label="E-mail do responsável" required={!isAdultStudent}>
                <input
                  type="email"
                  className={inputClass}
                  value={form.guardian_email}
                  onChange={(e) => update('guardian_email', e.target.value)}
                  autoComplete="email"
                  required={!isAdultStudent}
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Telefone do responsável" required={!isAdultStudent}>
                <input
                  className={inputClass}
                  value={form.guardian_phone}
                  onChange={(e) => update('guardian_phone', e.target.value)}
                  autoComplete="tel"
                  inputMode="tel"
                  required={!isAdultStudent}
                />
              </Field>
            </div>
          </div>

          <div className={sectionClass}>
            <div className="text-sm font-semibold text-zinc-900">Detalhes da matrícula</div>
            <p className="mt-1 text-sm leading-6 text-zinc-600">Essas informações orientam a escola sobre a vaga e o turno desejados.</p>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Série pretendida" required>
                <input
                  className={inputClass}
                  value={form.desired_grade}
                  onChange={(e) => update('desired_grade', e.target.value)}
                  placeholder="Ex.: 1º ano"
                  required
                />
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
              <Field label="Escola de origem" className="md:col-span-2 xl:col-span-1">
                <input
                  className={inputClass}
                  value={form.previous_school}
                  onChange={(e) => update('previous_school', e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className={sectionClass}>
            <Field label="Observações adicionais">
              <textarea
                className={`${inputClass} min-h-[120px] resize-y py-3`}
                value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
              />
            </Field>
          </div>

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-soft hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            disabled={submitting || loadingSchools}
          >
            {submitting ? 'Enviando solicitação...' : 'Enviar solicitação de matrícula'}
          </button>
        </form>
      </Card>
    </div>
  )
}
