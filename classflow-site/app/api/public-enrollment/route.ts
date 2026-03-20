import { NextRequest, NextResponse } from 'next/server'
import { insertPublicEnrollment } from '@/lib/supabase-rest'

function isEmail(value: string) {
  return /.+@.+\..+/.test(value)
}

function calculateAge(dateString: string) {
  const birth = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(birth.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1
  return age >= 0 ? age : null
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const required = [
      'school_id',
      'school_name',
      'student_name',
      'student_birth_date',
      'desired_grade',
      'student_zip_code',
      'student_address_line1',
      'student_address_number',
      'student_neighborhood',
      'student_city',
      'student_state',
    ] as const

    for (const field of required) {
      if (!String(data?.[field] || '').trim()) {
        return NextResponse.json({ error: `Campo obrigatório ausente: ${field}` }, { status: 400 })
      }
    }

    const age = calculateAge(String(data.student_birth_date || '').trim())
    if (age == null) {
      return NextResponse.json({ error: 'Informe uma data de nascimento válida.' }, { status: 400 })
    }

    const isAdultStudent = age >= 18

    if (!isAdultStudent) {
      const guardianRequired = ['guardian_name', 'guardian_email', 'guardian_phone'] as const
      for (const field of guardianRequired) {
        if (!String(data?.[field] || '').trim()) {
          return NextResponse.json({ error: `Para menores de 18 anos, o campo ${field} é obrigatório.` }, { status: 400 })
        }
      }
    }

    if (String(data.guardian_email || '').trim() && !isEmail(String(data.guardian_email))) {
      return NextResponse.json({ error: 'Informe um e-mail válido do responsável.' }, { status: 400 })
    }

    await insertPublicEnrollment({
      school_id: String(data.school_id).trim(),
      school_name: String(data.school_name).trim(),
      student_name: String(data.student_name).trim(),
      student_birth_date: String(data.student_birth_date).trim(),
      student_cpf: String(data.student_cpf || '').trim(),
      student_email: String(data.student_email || '').trim(),
      student_phone: String(data.student_phone || '').trim(),
      student_zip_code: String(data.student_zip_code || '').trim(),
      student_address_line1: String(data.student_address_line1 || '').trim(),
      student_address_number: String(data.student_address_number || '').trim(),
      student_address_line2: String(data.student_address_line2 || '').trim(),
      student_neighborhood: String(data.student_neighborhood || '').trim(),
      student_city: String(data.student_city || '').trim(),
      student_state: String(data.student_state || '').trim(),
      guardian_name: String(data.guardian_name || '').trim(),
      guardian_email: String(data.guardian_email || '').trim(),
      guardian_phone: String(data.guardian_phone || '').trim(),
      desired_grade: String(data.desired_grade).trim(),
      shift_preference: String(data.shift_preference || '').trim(),
      previous_school: String(data.previous_school || '').trim(),
      notes: String(data.notes || '').trim(),
      student_age: age,
      is_adult_student: isAdultStudent,
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar pré-matrícula.' },
      { status: 500 }
    )
  }
}
