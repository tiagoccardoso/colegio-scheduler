export function encodeMsg(value: string) {
  return encodeURIComponent(value);
}

export function decodeMsg(value?: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
