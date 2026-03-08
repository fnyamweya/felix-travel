import { createFelixClient } from '@felix-travel/sdk-internal';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

let _accessToken: string | null = localStorage.getItem('felix_dash_access_token');

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  localStorage.setItem('felix_dash_access_token', access);
  localStorage.setItem('felix_dash_refresh_token', refresh);
}

export function clearTokens() {
  _accessToken = null;
  localStorage.removeItem('felix_dash_access_token');
  localStorage.removeItem('felix_dash_refresh_token');
}

export function isAuthenticated() { return !!_accessToken; }

export const apiClient = createFelixClient({ baseUrl: BASE_URL, onAuthFailure: () => { clearTokens(); window.location.href = '/login'; } });
