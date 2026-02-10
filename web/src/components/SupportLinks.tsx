import Link from "next/link";

import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from "@/lib/support";

export function SupportLinks({
  className = "",
  showContatoLink = true,
  align = "center",
}: {
  className?: string;
  showContatoLink?: boolean;
  align?: "start" | "center" | "end";
}) {
  const justify = align === "start" ? "justify-start" : align === "end" ? "justify-end" : "justify-center";

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${justify} ${className}`.trim()}>
      <a className="underline underline-offset-2 hover:opacity-90" href={`mailto:${SUPPORT_EMAIL}`}>
        {SUPPORT_EMAIL}
      </a>
      <span aria-hidden="true">•</span>
      <a className="underline underline-offset-2 hover:opacity-90" href={`tel:${SUPPORT_PHONE_TEL}`}>
        {SUPPORT_PHONE_DISPLAY}
      </a>
      {showContatoLink ? (
        <>
          <span aria-hidden="true">•</span>
          <Link className="underline underline-offset-2 hover:opacity-90" href="/contato">
            Contato
          </Link>
        </>
      ) : null}
    </div>
  );
}
