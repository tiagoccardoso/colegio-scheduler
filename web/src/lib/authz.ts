export type StaffRole = "director" | "pedagogical";

/** Roles que podem acessar Cadastros, Grade e Relatórios. */
export function isStaffRole(role: unknown): role is StaffRole {
  return role === "director" || role === "pedagogical";
}

/** Apenas o diretor pode acessar Painel do diretor e Assinaturas. */
export function isDirectorRole(role: unknown): role is "director" {
  return role === "director";
}
