const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const SUPABASE_SCHOOLS_TABLE = process.env.NEXT_PUBLIC_SUPABASE_SCHOOLS_TABLE || 'schools'
export const SUPABASE_PUBLIC_ENROLLMENT_TABLE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLIC_ENROLLMENT_TABLE || 'public_enrollment_submissions'
export const SUPABASE_SCHOOL_ID_COLUMN = process.env.NEXT_PUBLIC_SUPABASE_SCHOOL_ID_COLUMN || 'id'
export const SUPABASE_SCHOOL_NAME_COLUMN = process.env.NEXT_PUBLIC_SUPABASE_SCHOOL_NAME_COLUMN || 'name'
export const SUPABASE_SCHOOL_CITY_COLUMN = process.env.NEXT_PUBLIC_SUPABASE_SCHOOL_CITY_COLUMN || 'city'
export const SUPABASE_SCHOOL_STATE_COLUMN = process.env.NEXT_PUBLIC_SUPABASE_SCHOOL_STATE_COLUMN || 'state_code'

function getSupabaseHeaders() {
  const key = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

  if (!SUPABASE_URL || !key) {
    throw new Error(
      'Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY. Para inserções seguras no servidor, prefira também SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
}

function getRestUrl(path: string, query?: string) {
  if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL não definida.')
  const base = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${path}`
  return query ? `${base}?${query}` : base
}

export type SchoolOption = {
  id: string
  name: string
  city: string
  state_code: string
}

export async function fetchSchoolsFromSupabase(): Promise<SchoolOption[]> {
  const headers = getSupabaseHeaders()
  const query = new URLSearchParams({
    select: `${SUPABASE_SCHOOL_ID_COLUMN},${SUPABASE_SCHOOL_NAME_COLUMN},${SUPABASE_SCHOOL_CITY_COLUMN},${SUPABASE_SCHOOL_STATE_COLUMN}`,
    order: `${SUPABASE_SCHOOL_NAME_COLUMN}.asc`,
    public_enrollment_visible: 'eq.true',
  })

  const response = await fetch(getRestUrl(SUPABASE_SCHOOLS_TABLE, query.toString()), {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Não foi possível consultar os colégios no Supabase. ${message}`)
  }

  const rows = (await response.json()) as Record<string, unknown>[]

  return rows
    .map((row) => ({
      id: String(row[SUPABASE_SCHOOL_ID_COLUMN] ?? ''),
      name: String(row[SUPABASE_SCHOOL_NAME_COLUMN] ?? ''),
      city: String(row[SUPABASE_SCHOOL_CITY_COLUMN] ?? '').trim(),
      state_code: String(row[SUPABASE_SCHOOL_STATE_COLUMN] ?? '')
        .trim()
        .toUpperCase(),
    }))
    .filter((row) => row.id && row.name && row.city && row.state_code)
}

export async function isSchoolPublicEnrollmentVisible(schoolId: string) {
  const headers = getSupabaseHeaders()
  const query = new URLSearchParams({
    select: `${SUPABASE_SCHOOL_ID_COLUMN}`,
    [SUPABASE_SCHOOL_ID_COLUMN]: `eq.${schoolId}`,
    public_enrollment_visible: 'eq.true',
    limit: '1',
  })

  const response = await fetch(getRestUrl(SUPABASE_SCHOOLS_TABLE, query.toString()), {
    method: 'GET',
    headers,
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Não foi possível validar a visibilidade do colégio. ${message}`)
  }

  const rows = (await response.json()) as Record<string, unknown>[]
  return Array.isArray(rows) && rows.length > 0
}

export type PublicEnrollmentPayload = {
  school_id: string
  school_name: string
  student_name: string
  student_birth_date: string
  student_cpf?: string
  student_email?: string
  student_phone?: string
  student_zip_code: string
  student_address_line1: string
  student_address_number: string
  student_address_line2?: string
  student_neighborhood: string
  student_city: string
  student_state: string
  guardian_name?: string
  guardian_email?: string
  guardian_phone?: string
  desired_grade: string
  shift_preference?: string
  previous_school?: string
  notes?: string
  student_age?: number
  is_adult_student?: boolean
}

export async function insertPublicEnrollment(payload: PublicEnrollmentPayload) {
  const headers = {
    ...getSupabaseHeaders(),
    Prefer: 'return=representation',
  }

  const body = {
    school_id: payload.school_id,
    school_name: payload.school_name,
    student_name: payload.student_name,
    student_birth_date: payload.student_birth_date,
    student_cpf: payload.student_cpf || null,
    student_email: payload.student_email || null,
    student_phone: payload.student_phone || null,
    student_zip_code: payload.student_zip_code || null,
    student_address_line1: payload.student_address_line1 || null,
    student_address_number: payload.student_address_number || null,
    student_address_line2: payload.student_address_line2 || null,
    student_neighborhood: payload.student_neighborhood || null,
    student_city: payload.student_city || null,
    student_state: payload.student_state || null,
    student_age: typeof payload.student_age === 'number' ? payload.student_age : null,
    is_adult_student: typeof payload.is_adult_student === 'boolean' ? payload.is_adult_student : null,
    guardian_name: payload.guardian_name || null,
    guardian_email: payload.guardian_email || null,
    guardian_phone: payload.guardian_phone || null,
    desired_grade: payload.desired_grade,
    shift_preference: payload.shift_preference || null,
    previous_school: payload.previous_school || null,
    notes: payload.notes || null,
    status: 'PENDENTE',
    source: 'SITE_PUBLICO',
    submitted_at: new Date().toISOString(),
    payload: {
      ...payload,
      student_address: {
        zip_code: payload.student_zip_code,
        address_line1: payload.student_address_line1,
        address_number: payload.student_address_number,
        address_line2: payload.student_address_line2 || null,
        neighborhood: payload.student_neighborhood,
        city: payload.student_city,
        state: payload.student_state,
      },
    },
  }

  const response = await fetch(getRestUrl(SUPABASE_PUBLIC_ENROLLMENT_TABLE), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      `Não foi possível salvar a pré-matrícula pública. Verifique se a tabela temporária existe no Supabase e se contém as colunas esperadas. ${message}`
    )
  }

  return response.json()
}
