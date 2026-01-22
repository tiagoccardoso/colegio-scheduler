"use client";

import Link from "next/link";

function HelpIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="h-5 w-5">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-1.5a6.5 6.5 0 1 1 0-13 6.5 6.5 0 0 1 0 13Zm0-10.2c-1.2 0-2.17.78-2.17 1.95a.75.75 0 0 0 1.5 0c0-.32.25-.45.67-.45.4 0 .67.15.67.47 0 .32-.14.46-.6.82-.78.6-1.2 1.25-1.2 2.16v.18a.75.75 0 0 0 1.5 0v-.18c0-.4.18-.72.62-1.05.75-.57 1.18-1.1 1.18-1.93 0-1.2-.97-1.97-2.17-1.97Zm.03 8.4a.9.9 0 1 0 0-1.8.9.9 0 0 0 0 1.8Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function HelpIconLink() {
  return (
    <Link
      href="/help"
      className="btn btn-ghost h-9 w-9 rounded-full px-0"
      aria-label="Ajuda"
      title="Ajuda"
    >
      <HelpIcon />
    </Link>
  );
}
