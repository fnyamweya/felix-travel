import type { FelixApiClient } from '../client.js';

export interface Country {
  id: string;
  code: string;
  code3?: string | null;
  numericCode?: string | null;
  name: string;
  officialName?: string | null;
  continent?: string | null;
  capitalCity?: string | null;
  phoneCode?: string | null;
  defaultCurrencyCode?: string | null;
  flagEmoji?: string | null;
  isActive: boolean;
  sortOrder: number;
}

export interface Currency {
  id: string;
  code: string;
  numericCode?: string | null;
  name: string;
  symbol: string;
  symbolNative?: string | null;
  decimalDigits: number;
  rounding: number;
  isActive: boolean;
  sortOrder: number;
}

export interface Region {
  id: string;
  countryCode: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  level: number;
  isActive: boolean;
  sortOrder: number;
}

export function geographyEndpoints(client: FelixApiClient) {
  return {
    listCountries: (params?: { continent?: string; activeOnly?: boolean }) =>
      client.get<{ data: Country[] }>('/v1/geography/countries', params),

    getCountry: (code: string) =>
      client.get<{ data: Country & { currencies: Array<{ currencyCode: string; isPrimary: boolean }> } }>(
        `/v1/geography/countries/${encodeURIComponent(code)}`
      ),

    listCurrencies: () =>
      client.get<{ data: Currency[] }>('/v1/geography/currencies'),

    getCurrency: (code: string) =>
      client.get<{ data: Currency }>(`/v1/geography/currencies/${encodeURIComponent(code)}`),

    listRegions: (countryCode: string, parentId?: string) =>
      client.get<{ data: Region[] }>(
        `/v1/geography/countries/${encodeURIComponent(countryCode)}/regions`,
        parentId ? { parentId } : undefined
      ),

    getRegionDescendants: (regionId: string) =>
      client.get<{ data: Region[] }>(`/v1/geography/regions/${encodeURIComponent(regionId)}/descendants`),

    getRegionAncestors: (regionId: string) =>
      client.get<{ data: Region[] }>(`/v1/geography/regions/${encodeURIComponent(regionId)}/ancestors`),

    createCountry: (body: Record<string, unknown>) =>
      client.post<{ data: Country }>('/v1/geography/countries', body),

    createCurrency: (body: Record<string, unknown>) =>
      client.post<{ data: Currency }>('/v1/geography/currencies', body),

    createRegion: (body: Record<string, unknown>) =>
      client.post<{ data: Region }>('/v1/geography/regions', body),

    linkCountryCurrency: (body: { countryCode: string; currencyCode: string; isPrimary?: boolean }) =>
      client.post<{ data: unknown }>('/v1/geography/country-currencies', body),
  };
}
