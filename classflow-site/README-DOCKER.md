# Rodar o ClassFlow (site institucional) via Docker

## Requisitos
- Docker + Docker Compose

## 1) Criar arquivo de ambiente
Copie o exemplo e ajuste os links:

```bash
cp .env.example .env.local
```

Edite `.env.local` e configure:
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STRIPE_MONTHLY_URL`
- `NEXT_PUBLIC_STRIPE_YEARLY_URL`

## 2) Subir com Docker Compose
Na raiz do projeto do site (onde está o `package.json`):

```bash
docker compose up --build
```

Acesse:
- http://localhost:3000

## 3) Alternativa: build e run sem compose
```bash
docker build -t classflow-site .
docker run --rm -p 3000:3000 --env-file .env.local classflow-site
```
