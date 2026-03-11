export type NavItem = {
  href: string;
  label: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Direção",
    items: [
      { href: "/director", label: "Painel do Diretor" },
      { href: "/director/calendario", label: "Calendário" },
      { href: "/director/equipe-pedagogica", label: "Equipe Pedagógica" },
      { href: "/director/parametros-grade", label: "Parâmetros da grade" },
      { href: "/billing", label: "Assinaturas" },
    ],
  },
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

export function getNavSections(_params?: { subscribed?: boolean }): NavSection[] {
  return NAV_SECTIONS;
}

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
