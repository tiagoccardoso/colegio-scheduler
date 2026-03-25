"use client";

import { useEffect, useState } from "react";

type SchoolAddressValues = {
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

export function SchoolAddressFields({ defaultValues }: { defaultValues?: SchoolAddressValues | null }) {
  const initialStateCode = normalizeStateCode(defaultValues?.stateCode);
  const initialCity = normalizeText(defaultValues?.city);

  const [stateCode, setStateCode] = useState(initialStateCode);
  const [city, setCity] = useState(initialCity);
  const [cities, setCities] = useState<string[]>(initialCity ? [initialCity] : []);
  const [loadingCities, setLoadingCities] = useState(false);
  const [cityLoadError, setCityLoadError] = useState<string | null>(null);

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

        setCities(options);
        setCity((currentCity) => {
          if (currentCity && options.includes(currentCity)) return currentCity;
          if (stateCode === initialStateCode && initialCity && options.includes(initialCity)) return initialCity;
          return "";
        });
      } catch {
        if (controller.signal.aborted || cancelled) return;
        setCities(initialCity && stateCode === initialStateCode ? [initialCity] : []);
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

  return (
    <div className="mt-4 grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">CEP</span>
          <input
            name="zip_code"
            defaultValue={defaultValues?.zipCode ?? ""}
            className="input"
            placeholder="00000-000"
          />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Logradouro</span>
          <input
            name="address_street"
            defaultValue={defaultValues?.street ?? ""}
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
            defaultValue={defaultValues?.number ?? ""}
            className="input"
            placeholder="123"
          />
        </label>

        <label className="grid gap-2 md:col-span-2">
          <span className="text-sm font-semibold">Complemento</span>
          <input
            name="address_complement"
            defaultValue={defaultValues?.complement ?? ""}
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
            defaultValue={defaultValues?.neighborhood ?? ""}
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
