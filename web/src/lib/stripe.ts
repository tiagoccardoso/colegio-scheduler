import "server-only";
import Stripe from "stripe";

// Stripe Node SDK (precisa de runtime Node.js; não roda em Edge).
// A apiVersion abaixo é opcional. Se você não quiser fixar, remova a opção
// ou defina STRIPE_API_VERSION no .env.
const apiVersion = (process.env.STRIPE_API_VERSION as any) || undefined;

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, apiVersion ? { apiVersion } : {});
