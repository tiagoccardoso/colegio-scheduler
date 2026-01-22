"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Qual é o fluxo recomendado para começar?",
  "Como cadastrar professores e definir disponibilidade?",
  "Como montar a grade e revisar conflitos?",
  "Como imprimir/baixar a grade por turma?",
  "O que é Hora Atividade (HA) e como funciona?",
];

export function HelpChat(props: { enabled?: boolean } = {}) {
  const enabled = props.enabled !== false;
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Sou o assistente de ajuda do Colégio Scheduler. Pergunte qualquer coisa sobre o uso do sistema (cadastros, montagem de grade, relatórios, assinatura).",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<Msg[]>(messages);

  const canSend = useMemo(() => !loading && input.trim().length > 0, [loading, input]);

  if (!enabled) {
    return (
      <div className="panel p-5">
        <h2 className="text-lg font-semibold">Chat de ajuda</h2>
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          O chat de ajuda está indisponível no momento.
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Você ainda pode usar os tutoriais desta tela para tirar dúvidas sobre o sistema.
        </p>
      </div>
    );
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, loading]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  async function send(text: string) {
    const question = String(text || "").trim();
    if (!question || loading) return;

    setError(null);
    setLoading(true);
    setInput("");

    const userMsg: Msg = { role: "user", content: question };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai/help", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [...messagesRef.current, userMsg].slice(-24) }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || "Não foi possível responder agora.");
        return;
      }

      const answer = typeof json?.message === "string" ? json.message : "(sem resposta)";
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
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
          <h2 className="text-lg font-semibold">Chat de ajuda</h2>
          <p className="mt-1 muted max-w-prose">
            Este chat responde apenas sobre o uso do sistema. Se a pergunta não tiver relação, ele vai te redirecionar.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setError(null);
            setLoading(false);
            setInput("");
            setMessages([
              {
                role: "assistant",
                content:
                  "Conversa limpa. Me diga o que você quer fazer no Colégio Scheduler (cadastros, grade, relatórios).",
              },
            ]);
          }}
        >
          Limpar
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              className="rounded-full border border-zinc-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-sm transition hover:bg-white dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-200 dark:hover:bg-zinc-950"
              onClick={() => send(s)}
              disabled={loading}
              title={s}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="panel-inner max-h-[420px] overflow-y-auto p-4">
          <div className="grid gap-3">
            {messages.map((m, idx) => (
              <div key={idx} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm shadow-sm " +
                    (m.role === "user"
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                      : "border border-zinc-200 bg-white/70 text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-100")
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-zinc-200 bg-white/70 px-4 py-3 text-sm text-zinc-700 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-200">
                  Digitando…
                </div>
              </div>
            ) : null}

            <div ref={bottomRef} />
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        ) : null}

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSend) send(input);
          }}
        >
          <label className="grid flex-1 gap-2">
            <span className="text-sm font-semibold">Sua dúvida</span>
            <textarea
              className="textarea min-h-[44px]"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ex.: Como cadastrar horários e vincular turno?"
            />
          </label>

          <button type="submit" className="btn btn-primary h-11" disabled={!canSend}>
            Enviar
          </button>
        </form>

        <p className="text-xs text-zinc-500">
          Dica: descreva o objetivo e onde você está no sistema (ex.: “Estou em Montar grade, turno Manhã…”).
        </p>
      </div>
    </div>
  );
}
