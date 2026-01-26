import { Card } from '@/components/ui'

export const metadata = { title: 'Termos' }

export default function TermosPage() {
  return (
    <div className="py-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Termos de uso</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-600">Modelo inicial. Ajuste com seu jurídico.</p>
      <Card className="mt-8">
        <div className="prose">
          <h2>1. Uso do sistema</h2>
          <p>O ClassFlow é um software para organização de cadastros, montagem de grade e geração de relatórios escolares.</p>
          <h2>2. Assinatura</h2>
          <p>A assinatura dá direito ao acesso aos recursos do plano contratado enquanto estiver ativa.</p>
          <h2>3. Dados</h2>
          <p>Os dados cadastrados pela escola permanecem sob responsabilidade da própria instituição.</p>
          <h2>4. Suporte</h2>
          <p>O suporte é prestado em horário comercial, pelos canais informados no site.</p>
        </div>
      </Card>
    </div>
  )
}
