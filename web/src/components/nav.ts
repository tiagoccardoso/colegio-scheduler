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
      { href: "/grades/ha", label: "Hora Atividade" },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
