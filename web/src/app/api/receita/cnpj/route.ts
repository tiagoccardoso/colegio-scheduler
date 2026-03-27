import { NextRequest } from "next/server";

type BrasilApiResponse = {
  cnpj?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
  message?: string | null;
};

function normalizeCnpj(value: string | null) {
  return String(value ?? "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 14);
}

function normalizeText(value: string | null | undefined) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeStateCode(value: string | null | undefined) {
  const stateCode = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : null;
}

function normalizeZipCode(value: string | null | undefined) {
  const zip = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return zip || null;
}

export async function GET(request: NextRequest) {
  const cnpj = normalizeCnpj(request.nextUrl.searchParams.get("cnpj"));

  if (!/^\d{14}$/.test(cnpj)) {
    return Response.json({ error: "Informe um CNPJ válido com 14 dígitos." }, { status: 400 });
  }

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (response.status === 404) {
      return Response.json({ error: "CNPJ não encontrado na base consultada." }, { status: 404 });
    }

    const payload = (await response.json()) as BrasilApiResponse;

    if (!response.ok) {
      return Response.json(
        { error: normalizeText(payload?.message) || "Não foi possível consultar o CNPJ no momento." },
        { status: 502 },
      );
    }

    const officialName = normalizeText(payload.razao_social);
    const tradeName = normalizeText(payload.nome_fantasia);

    return Response.json({
      cnpj,
      officialName,
      tradeName,
      schoolName: tradeName || officialName,
      zipCode: normalizeZipCode(payload.cep),
      street: normalizeText(payload.logradouro),
      number: normalizeText(payload.numero),
      complement: normalizeText(payload.complemento),
      neighborhood: normalizeText(payload.bairro),
      city: normalizeText(payload.municipio),
      stateCode: normalizeStateCode(payload.uf),
      source: "brasilapi-cnpj",
    });
  } catch {
    return Response.json({ error: "Não foi possível consultar o CNPJ no momento." }, { status: 502 });
  }
}
