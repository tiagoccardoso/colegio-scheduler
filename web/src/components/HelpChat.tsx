"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Qual é o fluxo recomendado para começar os cadastros do NEM?",
  "Como preencher disciplinas e turmas com os novos campos?",
  "Como cadastrar estudantes, responsáveis e documentos?",
  "Como usar Histórico e trilhas e Documentos do aluno?",
  "Como montar a grade e revisar conflitos depois da matriz curricular?",
];

export function HelpChat(props: { enabled?: boolean } = {}) {
  const enabled = props.enabled !== false;
  const supabase = useMemo(() => createClient(), []);
  const [schoolName, setSchoolName] = useState("Colégio Scheduler");
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Sou o assistente de ajuda do Colégio Scheduler. Você pode perguntar qualquer coisa sobre o uso do sistema, especialmente sobre o Novo Ensino Médio, as novas telas, o fluxo de cadastro, documentos, grade curricular e relatórios.",
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
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth.user;
        if (!user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("user_id", user.id)
          .maybeSingle();

        const schoolId = String((profile as any)?.school_id || "").trim();
        if (!schoolId) return;

        const { data: school } = await supabase
          .from("schools")
          .select("name")
          .eq("id", schoolId)
          .maybeSingle();

        const name = String((school as any)?.name || "").trim();
        if (!cancelled && name) {
          setSchoolName(name);
          setMessages((prev) => {
            if (!prev.length || prev[0]?.role !== "assistant") return prev;
            const first = {
              ...prev[0],
              content: `Sou o assistente de ajuda do ${name}. Você pode perguntar qualquer coisa sobre o uso do sistema, especialmente sobre o Novo Ensino Médio, as novas telas, o fluxo de cadastro, documentos, grade curricular e relatórios.`,
            };
            return [first, ...prev.slice(1)];
          });
        }
      } catch {
        // fallback segue
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

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
            Este chat responde sobre o uso do sistema, com foco nas novas telas, no fluxo de cadastro e no Novo Ensino Médio. Se a pergunta não tiver relação, ele vai te redirecionar.
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
                  `Conversa limpa. Me diga o que você quer fazer em ${schoolName} — por exemplo: cadastros, telas do Novo Ensino Médio, documentos, grade ou relatórios.`,
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
              placeholder="Ex.: Como cadastrar turmas com coorte, itinerário e capacidade?"
            />
          </label>

          <button type="submit" className="btn btn-primary h-11" disabled={!canSend}>
            Enviar
          </button>
        </form>

        <p className="text-xs text-zinc-500">
          Dica: descreva o objetivo, a tela e, se existir, a turma ou o cadastro envolvido (ex.: “Estou em Turmas e quero preencher coorte, oferta e itinerário do 1ºA”).
        </p>
      </div>
    </div>
  );
}
