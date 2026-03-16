import Link from "next/link";

import { Shell } from "@/components/Shell";
import { PrintButton } from "@/components/PrintButton";
import { StudentDocumentPreview } from "@/components/StudentDocumentPreview";
import { requireStaff } from "@/lib/require-staff";
import { type DocumentSettingsRow } from "@/lib/novo-ensino-medio-documents";

export default async function StudentDocumentIssuePage({
  params,
}: {
  params: Promise<{ issueId: string }>;
}) {
  const { supabase, profile } = await requireStaff();
  const { issueId } = await params;

  const [schoolRes, settingsRes, issueRes] = await Promise.all([
    supabase.from("schools").select("id, name").eq("id", profile.school_id).maybeSingle(),
    supabase.from("school_document_settings").select("*").eq("school_id", profile.school_id).maybeSingle(),
    supabase.from("student_document_issues").select("*").eq("school_id", profile.school_id).eq("id", issueId).maybeSingle(),
  ]);

  const schoolName = String((schoolRes.data as any)?.name ?? "Minha escola").trim() || "Minha escola";
  const settings = (settingsRes.data as DocumentSettingsRow | null) ?? null;
  const issue = issueRes.data as any;

  return (
    <Shell
      title="Visualização do documento"
      subtitle="Revise, imprima e use esta página como segunda via interna dos documentos emitidos."
    >
      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex gap-2">
            <Link href="/students/documentos" className="btn btn-secondary">
              Voltar
            </Link>
          </div>
          <PrintButton />
        </div>

        {issue ? (
          <StudentDocumentPreview schoolName={schoolName} settings={settings} issue={issue} />
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
            Documento não encontrado para esta escola.
          </div>
        )}
      </div>
    </Shell>
  );
}
