/**
 * Contatos de suporte.
 *
 * Melhor prática: valores configuráveis via variáveis de ambiente públicas (NEXT_PUBLIC_*),
 * com fallback seguro para não quebrar a UI.
 */

export const SUPPORT_EMAIL = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "").trim() || "jessica@classflow.ia.br";

export const SUPPORT_PHONE_DISPLAY =
  (process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "").trim() || "46 9 9102 5340";

/**
 * Formato para usar em link `tel:` (remove espaços, hífens, parênteses etc.).
 */
export const SUPPORT_PHONE_TEL = SUPPORT_PHONE_DISPLAY.replace(/[^\d+]/g, "");
