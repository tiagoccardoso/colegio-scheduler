import { NextRequest, NextResponse } from 'next/server'
import { insertPublicEnrollment } from '@/lib/supabase-rest'

function isEmail(value: string) {
  return /.+@.+\..+/.test(value)
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()

    const required = [
      'school_id',
      'school_name',
      'student_name',
      'student_birth_date',
      'guardian_name',
      'guardian_email',
      'guardian_phone',
      'desired_grade',
    ] as const

    for (const field of required) {
      if (!String(data?.[field] || '').trim()) {
        return NextResponse.json({ error: `Campo obrigatório ausente: ${field}` }, { status: 400 })
      }
    }

    if (!isEmail(String(data.guardian_email))) {
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
      guardian_name: String(data.guardian_name).trim(),
      guardian_email: String(data.guardian_email).trim(),
      guardian_phone: String(data.guardian_phone).trim(),
      desired_grade: String(data.desired_grade).trim(),
      shift_preference: String(data.shift_preference || '').trim(),
      previous_school: String(data.previous_school || '').trim(),
      notes: String(data.notes || '').trim(),
    })

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar pré-matrícula.' },
      { status: 500 }
    )
  }
}
