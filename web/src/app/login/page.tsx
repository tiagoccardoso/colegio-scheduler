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

function PlanCards({ onPick }: { onPick: (plan: "trial" | "monthly" | "yearly") => void }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
      <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
        Plano de assinatura
      </div>

      <div className="mt-3">
        <div className="text-base font-semibold">Planos</div>
        <div className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          Acesso completo ao gerador de grade, cadastros e relatórios.
        </div>

        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-zinc-700 dark:text-zinc-300">
          <li>Cadastros ilimitados</li>
          <li>Montagem de grade com revisão de conflitos</li>
          <li>Relatórios</li>
        </ul>

        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          A liberação do sistema acontece após a confirmação da assinatura (checkout Stripe).
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Teste grátis</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {process.env.NEXT_PUBLIC_TRIAL_DAYS ?? "7"} dias
            </div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
              R$ 0 no período de teste. Cartão obrigatório. Cobrança após o trial no plano mensal.
            </div>
            <button type="button" onClick={() => onPick("trial")} className="btn btn-primary mt-4 w-full">
              Começar teste grátis
            </button>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Mensal</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {process.env.NEXT_PUBLIC_PLAN_MONTHLY_PRICE ?? "Mensal"}
            </div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Pagamento recorrente mensal.</div>
            <button
              type="button"
              onClick={() => onPick("monthly")}
              className="btn btn-primary mt-4 w-full"
            >
              Assinar mensal
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-900 dark:bg-zinc-950">
            <div className="text-sm font-semibold">Anual</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">
              {process.env.NEXT_PUBLIC_PLAN_YEARLY_PRICE ?? "Anual"}
            </div>
            <div className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">Pagamento recorrente anual.</div>
            <button
              type="button"
              onClick={() => onPick("yearly")}
              className="btn btn-primary mt-4 w-full"
            >
              Assinar anual
            </button>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500">Você será direcionado para o checkout seguro do Stripe após entrar.</div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");

  const [fullName, setFullName] = useState("");
  const [schoolName, setSchoolName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [redirectAfterLogin, setRedirectAfterLogin] = useState("/dashboard");

  function pickPlan(plan: "trial" | "monthly" | "yearly") {
    // Após entrar, o usuário cai no dashboard com o menu travado e os planos visíveis.
    // A contratação em si acontece em /billing.
    setRedirectAfterLogin(`/dashboard?plan=${plan}`);
    setMode("login");
    const label = plan === "trial" ? "com teste grátis" : plan === "yearly" ? "anual" : "mensal";
    setInfoMsg(`Faça login para escolher e concluir a assinatura ${label}.`);
    setErrorMsg(null);
    try {
      document.getElementById("auth-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {}
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (mode === "forgot") {
        if (!email.trim()) throw new Error("Informe seu e-mail.");
        const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (error) throw error;
        setInfoMsg("Se existir uma conta com este e-mail, enviamos um link para redefinir a senha.");
        return;
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(redirectAfterLogin);
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
            ClassFlow
          </h1>
          <p className="mt-4 text-base text-zinc-700 dark:text-zinc-300">
            Um painel leve para cadastrar (Disciplinas, Salas, Turmas, Horários, Professores) e montar a grade com mais clareza.
          </p>

          <ul className="mt-6 grid gap-3">
            <Feature>Cadastre o essencial em poucos passos</Feature>
            <Feature>Monte a grade geral do turno e revise conflitos</Feature>
            <Feature>Imprima e compartilhe com a equipe</Feature>
          </ul>

          <p className="mt-8 text-sm text-zinc-600 dark:text-zinc-400">
            Dica nerd: mantenha o cadastro de horários consistente (início/fim) para deixar o motor de grade bem feliz.
          </p>

          {/* Planos de assinatura — alinhados à esquerda (desktop) */}
          <div className="mt-6">
            <PlanCards onPick={pickPlan} />
          </div>
        </section>

        <section className="panel p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Painel do diretor</div>
              <h2 className="text-xl font-semibold tracking-tight">
                {mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Recuperar senha"}
              </h2>
            </div>

            <div className="panel-inner flex items-center gap-1 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setRedirectAfterLogin("/dashboard");
                  setInfoMsg(null);
                  setErrorMsg(null);
                }}
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
                onClick={() => {
                  setMode("signup");
                  setRedirectAfterLogin("/dashboard");
                  setInfoMsg(null);
                  setErrorMsg(null);
                }}
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

          <form id="auth-form" onSubmit={onSubmit} className="mt-5 grid gap-4">
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
              </div>
            ) : null}

            <label className="grid gap-2">
              <span className="text-sm font-semibold">E-mail</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
            </label>

            {mode !== "forgot" ? (
              <label className="grid gap-2">
                <span className="text-sm font-semibold">Senha</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
              </label>
            ) : null}

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
              {loading
                ? "Aguarde..."
                : mode === "login"
                  ? "Entrar"
                  : mode === "signup"
                    ? "Criar conta"
                    : "Enviar link"}
            </button>

            {mode === "login" ? (
              <button
                type="button"
                onClick={() => setMode("forgot")}
                className="btn btn-ghost w-full"
              >
                Esqueci minha senha
              </button>
            ) : null}

            {mode === "forgot" ? (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="btn btn-ghost w-full"
              >
                Voltar para login
              </button>
            ) : null}

            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Após criar a conta, finalize o cadastro (colégio) e então o sistema habilita as grades do seu colégio.
            </p>
          </form>

          {/* Planos — versão mobile/tablet (a coluna da esquerda não aparece) */}
          <div className="mt-6 lg:hidden">
            <PlanCards onPick={pickPlan} />
          </div>
        </section>
      </div>
    </div>
  );
}
