export type TrainingVideo = {
  title: string
  url: string
  youtubeId: string
  description?: string
}

function getYouTubeId(url: string) {
  try {
    const u = new URL(url)

    // https://youtu.be/<id>
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace(/^\//, '')
    }

    // https://www.youtube.com/watch?v=<id>
    const v = u.searchParams.get('v')
    if (v) return v

    // https://www.youtube.com/embed/<id>
    const embed = u.pathname.match(/\/embed\/([^/?]+)/)
    if (embed?.[1]) return embed[1]
  } catch {
    // ignore
  }

  // Fallback bem permissivo (caso venha um link diferente)
  const m = url.match(/(?:youtu\.be\/|v=|\/embed\/)([A-Za-z0-9_-]{6,})/)
  if (m?.[1]) return m[1]

  return url
}

const RAW_VIDEOS: Array<Omit<TrainingVideo, 'youtubeId'>> = [
  {
    title: 'Acessar o sistema',
    url: 'https://youtu.be/Fa0__5nZJbs',
    description: 'Passo a passo para entrar no ClassFlow (login), checar o ambiente e resolver o básico de acesso para começar a usar.',
  },
  {
    title: 'Visão geral',
    url: 'https://youtu.be/Oka0TwaftEI',
    description: 'Tour rápido pela navegação: onde ficam os módulos principais e qual é o fluxo típico (cadastros → grade → ajustes → relatórios).',
  },
  {
    title: 'Cadastros',
    url: 'https://youtu.be/xwevT9AShUA',
    description: 'Como preencher os cadastros que alimentam a grade (professores, turmas, disciplinas e parâmetros essenciais) para evitar inconsistências.',
  },
  {
    title: 'Parametrizando com IA',
    url: 'https://youtu.be/MXuISmfcdhk',
    description: 'Configuração de regras e preferências para a IA sugerir uma grade melhor: prioridades, restrições e como interpretar os resultados.',
  },
  {
    title: 'Relatórios',
    url: 'https://youtu.be/Rk1XaHa7kdc',
    description: 'Leitura dos relatórios para validar a grade e tomar decisões: conferências, indicadores e pontos de atenção antes de publicar.',
  },
]

export const TRAINING_VIDEOS: TrainingVideo[] = RAW_VIDEOS.map((v) => ({
  ...v,
  youtubeId: getYouTubeId(v.url),
}))
