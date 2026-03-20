import { Section, SectionTitle } from '@/components/section'
import { Badge } from '@/components/ui'
import { PublicEnrollmentForm } from '@/components/public-enrollment-form'

export const metadata = {
  title: 'Matrícula pública',
  description:
    'Página pública para o estudante ou responsável solicitar matrícula em um colégio cadastrado no ClassFlow.',
}

export default function MatriculaPage() {
  return (
    <div>
      <Section className="pt-4">
        <Badge>Matrícula pública</Badge>
        <div className="mt-5 max-w-3xl">
          <SectionTitle
            title="Solicite sua matrícula online"
            description="Escolha o colégio desejado, preencha os dados do estudante e do responsável e envie a solicitação. O colégio receberá o pedido no sistema para revisar e aprovar a efetivação do cadastro."
          />
        </div>

        <div className="mt-10">
          <PublicEnrollmentForm />
        </div>
      </Section>
    </div>
  )
}
