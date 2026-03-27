export type BrevoEventProperties = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    Brevo?: Array<unknown> & {
      push: (item: unknown) => number
    }
  }
}

function sanitizeProperties(properties?: BrevoEventProperties) {
  if (!properties) return undefined

  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined))
}

export function trackBrevoEvent(eventName: string, properties?: BrevoEventProperties) {
  if (typeof window === 'undefined' || !window.Brevo?.push) return

  const sanitizedProperties = sanitizeProperties(properties)
  window.Brevo.push(['track', eventName, sanitizedProperties ?? {}])
}
