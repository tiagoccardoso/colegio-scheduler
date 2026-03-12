import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type InMsg = { role: "user" | "assistant"; content: string };

const MAX_MESSAGES = 24;
const MAX_CHARS = 2400;

const GUIDE = `
Você está ajudando usuários do sistema "Colégio Scheduler".

O produto (resumo do que existe no app):
- Menu "Cadastros": Disciplinas, Salas, Turmas, Horários, Matriz curricular, Professores.
- Menu "Grade": "Montar grade" cria/ajusta a grade do turno.
- Menu "Relatórios": Grade semanal, Matriz curricular, Grade por turma, Grade por sala, Grade por professor, Hora Atividade (HA).
- Botão "Assinaturas": gerencia plano (Stripe). Sem assinatura ativa, algumas áreas podem ficar bloqueadas.

Observações de uso:
- Fluxo recomendado: Disciplinas → Salas → Turmas → Horários → Matriz Curricular → Professores → Montar grade → Relatórios.
- "Matriz Curricular": permite montar automaticamente a distribuição das disciplinas por turma, editar as células manualmente e zerar a matriz para refazer do zero, mesmo antes de cadastrar professores.
- "Montar grade": ao entrar, o sistema pode montar automaticamente a grade geral do turno com base no cadastro de professores, na matriz curricular e nos bloqueios de HA.
- "HA": horários de Hora Atividade bloqueiam o professor naquele dia/período para alocação de aula.

Limites:
- Responda APENAS sobre o uso do Colégio Scheduler.
- Se a pergunta for fora de escopo (ex.: dúvidas gerais, assuntos pessoais), recuse gentilmente e peça para a pessoa reformular em termos do sistema.
- Não invente telas ou botões que não estejam no resumo acima.
`;

function normalizeMessages(input: any): InMsg[] {
  const arr = Array.isArray(input) ? input : [];
  const out: InMsg[] = [];
  for (const raw of arr) {
    const role = raw?.role === "assistant" ? "assistant" : "user";
    const content = String(raw?.content ?? "").trim();
    if (!content) continue;
    out.push({ role, content: content.slice(0, MAX_CHARS) });
  }
  return out.slice(-MAX_MESSAGES);
}

export async function POST(req: Request) {
  try {
    // Mantemos o mesmo "feature flag" das rotas de IA do projeto.
    if (process.env.AI_SCHEDULER_ENABLED !== "true") {
      return NextResponse.json({ error: "Chat de ajuda indisponível no momento." }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return NextResponse.json({ error: "Chat de ajuda indisponível no momento." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const msgs = normalizeMessages(body?.messages);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    // Carrega perfil só para garantir que é um usuário do sistema.
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, school_id, role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

    const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    const sys =
      "Você é um atendente de suporte do Colégio Scheduler. " +
      "Responda em português (Brasil), com passos curtos e ações claras. " +
      "Não responda assuntos fora do uso do sistema.";

    const aiRes = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        store: false,
        max_completion_tokens: 650,
        messages: [
          { role: "system", content: sys },
          { role: "system", content: GUIDE },
          ...msgs.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    const aiJson = await aiRes.json().catch(() => ({} as any));
    if (!aiRes.ok) {
      return NextResponse.json(
        { error: aiJson?.error?.message ?? "Falha ao chamar o chat de ajuda." },
        { status: 500 },
      );
    }

    const content = String(aiJson?.choices?.[0]?.message?.content ?? "").trim();
    if (!content) return NextResponse.json({ error: "Resposta vazia." }, { status: 500 });

    return NextResponse.json({ ok: true, message: content });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Erro inesperado." }, { status: 500 });
  }
}
