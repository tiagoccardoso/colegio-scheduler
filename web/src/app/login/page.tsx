"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Flash } from "@/components/Flash";

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <span aria-hidden="true" className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("login");

  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [termLabel, setTermLabel] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      // signup
      if (!fullName.trim()) throw new Error("Informe seu nome.");
      if (!schoolName.trim()) throw new Error("Informe o nome do colégio.");
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (password !== password2) throw new Error("As senhas não conferem.");

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            school_name: schoolName.trim(),
            term_label: termLabel.trim() || null,
          },
        },
      });
      if (error) throw error;

      // If session exists, redirect to onboarding to finalize DB rows
      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }

      setInfoMsg("Conta criada. Verifique seu e-mail (confirmação) e depois faça login para finalizar o cadastro.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container py-12">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
        <section className="hidden lg:block">
          <div className="badge w-fit">Organização sem drama</div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Colégio
          </h1>
          <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
            Um painel leve para cadastrar base (turmas, horários, salas, professores) e montar a grade com mais clareza.
          </p>

          <ul className="mt-6 grid gap-3">
            <Feature>Cadastre o essencial em poucos passos</Feature>
            <Feature>Monte a grade geral do turno e revise conflitos</Feature>
            <Feature>Imprima e compartilhe com a equipe</Feature>
          </ul>

          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
            Dica nerd: mantenha o cadastro de horários consistente (início/fim) para deixar o motor de grade bem feliz.
          </p>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Painel do diretor</div>
              <h2 className="text-xl font-semibold tracking-tight">
                {mode === "login" ? "Entrar" : "Criar conta"}
              </h2>
            </div>

            <div className="panel-inner flex items-center gap-1 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={
                  "rounded-xl px-3 py-2 text-sm font-semibold transition " +
                  (mode === "login"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-700 hover:bg-white/60 dark:text-zinc-200 dark:hover:bg-zinc-900")
                }
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={
                  "rounded-xl px-3 py-2 text-sm font-semibold transition " +
                  (mode === "signup"
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-950"
                    : "text-zinc-700 hover:bg-white/60 dark:text-zinc-200 dark:hover:bg-zinc-900")
                }
              >
                Criar
              </button>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5 grid gap-4">
            {errorMsg ? <Flash message={errorMsg} variant="error" /> : null}
            {infoMsg ? <Flash message={infoMsg} variant="success" /> : null}

            {mode === "signup" ? (
              <div className="grid gap-3">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Seu nome</span>
                  <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Nome do colégio</span>
                  <input value={schoolName} onChange={(e) => setSchoolName(e.target.value)} className="input" />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Período (opcional)</span>
                  <input
                    value={termLabel}
                    onChange={(e) => setTermLabel(e.target.value)}
                    placeholder="Ex: 2º SEMESTRE 2025-2"
                    className="input"
                  />
                </label>
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-semibold">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Senha</span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
            </label>

            {mode === "signup" ? (
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Confirmar senha</span>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="input"
                />
              </label>
            ) : null}

            <button disabled={loading} className="btn btn-primary mt-1 w-full">
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Após criar a conta, finalize o cadastro (colégio/período) e então o sistema habilita as grades do seu colégio.
            </p>
          </form>
        </section>
      </div>
    </div>
  );
}
