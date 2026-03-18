import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import { remark } from 'remark'
import html from 'remark-html'

export type TrainingMeta = {
  slug: string
  title: string
  description: string
  category: string
  level: 'Iniciante' | 'Intermediário' | 'Avançado'
  duration: string
  updatedAt: string
  order: number
}

export type TrainingHeading = {
  id: string
  title: string
  level: 2 | 3
}

const CONTENT_DIR = path.join(process.cwd(), 'content', 'trainings')

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripInlineMarkdown(value: string) {
  return value
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .trim()
}

function extractHeadings(content: string): TrainingHeading[] {
  const seen = new Map<string, number>()

  return content
    .split('\n')
    .map((line) => line.match(/^(##|###)\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => {
      const level = match[1] === '##' ? 2 : 3
      const title = stripInlineMarkdown(match[2])
      const baseId = slugify(title) || 'secao'
      const count = seen.get(baseId) ?? 0
      seen.set(baseId, count + 1)

      return {
        level,
        title,
        id: count === 0 ? baseId : `${baseId}-${count + 1}`,
      }
    })
}

function injectHeadingIds(htmlContent: string, headings: TrainingHeading[]) {
  let output = htmlContent

  for (const heading of headings) {
    const pattern = new RegExp(`<h${heading.level}>\\s*${escapeRegExp(heading.title)}\\s*<\\/h${heading.level}>`)
    output = output.replace(pattern, `<h${heading.level} id="${heading.id}">${heading.title}</h${heading.level}>`)
  }

  return output
}

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
      category: String(data.category || 'Treinamento'),
      level: (data.level as TrainingMeta['level']) || 'Iniciante',
      duration: String(data.duration || '—'),
      updatedAt: String(data.updatedAt || ''),
      order: data.hidden ? -1 : Number(data.order || 999),
    }
  })

  return items
    .filter((item) => item.order !== -1)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.title.localeCompare(b.title, 'pt-BR')
    })
}

export async function getTrainingBySlug(slug: string): Promise<{ meta: TrainingMeta; contentHtml: string; headings: TrainingHeading[] } | null> {
  const file = path.join(CONTENT_DIR, `${slug}.md`)
  if (!fs.existsSync(file)) return null

  const raw = fs.readFileSync(file, 'utf8')
  const { data, content } = matter(raw)
  const headings = extractHeadings(content)
  const processed = await remark().use(html).process(content)
  const contentHtml = injectHeadingIds(processed.toString(), headings)

  const meta: TrainingMeta = {
    slug,
    title: String(data.title || slug),
    description: String(data.description || ''),
    category: String(data.category || 'Treinamento'),
    level: (data.level as TrainingMeta['level']) || 'Iniciante',
    duration: String(data.duration || '—'),
    updatedAt: String(data.updatedAt || ''),
    order: Number(data.order || 999),
  }

  return { meta, contentHtml, headings }
}
