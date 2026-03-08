import { createFelixClient } from '@felix-travel/sdk-internal';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const apiClient = createFelixClient({
  baseUrl: BASE_URL,
  onAuthFailure: () => { clearTokens(); window.location.href = '/login'; },
});

// Hydrate SDK client from persisted token on load
const savedToken = localStorage.getItem('felix_access_token');
if (savedToken) apiClient.http.setAccessToken(savedToken);

export function setTokens(access: string, refresh: string) {
  apiClient.http.setAccessToken(access);
  localStorage.setItem('felix_access_token', access);
  localStorage.setItem('felix_refresh_token', refresh);
}

export function clearTokens() {
  apiClient.http.clearTokens();
  localStorage.removeItem('felix_access_token');
  localStorage.removeItem('felix_refresh_token');
}

export function isAuthenticated() {
  return !!localStorage.getItem('felix_access_token');
}
