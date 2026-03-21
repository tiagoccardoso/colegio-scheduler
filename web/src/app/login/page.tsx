"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Flash } from "@/components/Flash";
import { PlansCatalog } from "@/components/PlansCatalog";

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm text-zinc-700 dark:text-zinc-300">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/80 text-xs font-bold text-zinc-900 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
      >
        ✓
      </span>
      <span>{children}</span>
    </li>
  );
}

function ValueCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="panel-inner p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
        {eyebrow}
      </div>
      <div className="mt-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function JourneyStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 text-sm font-semibold text-white shadow-sm dark:bg-white dark:text-zinc-950">
        {number}
      </div>
      <div>
        <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</div>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>
    </div>
  );
}

function PlanCards({ onPick }: { onPick: (plan: "trial" | "monthly" | "yearly") => void }) {
  return (
    <div className="panel-solid p-5 sm:p-6">
      <PlansCatalog
        checkoutNote="Checkout seguro via Stripe"
        topNote={
          <>
            Após a assinatura, sua escola libera acesso completo para direção, coordenação, secretaria,
            cadastros, grade, Novo Ensino Médio, documentos, relatórios e recursos com IA.
          </>
        }
        cards={[
          {
            title: "Teste grátis",
            price: `${process.env.NEXT_PUBLIC_TRIAL_DAYS ?? "7"} dias`,
            note:
              "Primeira assinatura com período de avaliação. Libera exatamente os mesmos recursos dos outros planos durante a vigência do teste.",
            badge: "Melhor para começar",
            action: (
              <button type="button" onClick={() => onPick("trial")} className="btn btn-primary w-full">
                Começar teste grátis
              </button>
            ),
            footer: "Cartão obrigatório no checkout.",
          },
          {
            title: "Mensal",
            price: process.env.NEXT_PUBLIC_PLAN_MONTHLY_PRICE ?? "Mensal",
            note:
              "Renovação automática. Cancele quando quiser. Libera exatamente os mesmos recursos dos outros planos.",
            action: (
              <button type="button" onClick={() => onPick("monthly")} className="btn btn-secondary w-full">
                Assinar plano mensal
              </button>
            ),
          },
          {
            title: "Anual",
            price: process.env.NEXT_PUBLIC_PLAN_YEARLY_PRICE ?? "Anual",
            note:
              "Economize e tenha previsibilidade no ano todo. Libera exatamente os mesmos recursos dos outros planos.",
            badge: "Melhor custo-benefício",
            highlight: true,
            action: (
              <button
                type="button"
                onClick={() => onPick("yearly")}
                className="btn w-full bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-100"
              >
                Assinar plano anual
              </button>
            ),
          },
        ]}
      />
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

      if (data.session) {
        router.replace("/onboarding");
        router.refresh();
        return;
      }

      setInfoMsg("Conta criada. Verifique seu e-mail de confirmação e depois entre para finalizar a implantação da escola.");
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "login"
      ? "Entrar na plataforma"
      : mode === "signup"
        ? "Criar conta da escola"
        : "Recuperar acesso";

  const subheading =
    mode === "login"
      ? "Acesse sua operação acadêmica, continue a implantação ou avance para a assinatura."
      : mode === "signup"
        ? "Crie o acesso inicial do diretor para configurar a escola, equipe, grade e documentos."
        : "Informe seu e-mail para receber o link de redefinição de senha.";

  return (
    <div className="page-container py-8 sm:py-10 lg:py-12">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <section className="panel relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="absolute right-0 top-10 h-48 w-48 rounded-full bg-emerald-500/10 blur-3xl" />
            <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-pink-500/10 blur-3xl" />
          </div>

          <div className="relative">
            <div className="flex flex-wrap items-center gap-3">
              <div className="badge">Plataforma de gestão acadêmica</div>
              <div className="badge">IA aplicada à rotina escolar</div>
            </div>

            <div className="mt-6 max-w-3xl">
              <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl lg:text-5xl dark:text-zinc-100">
                Entre para operar a escola inteira em um só sistema.
              </h1>
              <p className="mt-4 text-base leading-7 text-zinc-700 sm:text-lg dark:text-zinc-300">
                O ClassFlow conecta cadastro, matriz curricular, grade, Novo Ensino Médio, secretaria,
                documentos, calendário, relatórios e dashboards da direção em uma única plataforma.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <ValueCard
                eyebrow="Grade e horários"
                title="Montagem inteligente com IA"
                description="Organize a grade semanal, identifique conflitos, ajuste regras docentes e refine a distribuição com apoio da IA."
              />
              <ValueCard
                eyebrow="Conformidade"
                title="Novo Ensino Médio sob controle"
                description="Acompanhe FGB, itinerários, coortes, cargas horárias, componentes obrigatórios e alertas de conformidade."
              />
              <ValueCard
                eyebrow="Secretaria"
                title="Do ingresso à documentação"
                description="Cadastre estudantes, conduza pré-matrícula assistida, acompanhe históricos e emita documentos escolares."
              />
              <ValueCard
                eyebrow="Direção"
                title="Gestão com visão executiva"
                description="Centralize equipe, calendário, parâmetros da escola, relatórios acadêmicos e painéis para tomada de decisão."
              />
            </div>

            <div className="mt-8 grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
              <div className="panel-inner p-5 sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  O que você encontra ao entrar
                </div>
                <ul className="mt-4 space-y-3">
                  <Bullet>Assistente de implantação para configurar escola, diretor e parâmetros iniciais</Bullet>
                  <Bullet>Cadastros completos de turmas, salas, professores, disciplinas e estudantes</Bullet>
                  <Bullet>Matriz curricular, grade, calendário, relatórios e emissão de documentos</Bullet>
                  <Bullet>Fluxos específicos para direção, equipe pedagógica e secretaria</Bullet>
                </ul>
              </div>

              <div className="panel-inner p-5 sm:p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Como começa
                </div>
                <div className="mt-4 space-y-4">
                  <JourneyStep
                    number="1"
                    title="Crie ou acesse sua conta"
                    description="Use o login para continuar sua implantação ou crie o primeiro acesso do diretor da escola."
                  />
                  <JourneyStep
                    number="2"
                    title="Finalize a implantação"
                    description="Conclua o onboarding, cadastre a estrutura da escola e configure seus parâmetros acadêmicos."
                  />
                  <JourneyStep
                    number="3"
                    title="Ative o plano e libere a equipe"
                    description="Escolha teste grátis, plano mensal ou anual e libere os mesmos recursos da plataforma para a operação escolar."
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-5 sm:p-6 lg:p-7">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
                  Acesso da escola
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {heading}
                </h2>
                <p className="mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                  {subheading}
                </p>
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
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                      : "text-zinc-700 hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-zinc-900")
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
                      ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                      : "text-zinc-700 hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-zinc-900")
                  }
                >
                  Criar conta
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Fluxo real
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Onboarding + login + assinatura</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Público
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Direção, coordenação e secretaria</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-3 dark:border-zinc-800 dark:bg-zinc-900/70">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                  Entrega
                </div>
                <div className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Gestão acadêmica completa com IA</div>
              </div>
            </div>

            <form id="auth-form" onSubmit={onSubmit} className="mt-6 grid gap-4">
              {errorMsg ? <Flash message={errorMsg} variant="error" /> : null}
              {infoMsg ? <Flash message={infoMsg} variant="success" /> : null}

              {mode === "signup" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 sm:col-span-1">
                    <span className="text-sm font-semibold">Seu nome</span>
                    <input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="input"
                      placeholder="Nome do diretor responsável"
                    />
                  </label>

                  <label className="grid gap-2 sm:col-span-1">
                    <span className="text-sm font-semibold">Nome do colégio</span>
                    <input
                      value={schoolName}
                      onChange={(e) => setSchoolName(e.target.value)}
                      className="input"
                      placeholder="Nome da instituição"
                    />
                  </label>
                </div>
              ) : null}

              <label className="grid gap-2">
                <span className="text-sm font-semibold">E-mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="seuemail@escola.com.br"
                />
              </label>

              {mode !== "forgot" ? (
                <label className="grid gap-2">
                  <span className="text-sm font-semibold">Senha</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input"
                    placeholder="Digite sua senha"
                  />
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
                    placeholder="Repita a senha criada"
                  />
                </label>
              ) : null}

              <button disabled={loading} className="btn btn-primary mt-1 h-11 w-full text-sm sm:text-base">
                {loading
                  ? "Aguarde..."
                  : mode === "login"
                    ? "Entrar na plataforma"
                    : mode === "signup"
                      ? "Criar conta e iniciar implantação"
                      : "Enviar link de recuperação"}
              </button>

              {mode === "login" ? (
                <button type="button" onClick={() => setMode("forgot")} className="btn btn-ghost w-full">
                  Esqueci minha senha
                </button>
              ) : null}

              {mode === "forgot" ? (
                <button type="button" onClick={() => setMode("login")} className="btn btn-ghost w-full">
                  Voltar para login
                </button>
              ) : null}

              <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-400">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Importante:</span> após criar a conta,
                finalize o cadastro da escola. O sistema usa esse passo para habilitar grade, fluxos acadêmicos,
                equipe e assinatura do seu ambiente.
              </div>
            </form>
          </div>
        </section>
      </div>

      <section className="panel mt-6 p-5 sm:p-6 lg:p-8">
        <div className="max-w-5xl">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
            Planos e assinatura
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-100">
            Escolha a vigência e veja tudo o que a escola libera ao assinar.
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-400">
            Reorganizamos esta área para dar mais espaço às informações dos planos. Assim os conteúdos ficam mais legíveis, sem cortes e com os botões de assinatura alinhados no mesmo padrão das outras telas.
          </p>
        </div>

        <div className="mt-6">
          <PlanCards onPick={pickPlan} />
        </div>
      </section>
    </div>
  );
}
