"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import { Flash } from "@/components/Flash";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [loading, setLoading] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;

      if (error || !data.user) {
        setErrorMsg("Link inválido ou expirado. Volte ao login e solicite uma nova recuperação.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setLoading(true);

    try {
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (password !== password2) throw new Error("As senhas não conferem.");

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setInfoMsg("Senha atualizada! Agora faça login novamente.");
      await supabase.auth.signOut();
      router.replace("/login");
      router.refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-container py-12">
      <section className="panel mx-auto max-w-lg p-6">
        <div className="text-xs font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">Segurança</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Definir nova senha</h1>
        <p className="muted mt-2">
          Escolha uma senha nova para sua conta. Mínimo de 6 caracteres.
        </p>

        <form onSubmit={onSubmit} className="mt-5 grid gap-4">
          {errorMsg ? <Flash message={errorMsg} variant="error" /> : null}
          {infoMsg ? <Flash message={infoMsg} variant="success" /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-semibold">Nova senha</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="••••••"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-semibold">Confirmar</span>
              <input
                type="password"
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="input"
                placeholder="••••••"
              />
            </label>
          </div>

          <button disabled={loading} className="btn btn-primary w-full">
            {loading ? "Aguarde..." : "Salvar nova senha"}
          </button>

          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Dica: use uma senha única (um gerenciador de senhas deixa isso muito menos doloroso).
          </p>
        </form>
      </section>
    </div>
  );
}
