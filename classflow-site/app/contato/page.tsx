import { notFound } from 'next/navigation'

export const metadata = {
  title: 'Página não encontrada',
}

export default function ContatoPage() {
  notFound()
}
