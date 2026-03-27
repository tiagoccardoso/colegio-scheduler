'use client'

import Link from 'next/link'
import type { BrevoEventProperties } from '@/lib/brevo'
import { trackBrevoEvent } from '@/lib/brevo'

type TrackedLinkProps = {
  href: string
  children: React.ReactNode
  className?: string
  eventName: string
  eventProperties?: BrevoEventProperties
  target?: string
  rel?: string
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:')
}

export function TrackedLink({
  href,
  children,
  className,
  eventName,
  eventProperties,
  target,
  rel,
}: TrackedLinkProps) {
  const handleClick = () => {
    trackBrevoEvent(eventName, {
      href,
      ...eventProperties,
    })
  }

  if (isExternalHref(href)) {
    return (
      <a href={href} className={className} onClick={handleClick} target={target} rel={rel}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  )
}
