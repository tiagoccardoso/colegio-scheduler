"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };

// Tipo client-side (leve) para o plano retornado pelo endpoint.
// A validação forte acontece no backend (/api/ai/setup).
type SetupPlan = {
  action: "apply";
  [k: string]: any;
};

const SUGGESTIONS = [
  "Quero parametrizar do zero: disciplinas, salas, turmas, horários, professores e montar a grade da manhã.",
  "Cadastre as disciplinas Matemática e Português; salas 1 e 2; turmas A e B (manhã); crie 5 períodos de 50min; e proponha os professores e regras.",
  "Analise o que já existe e me diga o que falta para montar a grade do turno MANHÃ.",
];

function isSupported() {
  return typeof window !== "undefined" && typeof (window as any).MediaRecorder !== "undefined";
}

export function DashboardSetupChat() {
  const router = useRouter();

  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Sou o assistente de parametrização. Me diga o que você quer configurar (disciplinas, salas, turmas, horários, professores) e se quer montar a grade. Vou pedir as informações que faltarem e, quando estiver tudo claro, aplico no sistema.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pendingPlan, setPendingPlan] = useState<SetupPlan | null>(null);
  const [pendingPlanText, setPendingPlanText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [audioSupported] = useState(isSupported());

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Msg[]>(messages);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading, recording]);

  const canSend = useMemo(() => !loading && input.trim().length > 0, [loading, input]);

  async function getAuthHeader(): Promise<Record<string, string>> {
    try {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }

  async function sendText(text: string) {
    const question = String(text || "").trim();
    if (!question || loading) return;

    setError(null);
    setLoading(true);
    setInput("");

    const userMsg: Msg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch("/api/ai/setup", {
        method: "POST",
        // Garante envio dos cookies de sessão do Supabase (alguns ambientes/proxies
        // acabam não enviando com o default do fetch do browser).
        credentials: "include",
        headers: { "content-type": "application/json", ...authHeader },
        body: JSON.stringify({ message: question, chatLog: [...messagesRef.current, userMsg].slice(-24) }),
    });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Não foi possível responder agora.");
        return;
      }

      const answer = typeof json?.message === "string" ? json.message : "(sem resposta)";
      const extra = [
        Array.isArray(json?.questions) && json.questions.length ? "Perguntas:\n- " + json.questions.join("\n- ") : "",
        Array.isArray(json?.execLog) && json.execLog.length ? "Execução:\n- " + json.execLog.join("\n- ") : "",
        Array.isArray(json?.warnings) && json.warnings.length ? "Avisos:\n- " + json.warnings.join("\n- ") : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const combined = extra ? `${answer}\n\n${extra}` : answer;

      // Preferimos o plano já estruturado vindo do backend.
      // Se a IA devolver apenas o JSON "cru" (sem action/apply), tentamos normalizar.
      const fromApi = json?.plan && typeof json.plan === "object" ? normalizePlan(json.plan) : { plan: null, raw: null };
      const fromText = extractPlan(answer);
      const chosen = fromApi.plan ? fromApi : fromText;

      if (chosen.plan) {
        setPendingPlan(chosen.plan);
        setPendingPlanText(chosen.raw);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: combined }]);
    } catch (e: any) {
      setError(e?.message || "Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function sendAudio(blob: Blob) {
    if (loading) return;
    setError(null);
    setLoading(true);

    const placeholder: Msg = { role: "user", content: "🎙️ (áudio enviado)" };
    setMessages((prev) => [...prev, placeholder]);

    try {
      const authHeader = await getAuthHeader();
      const fd = new FormData();
      fd.append("audio", blob, "audio.webm");
      fd.append("message", "");
      fd.append("chatLog", JSON.stringify([...messagesRef.current, placeholder].slice(-24)));

      const res = await fetch("/api/ai/setup", {
        method: "POST",
        credentials: "include",
        headers: authHeader,
        body: fd,
    });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Não foi possível processar o áudio.");
        return;
      }

      const transcript = typeof json?.transcript === "string" && json.transcript.trim() ? json.transcript.trim() : null;
      if (transcript) {
        // substitui placeholder por texto transcrito
        setMessages((prev) => {
          const copy = [...prev];
          let idx = -1;
          for (let i = copy.length - 1; i >= 0; i--) {
            const m = copy[i];
            if (m.role === "user" && m.content.includes("(áudio enviado)")) { idx = i; break; }
          }
          if (idx >= 0) copy[idx] = { role: "user", content: transcript };
          return copy;
        });
      }

      const answer = typeof json?.message === "string" ? json.message : "(sem resposta)";
      const extra = [
        Array.isArray(json?.questions) && json.questions.length ? "Perguntas:\n- " + json.questions.join("\n- ") : "",
        Array.isArray(json?.execLog) && json.execLog.length ? "Execução:\n- " + json.execLog.join("\n- ") : "",
        Array.isArray(json?.warnings) && json.warnings.length ? "Avisos:\n- " + json.warnings.join("\n- ") : "",
      ]
        .filter(Boolean)
        .join("\n\n");

      const combined = extra ? `${answer}\n\n${extra}` : answer;

      const fromApi = json?.plan && typeof json.plan === "object" ? normalizePlan(json.plan) : { plan: null, raw: null };
      const fromText = extractPlan(answer);
      const chosen = fromApi.plan ? fromApi : fromText;
      if (chosen.plan) {
        setPendingPlan(chosen.plan);
        setPendingPlanText(chosen.raw);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: combined }]);
    } catch (e: any) {
      setError(e?.message || "Erro de rede.");
    } finally {
      setLoading(false);
    }
  }

  async function startRecording() {
    if (!audioSupported || recording || loading) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onstop = () => {
        // encerra tracks
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (blob.size > 0) sendAudio(blob);
      };

      rec.start();
      setRecording(true);
    } catch (e: any) {
      setError("Não foi possível acessar o microfone.");
    }
  }

  function stopRecording() {
    if (!recording) return;
    setRecording(false);
    try {
      recorderRef.current?.stop();
    } catch {
      // ignore
    }
  }

  
function isPlanLike(obj: any) {
  if (!obj || typeof obj !== "object") return false;
  const o = obj?.payload && typeof obj.payload === "object" ? obj.payload : obj;
  return Boolean(
    o?.subjects ||
      o?.rooms ||
      o?.classes ||
      o?.timeSlots ||
      o?.teachers ||
      o?.buildSchedule ||
      o?.schedule // alguns prompts antigos usavam schedule
  );
}

function normalizePlan(obj: any): { plan: SetupPlan | null; raw: string | null } {
  if (!obj || typeof obj !== "object") return { plan: null, raw: null };
  const base = obj?.payload && typeof obj.payload === "object" ? obj.payload : obj;
  const plan: any = { ...base };
  if (!plan.action) plan.action = "apply";
  if (plan.action !== "apply") return { plan: null, raw: null };
  return { plan: plan as SetupPlan, raw: JSON.stringify(plan, null, 2) };
}

function extractPlan(text: string): { plan: SetupPlan | null; raw: string | null } {
  const src = String(text || "");

  // 1) tenta bloco ```json```
  const m = src.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (m?.[1]) {
    try {
      const obj = JSON.parse(String(m[1]).trim());
      const norm = normalizePlan(obj);
      if (norm.plan) return norm;
    } catch {
      // ignore
    }
  }

  // 2) tenta o texto inteiro (caso a IA tenha devolvido só JSON)
  const whole = src.trim();
  if ((whole.startsWith("{") && whole.endsWith("}")) || (whole.startsWith("[") && whole.endsWith("]"))) {
    try {
      const obj = JSON.parse(whole);
      const norm = normalizePlan(obj);
      if (norm.plan) return norm;
    } catch {
      // ignore
    }
  }

  // 3) tenta pegar substring do primeiro { ao último }
  const a = src.indexOf("{");
  const b = src.lastIndexOf("}");
  if (a >= 0 && b > a) {
    const candidate = src.slice(a, b + 1);
    try {
      const obj = JSON.parse(candidate);
      const norm = normalizePlan(obj);
      if (norm.plan) return norm;
    } catch {
      // ignore
    }
  }

  // 4) último recurso: se já é objeto no formato esperado
  return { plan: null, raw: null };
}

async function applyPlan(plan: SetupPlan) {
  if (loading) return;
  setError(null);
  setLoading(true);
  try {
    const authHeader = await getAuthHeader();
    const res = await fetch("/api/ai/setup", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", ...authHeader },
      body: JSON.stringify({ action: "apply", payload: plan }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json?.error || "Não foi possível aplicar o plano.");
      return;
    }
    const msg = typeof json?.message === "string" ? json.message : "Plano aplicado.";
    const extra = [
      Array.isArray(json?.execLog) && json.execLog.length ? "Execução:\n- " + json.execLog.join("\n- ") : "",
      Array.isArray(json?.warnings) && json.warnings.length ? "Avisos:\n- " + json.warnings.join("\n- ") : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    setMessages((prev) => [...prev, { role: "assistant", content: extra ? `${msg}\n\n${extra}` : msg }]);
    setPendingPlan(null);
    setPendingPlanText(null);

    // Atualiza as telas afetadas.
    // - O backend já chama revalidatePath(...) para subjects/rooms/classes/teachers/time-slots/schedule/weekly-grade.
    // - Aqui, forçamos refresh do App Router para garantir que a próxima navegação/tela já venha atualizada.
    try {
      router.refresh();
    } catch {
      // ignore
    }

    // (Opcional) sinaliza outras abas/componentes para refrescar, caso existam.
    try {
      const key = "scheduler:invalidate";
      localStorage.setItem(key, String(Date.now()));
      window.dispatchEvent(new Event(key));
    } catch {
      // ignore
    }
  } catch (e: any) {
    setError(e?.message || "Erro de rede.");
  } finally {
    setLoading(false);
  }
}

return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">IA para parametrização do sistema</h2>
          <p className="mt-1 muted max-w-prose">
            Peça para cadastrar disciplinas, salas, turmas, horários, professores e montar a grade. O assistente vai
            coletar os dados que faltarem e aplicar no sistema.
          </p>

{pendingPlan ? (
  <div className="mt-3 w-full rounded-xl border border-dashed p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="text-sm font-semibold">Plano pronto para aplicar</div>
        <div className="muted text-sm">
          A IA gerou um plano estruturado. Você pode aplicar os cadastros no banco e, se solicitado, montar a grade.
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {pendingPlanText ? (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              navigator.clipboard?.writeText(pendingPlanText).catch(() => {});
            }}
          >
            Copiar JSON
          </button>
        ) : null}
        <button type="button" className="btn btn-primary" onClick={() => applyPlan(pendingPlan!)}>
          Aplicar no sistema
        </button>
      </div>
    </div>
  </div>
) : null}
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setError(null);
            setLoading(false);
            setRecording(false);
            setInput("");
            setPendingPlan(null);
            setPendingPlanText(null);
            setMessages([
              {
                role: "assistant",
                content:
                  "Conversa limpa. Me diga o que você quer parametrizar (e para qual turno) e eu vou guiar o fluxo completo.",
              },
            ]);
          }}
        >
          Limpar
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-sm hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200"
            onClick={() => sendText(s)}
            disabled={loading || recording}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/30">
        <div className="max-h-[380px] overflow-auto pr-2">
          <div className="grid gap-2">
            {messages.map((m, idx) => (
              <div key={idx} className={m.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={
                    "inline-block max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                    (m.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100")
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <textarea
            className="min-h-[44px] flex-1 resize-y rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
            placeholder="Descreva o que você quer configurar…"
            value={input}
            disabled={loading || recording}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) sendText(input);
              }
            }}
          />

          <button type="button" className="btn btn-primary" disabled={!canSend} onClick={() => sendText(input)}>
            {loading ? "Enviando…" : "Enviar"}
          </button>

          {audioSupported ? (
            recording ? (
              <button type="button" className="btn btn-secondary" onClick={stopRecording} disabled={loading}>
                Parar áudio
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={startRecording} disabled={loading}>
                Enviar áudio
              </button>
            )
          ) : (
            <span className="text-xs text-zinc-500">Áudio não suportado neste navegador.</span>
          )}
        </div>

        <div className="mt-2 text-xs text-zinc-500">
          Dica: descreva turno, quantidade de períodos, duração, dias da semana, e a carga/Distribuição por professor.
        </div>
      </div>
    </div>
  );
}
