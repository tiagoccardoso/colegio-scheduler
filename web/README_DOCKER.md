# Docker (arquivos adicionais)

## Pré-requisito
- Ter um arquivo `.env` na raiz do projeto (mesma pasta do `package.json`) com as variáveis do seu ambiente.

## Rodar em DEV (equivalente a `npm run dev`, com hot reload)
```bash
docker compose -f docker-compose.dev.yml up --build
```
Abra: http://localhost:3000

## Rodar em Produção (build + start)
```bash
docker compose up --build
```
Abra: http://localhost:3000

## Parar
```bash
docker compose down
```

### Nota sobre `NEXT_PUBLIC_*`
Variáveis `NEXT_PUBLIC_*` entram no bundle no **build**. Se mudar alguma delas, faça rebuild:
```bash
docker compose build --no-cache
docker compose up
```
