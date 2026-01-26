import { redirect } from 'next/navigation'

export const metadata = { title: 'Acesso' }

export default function AcessoPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://seusistema.vercel.app'
  redirect(appUrl)
}
