import type {
  TwoFactorSetupResponse,
  TwoFactorBackupCodesResponse,
  Verify2FaRequest,
} from './twoFactorTypes';
import {
  MOCK_QR_IMAGE,
  getDefaultMockBackupCodes,
  generateMockBackupCodes,
  MOCK_VALID_CODE,
  getMock2faEnabled,
} from './twoFactorMockData';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export async function api<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const authApi = {
  login: (email: string, password: string) =>
    api<{ access_token: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),
  register: (email: string, password: string, displayName?: string) =>
    api<{ access_token: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName }) }
    ),
};

export const usersApi = {
  me: () => api<{ id: string; email: string; displayName: string | null }>('/users/me'),
};

export const walletsApi = {
  list: () => api<Array<{ id: string; asset: string; balance: string }>>('/wallets'),
  deposit: (asset: string, amount: number) =>
    api('/wallets/deposit', { method: 'POST', body: JSON.stringify({ asset, amount }) }),
  withdraw: (asset: string, amount: number) =>
    api('/wallets/withdraw', { method: 'POST', body: JSON.stringify({ asset, amount }) }),
};

export interface CryptoItem {
  id: string;
  name: string;
  symbol: string;
  price: string;
  change24h: string;
  volume24h: string;
  popular: boolean;
}

export const cryptosApi = {
  list: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.offset != null) sp.set('offset', String(params.offset));
    if (params?.search) sp.set('search', params.search);
    if (params?.sortBy) sp.set('sortBy', params.sortBy);
    if (params?.sortOrder) sp.set('sortOrder', params.sortOrder);
    const q = sp.toString();
    return api<{ data: CryptoItem[]; total: number }>(`/cryptos${q ? `?${q}` : ''}`);
  },
};

export const ordersApi = {
  list: (params?: { status?: string; symbol?: string }) => {
    const q = new URLSearchParams(params as Record<string, string>).toString();
    return api<unknown[]>(`/orders${q ? `?${q}` : ''}`);
  },
  create: (data: { symbol: string; side: string; type: string; quantity: number; price?: number }) =>
    api('/orders', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (orderId: string) =>
    api(`/orders/${orderId}/cancel`, { method: 'POST' }),
};

/**
 * Two-Factor Authentication API.
 * Currently returns mock data. Replace implementations with real api() calls
 * when backend endpoints are available:
 * - GET  /auth/2fa/setup        -> { qrCodeUrl, secret }
 * - POST /auth/2fa/enable       -> body: { code }
 * - POST /auth/2fa/disable       -> body: { code }
 * - GET  /auth/2fa/backup-codes -> { codes }
 * - POST /auth/2fa/backup-codes/regenerate -> { codes }
 * - POST /auth/2fa/verify        -> body: { tempToken, code } -> { access_token, user }
 */
const mockDelay = () => new Promise((r) => setTimeout(r, 300));

export const twoFactorApi = {
  /** Fetch 2FA setup (QR code + secret). Real: GET /auth/2fa/setup */
  async getSetup(): Promise<TwoFactorSetupResponse> {
    await mockDelay();
    return {
      qrCodeUrl: MOCK_QR_IMAGE,
      secret: 'MOCK-KEY-ABCD1234',
    };
  },

  /** Enable 2FA after verifying code. Real: POST /auth/2fa/enable */
  async enable(_code: string): Promise<void> {
    await mockDelay();
    // Mock: always succeeds. Real: validate code, enable 2FA
  },

  /** Disable 2FA. Real: POST /auth/2fa/disable */
  async disable(_code: string): Promise<void> {
    await mockDelay();
    // Mock: always succeeds
  },

  /** Get backup codes. Real: GET /auth/2fa/backup-codes */
  async getBackupCodes(): Promise<TwoFactorBackupCodesResponse> {
    await mockDelay();
    return { codes: getDefaultMockBackupCodes() };
  },

  /** Regenerate backup codes. Real: POST /auth/2fa/backup-codes/regenerate */
  async regenerateBackupCodes(): Promise<TwoFactorBackupCodesResponse> {
    await mockDelay();
    return { codes: generateMockBackupCodes() };
  },

  /**
   * Verify 2FA code during login.
   * Real: POST /auth/2fa/verify with tempToken from login response.
   * Mock: validates code, then calls login with credentials (pass via options).
   */
  async verify(
    body: Verify2FaRequest,
    mockCredentials?: { email: string; password: string }
  ): Promise<{
    access_token: string;
    user: { id: string; email: string; displayName: string | null };
  }> {
    await mockDelay();
    if (body.code !== MOCK_VALID_CODE) {
      throw new Error('Invalid verification code');
    }
    // Mock: call login with credentials. Real: backend returns token from tempToken + code
    if (mockCredentials) {
      return authApi.login(mockCredentials.email, mockCredentials.password);
    }
    throw new Error('Real backend: use tempToken from login response');
  },

  /** Check if 2FA is required (mock: from localStorage). Real: from login response */
  is2FaRequired(): boolean {
    return getMock2faEnabled();
  },
};
