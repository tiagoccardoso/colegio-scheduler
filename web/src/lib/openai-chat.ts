import crypto from "crypto";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

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
      ...(typeof maxCompletionTokens === "number" ? { max_completion_tokens: maxCompletionTokens } : {}),
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
  if (!msg) throw new OpenAIError("Resposta da OpenAI inválida (sem message).", 500);

  if (typeof msg?.refusal === "string" && msg.refusal.trim()) {
    throw new OpenAIError(msg.refusal.trim(), 400);
  }

  const content = msg?.content;
  if (typeof content !== "string") throw new OpenAIError("Resposta da OpenAI inválida (sem content).", 500);

  try {
    return JSON.parse(content) as T;
  } catch {
    throw new OpenAIError("Resposta da OpenAI não era JSON válido.", 500);
  }
}
