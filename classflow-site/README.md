# ClassFlow — Site institucional

Site institucional em Next.js + Tailwind, pronto para deploy na Vercel.

## Como rodar

```bash
npm i
npm run dev
```

## Variáveis de ambiente

Crie `.env.local`:

```bash
NEXT_PUBLIC_APP_URL="https://SEU-SISTEMA.vercel.app"
NEXT_PUBLIC_STRIPE_MONTHLY_URL="https://buy.stripe.com/..."
NEXT_PUBLIC_STRIPE_YEARLY_URL="https://buy.stripe.com/..."
```

## Treinamentos

Os treinamentos ficam em `content/trainings/*.md`.

- Adicione um novo arquivo `.md` com frontmatter.
- O site gera as páginas automaticamente.
