/**
 * URL do sistema (app) que o site institucional deve abrir ao clicar em "Acessar".
 *
 * Configure via variável de ambiente `NEXT_PUBLIC_APP_URL`.
 * Exemplo: NEXT_PUBLIC_APP_URL=https://seu-dominio.com/login
 *
 * Fallback (padrão): http://localhost:3001/login
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || 'http://localhost:3001/login'
