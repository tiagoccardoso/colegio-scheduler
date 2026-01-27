import { redirect } from 'next/navigation'
import { APP_URL } from '@/lib/app-url'

export const metadata = { title: 'Acesso' }

export default function AcessoPage() {
  redirect(APP_URL)
}
