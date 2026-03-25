import { NextRequest } from "next/server";

function normalizeStateCode(value: string | null) {
  const stateCode = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : null;
}

export async function GET(request: NextRequest) {
  const stateCode = normalizeStateCode(request.nextUrl.searchParams.get("state"));

  if (!stateCode) {
    return Response.json({ error: "Informe uma UF válida." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios`, {
      next: { revalidate: 60 * 60 * 24 * 30 },
    });

    if (!response.ok) {
      return Response.json({ error: "Não foi possível carregar as cidades." }, { status: 502 });
    }

    const data: unknown = await response.json();
    const cities = Array.isArray(data)
      ? data
          .map((item) => String((item as { nome?: string } | null)?.nome ?? "").trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, "pt-BR"))
      : [];

    return Response.json({ state: stateCode, cities });
  } catch {
    return Response.json({ error: "Não foi possível consultar as cidades no momento." }, { status: 502 });
  }
}
