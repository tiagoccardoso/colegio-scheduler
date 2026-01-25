import crypto from "crypto";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

function tryParseJsonLoose<T>(raw: string): T {
  // 1) Tentativa direta
  const s0 = String(raw ?? "").trim();
  try {
    return JSON.parse(s0) as T;
  } catch {
    // continua
  }

  // 2) Remove cercas de código comuns
  let s = s0
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 3) Extrai do primeiro '{' até o último '}'
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) s = s.slice(a, b + 1);

  // 4) Remove vírgulas finais (muito comum em "quase JSON")
  s = s.replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(s) as T;
}

function hashSafetyIdentifier(userId: string) {
  const id = String(userId || "").trim();
  if (!id) return undefined;
  return crypto.createHash("sha256").update(id).digest("hex").slice(0, 48);
}

export class OpenAIError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "OpenAIError";
    this.status = status;
  }
}

/**
 * Chat Completions + Structured Outputs (json_schema).
 * Returns a parsed JSON object that matches the supplied schema.
 */
export async function openaiChatJsonSchema<T>(args: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  schemaName: string;
  schema: any;
  temperature?: number;
  userIdForSafetyIdentifier?: string;
  maxCompletionTokens?: number;
}) {
  const {
    apiKey,
    model,
    messages,
    schemaName,
    schema,
    temperature = 0.2,
    userIdForSafetyIdentifier,
    maxCompletionTokens,
  } = args;

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
  const safety_identifier = userIdForSafetyIdentifier ? hashSafetyIdentifier(userIdForSafetyIdentifier) : undefined;

  // IMPORTANTE:
  // - Mesmo com Structured Outputs, respostas podem vir truncadas por limite de tokens.
  // - Quando truncadas, o JSON costuma ficar inválido e o parse falha.
  // Estratégia:
  // 1) Tenta parse normal.
  // 2) Se finish_reason == "length" e o parse falhar, tenta 1 retry com mais tokens.

  const initialMax = typeof maxCompletionTokens === "number" ? maxCompletionTokens : undefined;
  const fallbackMax = Math.min(4000, (initialMax ?? 1600) * 2);

  for (let attempt = 0; attempt < 2; attempt++) {
    const maxTok = attempt === 0 ? initialMax : fallbackMax;

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
        store: false,
        ...(typeof maxTok === "number" ? { max_completion_tokens: maxTok } : {}),
        response_format: {
          type: "json_schema",
          json_schema: {
            name: schemaName,
            schema,
            strict: true,
          },
        },
        ...(safety_identifier ? { safety_identifier } : {}),
        messages,
      }),
    });

    const json = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      const msg = json?.error?.message || `Falha ao chamar OpenAI (HTTP ${res.status}).`;
      throw new OpenAIError(msg, res.status);
    }

    const choice = json?.choices?.[0];
    const msg = choice?.message;
    const finishReason = String(choice?.finish_reason ?? "").trim().toLowerCase();
    if (!msg) throw new OpenAIError("Resposta da OpenAI inválida (sem message).", 500);

    if (typeof msg?.refusal === "string" && msg.refusal.trim()) {
      throw new OpenAIError(msg.refusal.trim(), 400);
    }

    // Alguns SDKs/versões retornam content como array de partes.
    const contentAny: any = msg?.content;
    const content =
      typeof contentAny === "string"
        ? contentAny
        : Array.isArray(contentAny)
          ? contentAny
              .map((p) => (typeof p?.text === "string" ? p.text : typeof p === "string" ? p : ""))
              .join("")
          : "";

    if (typeof content !== "string" || !content.trim()) {
      throw new OpenAIError("Resposta da OpenAI inválida (sem content).", 500);
    }

    try {
      return tryParseJsonLoose<T>(content);
    } catch {
      // Se a resposta foi cortada por limite de tokens, tenta 1 retry com mais tokens.
      if (finishReason === "length" && attempt === 0) continue;
      throw new OpenAIError("Resposta da OpenAI não era JSON válido.", 500);
    }
  }

  // Em teoria não chega aqui.
  throw new OpenAIError("Resposta da OpenAI não era JSON válido.", 500);
}
