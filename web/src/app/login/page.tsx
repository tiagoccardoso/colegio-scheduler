"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
          data: { full_name: fullName.trim(), school_name: schoolName.trim(), term_label: termLabel.trim() || null },
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
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto flex max-w-md flex-col px-4 py-20">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">{mode === "login" ? "Entrar" : "Criar conta"}</h1>
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-sm font-semibold text-zinc-700 hover:text-black dark:text-zinc-300 dark:hover:text-white"
            >
              {mode === "login" ? "Criar conta" : "Já tenho conta"}
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-4 grid gap-3">
            {mode === "signup" ? (
              <>
                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Seu nome</span>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Nome do colégio</span>
                  <input
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="font-semibold">Período (opcional)</span>
                  <input
                    value={termLabel}
                    onChange={(e) => setTermLabel(e.target.value)}
                    placeholder="Ex: 2º SEMESTRE 2025-2"
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
                  />
                </label>
              </>
            ) : null}

            <label className="grid gap-1 text-sm">
              <span className="font-semibold">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="font-semibold">Senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
              />
            </label>

            {mode === "signup" ? (
              <label className="grid gap-1 text-sm">
                <span className="font-semibold">Confirmar senha</span>
                <input
                  type="password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-900 dark:bg-zinc-950"
                />
              </label>
            ) : null}

            {errorMsg ? <p className="text-sm text-red-600">{errorMsg}</p> : null}
            {infoMsg ? <p className="text-sm text-emerald-700">{infoMsg}</p> : null}

            <button
              disabled={loading}
              className="mt-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <p className="mt-4 text-xs text-zinc-600 dark:text-zinc-400">
            Após criar a conta, finalize o cadastro (colégio/período) e então o sistema habilita as grades do seu colégio.
          </p>
        </div>
      </div>
    </div>
  );
}
