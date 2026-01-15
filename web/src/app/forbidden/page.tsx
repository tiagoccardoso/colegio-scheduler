import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <div className="page-container py-14">
      <div className="mx-auto max-w-lg">
        <div className="panel p-6">
          <h1 className="text-xl font-semibold tracking-tight">Acesso negado</h1>
          <p className="mt-2 muted">
            Sua conta não tem permissão para acessar o painel do diretor.
          </p>

          <Link href="/login" className="btn btn-primary mt-5 inline-flex">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
