import type { FelixApiClient } from '../client.js';
import type { TokenPair, AuthUser } from '@felix-travel/types';

export function authEndpoints(client: FelixApiClient) {
  return {
    register: (body: { email: string; password: string; firstName: string; lastName: string; phone?: string }) =>
      client.post<TokenPair>('/v1/auth/register', body),

    login: (body: { email: string; password: string }) =>
      client.post<TokenPair>('/v1/auth/login', body),

    logout: () => client.post<void>('/v1/auth/logout'),

    me: () => client.get<AuthUser>('/v1/auth/me'),

    refreshToken: () => client.post<TokenPair>('/v1/auth/refresh'),

    requestMagicLink: (body: { email: string }) =>
      client.post<void>('/v1/auth/magic-link/request', body),

    verifyMagicLink: (token: string) =>
      client.post<TokenPair>('/v1/auth/magic-link/verify', { token }),

    requestPasswordReset: (body: { email: string }) =>
      client.post<void>('/v1/auth/password-reset/request', body),

    confirmPasswordReset: (body: { token: string; password: string }) =>
      client.post<void>('/v1/auth/password-reset/confirm', body),

    acceptInvite: (body: { token: string; firstName: string; lastName: string; password: string }) =>
      client.post<TokenPair>('/v1/auth/invites/accept', body),
  };
}
