import { NextResponse } from 'next/server'
import { fetchSchoolsFromSupabase } from '@/lib/supabase-rest'

export async function GET() {
  try {
    const schools = await fetchSchoolsFromSupabase()
    return NextResponse.json({ schools })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao consultar colégios.' },
      { status: 500 }
    )
  }
}
