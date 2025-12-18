export type ClassValue = string | number | null | undefined | false;

// Minimal className joiner. (Keeps the project dependency-free.)
export function cn(...values: ClassValue[]) {
  return values.filter(Boolean).join(" ");
}
