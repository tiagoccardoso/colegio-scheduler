import "server-only";
import Stripe from "stripe";

// Stripe Node SDK (precisa de runtime Node.js; não roda em Edge).
// A apiVersion abaixo é opcional. Se você não quiser fixar, remova a opção
// ou defina STRIPE_API_VERSION no .env.
const apiVersion = (process.env.STRIPE_API_VERSION as any) || undefined;

let _stripe: Stripe | null = null;

/**
 * Retorna um cliente Stripe inicializado sob demanda.
 *
 * Por que isso existe?
 * - O Next/Vercel pode importar módulos durante o build para “coletar configuração” das rotas.
 * - Se o STRIPE_SECRET_KEY não estiver disponível no ambiente de build, instanciar o Stripe no topo do módulo
 *   derruba o build com: “Neither apiKey nor config.authenticator provided”.
 *
 * Com essa abordagem, o erro só aparece quando realmente tentarem usar Stripe em runtime.
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error(
      "Stripe não configurado: defina STRIPE_SECRET_KEY (e opcionalmente STRIPE_API_VERSION) nas variáveis de ambiente.",
    );
  }

  _stripe = new Stripe(apiKey, apiVersion ? { apiVersion } : {});
  return _stripe;
}

// Mantém compatibilidade com os imports existentes (import { stripe } ...)
// sem instanciar Stripe no topo do módulo.
export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const s = getStripe();
    const v = (s as any)[prop];
    return typeof v === "function" ? v.bind(s) : v;
  },
  ownKeys() {
    return Reflect.ownKeys(getStripe() as any);
  },
  getOwnPropertyDescriptor(_target, prop) {
    return Object.getOwnPropertyDescriptor(getStripe() as any, prop);
  },
}) as Stripe;
