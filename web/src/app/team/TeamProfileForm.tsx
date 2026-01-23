"use client";

import { useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export function TeamProfileForm(props: {
  userId: string;
  initialName: string;
  initialEmail: string;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [fullName, setFullName] = useState(props.initialName);
  const [email, setEmail] = useState(props.initialEmail);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setError(null);

    const name = String(fullName || "").trim();
    const mail = String(email || "").trim();

    if (!name) {
      setError("Informe seu nome.");
      return;
    }

    if (!mail || !mail.includes("@")) {
      setError("Informe um e-mail válido.");
      return;
    }

    if (password) {
      if (password.length < 6) {
        setError("A senha deve ter pelo menos 6 caracteres.");
        return;
      }
      if (password !== password2) {
        setError("As senhas não conferem.");
        return;
      }
    }

    setLoading(true);
    try {
      // 1) Atualiza o perfil (nome)
      const { error: profErr } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("user_id", props.userId);

      if (profErr) throw new Error(profErr.message);

      // 2) Atualiza o e-mail no Auth (pode exigir confirmação no e-mail)
      const { data: auth } = await supabase.auth.getUser();
      const currentEmail = String(auth?.user?.email ?? "");
      const emailChanged = !!mail && mail !== currentEmail;

      if (emailChanged) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: mail });
        if (emailErr) throw new Error(emailErr.message);
      }

      // 3) Atualiza senha no Auth
      if (password) {
        const { error: passErr } = await supabase.auth.updateUser({ password });
        if (passErr) throw new Error(passErr.message);
      }

      setPassword("");
      setPassword2("");

      setMsg(
        emailChanged
          ? "Dados salvos. Verifique seu e-mail para confirmar a alteração de e-mail."
          : "Dados salvos com sucesso.",
      );
    } catch (e: any) {
      setError(String(e?.message ?? "Falha ao salvar."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-5">
      <h2 className="text-lg font-semibold">Meu cadastro</h2>
      <p className="muted mt-1 text-sm">
        Atualize seu nome, e-mail e senha. Se você trocar o e-mail, o Supabase pode pedir confirmação no e-mail novo.
      </p>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Nome</span>
          <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">E-mail</span>
          <input
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">Nova senha (opcional)</span>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-semibold">Confirmar senha</span>
            <input
              type="password"
              className="input"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="••••••"
            />
          </label>
        </div>

        {msg ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
            {msg}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-950 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <button type="submit" className="btn btn-primary w-fit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </form>
    </section>
  );
}
