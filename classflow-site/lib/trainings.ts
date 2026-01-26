import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

export type TrainingMeta = {
  slug: string
  title: string
  description: string
  level: 'Iniciante' | 'Intermediário' | 'Avançado'
  duration: string
  updatedAt: string
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'trainings')

export function getAllTrainings(): TrainingMeta[] {
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith('.md'))
  const items = files.map((file) => {
    const slug = file.replace(/\.md$/, '')
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
    const { data } = matter(raw)
    return {
      slug,
      title: String(data.title || slug),
      description: String(data.description || ''),
      level: (data.level as TrainingMeta['level']) || 'Iniciante',
      duration: String(data.duration || '—'),
      updatedAt: String(data.updatedAt || ''),
    }
  })

  return items.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
}

export async function getTrainingBySlug(slug: string): Promise<{ meta: TrainingMeta; contentHtml: string } | null> {
  const file = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(file)) return null

  const raw = fs.readFileSync(file, 'utf8')
  const { data, content } = matter(raw)
  const processed = await remark().use(html).process(content)

  const meta: TrainingMeta = {
    slug,
    title: String(data.title || slug),
    description: String(data.description || ''),
    level: (data.level as TrainingMeta['level']) || 'Iniciante',
    duration: String(data.duration || '—'),
    updatedAt: String(data.updatedAt || ''),
  }

  return { meta, contentHtml: processed.toString() }
}
