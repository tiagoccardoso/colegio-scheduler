"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SchoolAddressValues = {
  cnpj?: string | null;
  schoolName?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  stateCode?: string | null;
};

type StateOption = {
  code: string;
  name: string;
};

type CnpjLookupResponse = {
  cnpj?: string | null;
  officialName?: string | null;
  tradeName?: string | null;
  schoolName?: string | null;
  zipCode?: string | null;
  street?: string | null;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  stateCode?: string | null;
  source?: string | null;
  error?: string | null;
};

const BRAZIL_STATES: StateOption[] = [
  { code: "AC", name: "Acre" },
  { code: "AL", name: "Alagoas" },
  { code: "AP", name: "Amapá" },
  { code: "AM", name: "Amazonas" },
  { code: "BA", name: "Bahia" },
  { code: "CE", name: "Ceará" },
  { code: "DF", name: "Distrito Federal" },
  { code: "ES", name: "Espírito Santo" },
  { code: "GO", name: "Goiás" },
  { code: "MA", name: "Maranhão" },
  { code: "MT", name: "Mato Grosso" },
  { code: "MS", name: "Mato Grosso do Sul" },
  { code: "MG", name: "Minas Gerais" },
  { code: "PA", name: "Pará" },
  { code: "PB", name: "Paraíba" },
  { code: "PR", name: "Paraná" },
  { code: "PE", name: "Pernambuco" },
  { code: "PI", name: "Piauí" },
  { code: "RJ", name: "Rio de Janeiro" },
  { code: "RN", name: "Rio Grande do Norte" },
  { code: "RS", name: "Rio Grande do Sul" },
  { code: "RO", name: "Rondônia" },
  { code: "RR", name: "Roraima" },
  { code: "SC", name: "Santa Catarina" },
  { code: "SP", name: "São Paulo" },
  { code: "SE", name: "Sergipe" },
  { code: "TO", name: "Tocantins" },
];

function normalizeStateCode(value: string | null | undefined) {
  const stateCode = String(value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(stateCode) ? stateCode : "";
}

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

function normalizeCnpj(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 14);
}

function formatCnpj(value: string | null | undefined) {
  const raw = normalizeCnpj(value);
  if (!raw) return "";

  const p1 = raw.slice(0, 2);
  const p2 = raw.slice(2, 5);
  const p3 = raw.slice(5, 8);
  const p4 = raw.slice(8, 12);
  const p5 = raw.slice(12, 14);

  let formatted = p1;
  if (p2) formatted += `.${p2}`;
  if (p3) formatted += `.${p3}`;
  if (p4) formatted += `/${p4}`;
  if (p5) formatted += `-${p5}`;
  return formatted;
}

function normalizeZipCode(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 8);
}

function formatZipCode(value: string | null | undefined) {
  const digits = normalizeZipCode(value);
  if (!digits) return "";
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function mergeCityOption(options: string[], cityName: string) {
  const normalized = normalizeText(cityName);
  if (!normalized) return options;
  if (options.includes(normalized)) return options;
  return [normalized, ...options].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function SchoolAddressFields({ defaultValues }: { defaultValues?: SchoolAddressValues | null }) {
  const initialStateCode = useMemo(() => normalizeStateCode(defaultValues?.stateCode), [defaultValues?.stateCode]);
  const initialCity = useMemo(() => normalizeText(defaultValues?.city), [defaultValues?.city]);

  const [cnpj, setCnpj] = useState(formatCnpj(defaultValues?.cnpj));
  const [schoolName, setSchoolName] = useState(normalizeText(defaultValues?.schoolName));
  const [zipCode, setZipCode] = useState(formatZipCode(defaultValues?.zipCode));
  const [street, setStreet] = useState(normalizeText(defaultValues?.street));
  const [number, setNumber] = useState(normalizeText(defaultValues?.number));
  const [complement, setComplement] = useState(normalizeText(defaultValues?.complement));
  const [neighborhood, setNeighborhood] = useState(normalizeText(defaultValues?.neighborhood));
  const [stateCode, setStateCode] = useState(initialStateCode);
  const [city, setCity] = useState(initialCity);
  const [cities, setCities] = useState<string[]>(initialCity ? [initialCity] : []);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cityLoadError, setCityLoadError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const lastLookupRef = useRef<string>(normalizeCnpj(defaultValues?.cnpj));

  const applyLookup = useCallback((payload: CnpjLookupResponse) => {
    const nextStateCode = normalizeStateCode(payload.stateCode);
    const nextCity = normalizeText(payload.city);

    setSchoolName((current) => normalizeText(payload.schoolName) || current);
    setZipCode((current) => formatZipCode(payload.zipCode) || current);
    setStreet((current) => normalizeText(payload.street) || current);
    setNumber((current) => normalizeText(payload.number) || current);
    setComplement((current) => normalizeText(payload.complement) || current);
    setNeighborhood((current) => normalizeText(payload.neighborhood) || current);

    if (nextStateCode) {
      setStateCode(nextStateCode);
    }

    if (nextCity) {
      setCity(nextCity);
      setCities((current) => mergeCityOption(current, nextCity));
    }
  }, []);

  const triggerLookup = useCallback(
    async (cnpjToLookup: string, force = false) => {
      const raw = normalizeCnpj(cnpjToLookup);

      if (!/^\d{14}$/.test(raw)) {
        setLookupError("Informe um CNPJ com 14 dígitos para buscar os dados automaticamente.");
        setLookupMessage(null);
        return;
      }

      if (!force && raw === lastLookupRef.current) return;

      setLookupLoading(true);
      setLookupError(null);
      setLookupMessage(null);
      lastLookupRef.current = raw;

      try {
        const response = await fetch(`/api/receita/cnpj?cnpj=${encodeURIComponent(raw)}`, {
          method: "GET",
          cache: "no-store",
        });

        const payload = (await response.json()) as CnpjLookupResponse;

        if (!response.ok) {
          throw new Error(payload?.error || "Não foi possível buscar os dados do CNPJ.");
        }

        applyLookup(payload);
        setLookupMessage("Dados do CNPJ carregados. Confira e ajuste os campos se precisar.");
      } catch (error) {
        const message = error instanceof Error ? error.message : "Não foi possível buscar os dados do CNPJ.";
        setLookupError(message);
      } finally {
        setLookupLoading(false);
      }
    },
    [applyLookup],
  );

  useEffect(() => {
    if (!stateCode) {
      setCities([]);
      setCity("");
      setCityLoadError(null);
      setLoadingCities(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function loadCities() {
      setLoadingCities(true);
      setCityLoadError(null);

      try {
        const response = await fetch(`/api/locations/cities?state=${encodeURIComponent(stateCode)}`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Falha ao carregar cidades para ${stateCode}.`);
        }

        const payload = await response.json();
        const options = Array.isArray(payload?.cities)
          ? payload.cities
              .map((entry: unknown) => String(entry ?? "").trim())
              .filter(Boolean)
          : [];

        if (cancelled) return;

        setCities((current) => {
          const merged = new Set<string>([
            ...options,
            ...(initialCity && stateCode === initialStateCode ? [initialCity] : []),
            ...current,
          ]);
          return Array.from(merged).sort((a, b) => a.localeCompare(b, "pt-BR"));
        });

        setCity((currentCity) => {
          if (currentCity && options.includes(currentCity)) return currentCity;
          if (stateCode === initialStateCode && initialCity && options.includes(initialCity)) return initialCity;
          if (currentCity && currentCity.trim()) return currentCity;
          return "";
        });
      } catch {
        if (controller.signal.aborted || cancelled) return;
        setCities((current) => (current.length ? current : initialCity && stateCode === initialStateCode ? [initialCity] : []));
        setCityLoadError("Não foi possível carregar as cidades automaticamente. Você pode digitar a cidade manualmente.");
      } finally {
        if (!cancelled) setLoadingCities(false);
      }
    }

    void loadCities();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [initialCity, initialStateCode, stateCode]);

  useEffect(() => {
    const raw = normalizeCnpj(cnpj);

    if (!raw) {
      setLookupError(null);
      setLookupMessage(null);
      lastLookupRef.current = "";
      return;
    }

    if (!/^\d{14}$/.test(raw) || raw === lastLookupRef.current) return;

    const timer = window.setTimeout(() => {
      void triggerLookup(raw);
    }, 700);

    return () => window.clearTimeout(timer);
  }, [cnpj, triggerLookup]);

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/70 p-4 dark:border-zinc-900/70 dark:bg-zinc-950/30">
        <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.38fr)_minmax(0,0.62fr)_auto] lg:items-end">
          <label className="grid gap-2 min-w-0">
            <span className="text-sm font-semibold">CNPJ</span>
            <input
              name="cnpj"
              value={cnpj}
              onChange={(event) => {
                setCnpj(formatCnpj(event.target.value));
                setLookupError(null);
                setLookupMessage(null);
              }}
              onBlur={() => {
                const raw = normalizeCnpj(cnpj);
                if (/^\d{14}$/.test(raw)) {
                  void triggerLookup(raw);
                }
              }}
              className="input"
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
              maxLength={18}
              autoComplete="off"
            />
          </label>

          <label className="grid gap-2 min-w-0">
            <span className="text-sm font-semibold">Nome da escola</span>
            <input
              name="school_name"
              value={schoolName}
              onChange={(event) => setSchoolName(event.target.value)}
              className="input"
              placeholder="Nome oficial ou fantasia da escola"
              autoComplete="organization"
            />
          </label>

          <button
            type="button"
            className="btn btn-secondary lg:mb-[1px]"
            onClick={() => {
              void triggerLookup(cnpj, true);
            }}
            disabled={lookupLoading}
          >
            {lookupLoading ? "Buscando..." : "Buscar CNPJ"}
          </button>
        </div>

        <p className="mt-3 text-xs text-zinc-500">
          Ao completar o CNPJ, o sistema tenta buscar automaticamente o nome e o endereço da escola.
        </p>
        {lookupMessage ? <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">{lookupMessage}</p> : null}
        {lookupError ? <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{lookupError}</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">CEP</span>
          <input
            name="zip_code"
            value={zipCode}
            onChange={(event) => setZipCode(formatZipCode(event.target.value))}
            className="input"
            placeholder="00000-000"
            inputMode="numeric"
          />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Logradouro</span>
          <input
            name="address_street"
            value={street}
            onChange={(event) => setStreet(event.target.value)}
            className="input"
            placeholder="Rua, avenida, travessa..."
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Número</span>
          <input
            name="address_number"
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            className="input"
            placeholder="123"
          />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Complemento</span>
          <input
            name="address_complement"
            value={complement}
            onChange={(event) => setComplement(event.target.value)}
            className="input"
            placeholder="Bloco, sala, referência..."
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">Bairro</span>
          <input
            name="address_neighborhood"
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            className="input"
            placeholder="Centro"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Estado</span>
          <select
            name="state_code"
            value={stateCode}
            onChange={(event) => {
              setStateCode(normalizeStateCode(event.target.value));
              setCity("");
              setCities([]);
            }}
            className="input h-10"
          >
            <option value="">Selecione o estado</option>
            {BRAZIL_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name} ({state.code})
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-sm font-semibold">Cidade</span>
          {cityLoadError ? (
            <input
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="input"
              placeholder="Digite a cidade"
            />
          ) : (
            <select
              name="city"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              className="input h-10"
              disabled={!stateCode || loadingCities}
            >
              <option value="">
                {!stateCode
                  ? "Selecione o estado primeiro"
                  : loadingCities
                    ? "Carregando cidades..."
                    : "Selecione a cidade"}
              </option>
              {cities.map((cityName) => (
                <option key={cityName} value={cityName}>
                  {cityName}
                </option>
              ))}
            </select>
          )}
        </label>
      </div>

      <p className="text-xs text-zinc-500">
        Ao escolher o estado, a lista de cidades é carregada automaticamente.
      </p>
      {cityLoadError ? <p className="text-xs text-amber-600 dark:text-amber-400">{cityLoadError}</p> : null}
    </div>
  );
}
