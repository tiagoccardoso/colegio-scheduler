export type NavItem = {
  href: string;
  label: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

// Ordem do menu:
// 1) Dashboard
// 2) Demais recursos
//
// Observação: "Assinaturas" não aparece no menu para evitar duplicidade.
// O acesso fica no botão abaixo de "Painel do diretor".
export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Início",
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    title: "Cadastros",
    items: [
      { href: "/subjects", label: "Disciplinas" },
      { href: "/rooms", label: "Salas" },
      { href: "/classes", label: "Turmas" },
      { href: "/time-slots", label: "Horários" },
      { href: "/teachers", label: "Professores" },
    ],
  },
  {
    title: "Grade",
    items: [{ href: "/schedule", label: "Montar grade" }],
  },
  {
    title: "Relatórios",
    items: [
      { href: "/weekly-grade", label: "Grade semanal" },
      { href: "/grades", label: "Grade por turma" },
      { href: "/grades/rooms", label: "Grade por sala" },
      { href: "/grades/teachers", label: "Grade por professor" },
      { href: "/grades/absences", label: "Faltas" },
      { href: "/grades/ha", label: "Hora Atividade" },
    ],
  },
];

/**
 * Retorna as seções do menu.
 *
 * Observação: o bloqueio/desbloqueio (visual e de navegação) é tratado na
 * UI (NavLinks) para que o usuário veja todas as opções, porém com
 * indicação clara do que fica indisponível até concluir a assinatura.
 */
export function getNavSections(_params?: { subscribed?: boolean }): NavSection[] {
  return NAV_SECTIONS;
}

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
