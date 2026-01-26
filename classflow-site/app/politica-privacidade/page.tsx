import { Card } from '@/components/ui'

export const metadata = { title: 'Política de Privacidade' }

export default function PrivacidadePage() {
  return (
    <div className="py-6">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Política de privacidade</h1>
      <p className="mt-3 max-w-2xl text-sm text-zinc-600">Texto base. Ajuste conforme LGPD e suas práticas.</p>
      <Card className="mt-8">
        <div className="prose">
          <h2>Dados coletados</h2>
          <p>
            O ClassFlow trata dados administrativos (por exemplo: professores, turmas, disciplinas, salas e horários) com a finalidade de montar e organizar a grade escolar.
          </p>
          <h2>Uso de IA</h2>
          <p>
            Quando você aciona recursos de IA, informações necessárias para gerar sugestões (ex.: critérios do professor e conflitos de horário) podem ser enviadas a um provedor de IA.
            Recomendamos evitar inserir dados sensíveis que não sejam necessários.
          </p>
          <h2>Segurança</h2>
          <p>
            Aplicamos medidas técnicas e organizacionais razoáveis para proteger informações contra acesso não autorizado.
          </p>
          <h2>Contato</h2>
          <p>
            Para solicitações relacionadas à privacidade: contato@classflow.app.
          </p>
        </div>
      </Card>
    </div>
  )
}
