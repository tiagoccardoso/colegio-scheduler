import { Card } from '@/components/ui'
import { Section, SectionTitle } from '@/components/section'
import { TRAINING_VIDEOS } from '@/lib/training-videos'
import { YouTubeEmbed } from '@/components/youtube-embed'
import { LiveDemoRequest } from '@/components/live-demo-request'

export const metadata = { title: 'Treinamentos' }

export default function TreinamentosPage() {
  return (
    <div>
      <Section className="pt-4">
        <SectionTitle
          kicker="Treinamentos"
          title="Treinamentos em vídeo"
          description="Tutoriais rápidos para aprender o fluxo do ClassFlow. No final da página, você também pode solicitar uma demonstração ao vivo."
        />

        <div className="mt-8">
          <div className="text-sm font-semibold text-zinc-900">Vídeos de treinamento</div>
          <p className="mt-1 text-sm text-zinc-600">Assista direto daqui (sem sair da página).</p>

          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TRAINING_VIDEOS.map((v) => (
              <Card key={v.youtubeId} className="p-4">
                <YouTubeEmbed videoId={v.youtubeId} title={v.title} />
                <div className="mt-3">
                  <div className="text-sm font-semibold text-zinc-900">{v.title}</div>
                  {v.description ? <p className="mt-1 text-sm text-zinc-600">{v.description}</p> : null}
                  <a
                    className="mt-2 inline-flex text-xs font-semibold text-brand-700 hover:underline"
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Abrir no YouTube
                  </a>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <LiveDemoRequest />
        </div>
      </Section>
    </div>
  )
}
