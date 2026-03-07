import { createFelixClient } from '@felix-travel/sdk-internal';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

let _accessToken: string | null = localStorage.getItem('felix_access_token');
let _refreshToken: string | null = localStorage.getItem('felix_refresh_token');

function getAccessToken() { return _accessToken ?? ''; }

async function refreshTokenFn() {
  if (!_refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: _refreshToken }),
  });
  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Refresh failed');
  }
  const data = await res.json() as { data: { accessToken: string; refreshToken: string } };
  setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.accessToken;
}

export function setTokens(access: string, refresh: string) {
  _accessToken = access;
  _refreshToken = refresh;
  localStorage.setItem('felix_access_token', access);
  localStorage.setItem('felix_refresh_token', refresh);
}

export function clearTokens() {
  _accessToken = null;
  _refreshToken = null;
  localStorage.removeItem('felix_access_token');
  localStorage.removeItem('felix_refresh_token');
}

export function isAuthenticated() {
  return !!_accessToken;
}

export const apiClient = createFelixClient({
  baseURL: BASE_URL,
  getAccessToken,
  refreshToken: refreshTokenFn,
});
