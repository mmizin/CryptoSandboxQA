import type {
  TwoFactorSetupResponse,
  TwoFactorBackupCodesResponse,
  Verify2FaRequest,
} from './twoFactorTypes';

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
    api<
      | { access_token: string; user: { id: string; email: string; displayName: string | null } }
      | { requires2FA: true; tempToken: string }
    >('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (email: string, password: string, displayName?: string) =>
    api<{ access_token: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ email, password, displayName }) }
    ),
  logout: () => api<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  verify2Fa: (tempToken: string, code: string) =>
    api<{ access_token: string; user: { id: string; email: string; displayName: string | null } }>(
      '/auth/2fa/verify',
      { method: 'POST', body: JSON.stringify({ tempToken, code }) }
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

export const depositsApi = {
  depositFiat: (data: { fiatCurrency: string; amount: number; paymentMethodId?: string }) =>
    api('/deposits/fiat', { method: 'POST', body: JSON.stringify(data) }),
  listFiat: (params?: { limit?: number; offset?: number; from?: string; to?: string }) => {
    const sp = new URLSearchParams(params as Record<string, string>);
    return api<{ data: unknown[]; total: number }>(`/deposits/fiat${sp.toString() ? `?${sp}` : ''}`);
  },
  getCryptoAddress: (symbol: string) =>
    api<{ symbol: string; walletAddress: string }>('/deposits/crypto/address', {
      method: 'POST',
      body: JSON.stringify({ symbol }),
    }),
  depositCrypto: (data: { symbol: string; amount: number; walletAddress: string; txHash?: string }) =>
    api('/deposits/crypto', { method: 'POST', body: JSON.stringify(data) }),
  listCrypto: (params?: { limit?: number; offset?: number }) => {
    const sp = new URLSearchParams(params as Record<string, string>);
    return api<{ data: unknown[]; total: number }>(`/deposits/crypto${sp.toString() ? `?${sp}` : ''}`);
  },
};

export const portfolioApi = {
  getBalances: () => api<{ balances: Array<{ asset: string; available: string; locked: string; total: string }> }>('/portfolio/balances'),
  getSummary: () =>
    api<{
      totalValueUsd: string;
      assets: Array<{ symbol: string; amount: string; priceUsd: string; valueUsd: string }>;
    }>('/portfolio/summary'),
  getAllocation: () =>
    api<{
      allocations: Array<{ symbol: string; percentage: number; valueUsd: string }>;
    }>('/portfolio/allocation'),
};

export const transactionsApi = {
  list: (params?: { type?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const sp = new URLSearchParams(params as Record<string, string>);
    return api<{ data: unknown[]; total: number }>(`/transactions${sp.toString() ? `?${sp}` : ''}`);
  },
  getDeposits: (params?: { limit?: number; offset?: number; from?: string; to?: string }) => {
    const sp = new URLSearchParams(params as Record<string, string>);
    return api<{ data: unknown[]; total: number }>(`/transactions/deposits${sp.toString() ? `?${sp}` : ''}`);
  },
  getTrades: (params?: { limit?: number; offset?: number; from?: string; to?: string }) => {
    const sp = new URLSearchParams(params as Record<string, string>);
    return api<{ data: unknown[]; total: number }>(`/transactions/trades${sp.toString() ? `?${sp}` : ''}`);
  },
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
  get: (symbol: string) => api<CryptoItem | null>(`/cryptos/${symbol}`),
  getPriceHistory: (symbol: string, from?: string, to?: string) => {
    const sp = new URLSearchParams();
    if (from) sp.set('from', from);
    if (to) sp.set('to', to);
    const q = sp.toString();
    return api<{ symbol: string; data: Array<{ timestamp: string; price: string }> }>(
      `/cryptos/${symbol}/price-history${q ? `?${q}` : ''}`
    );
  },
};

export const ordersApi = {
  list: (params?: { marketType?: string; status?: string; symbol?: string; from?: string; to?: string; limit?: number; offset?: number }) => {
    const filtered = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v != null && v !== '')
    );
    const q = new URLSearchParams(filtered as Record<string, string>).toString();
    return api<{ data: unknown[]; total: number }>(`/orders${q ? `?${q}` : ''}`);
  },
  create: (data: { symbol: string; side: string; type: string; quantity: number; price?: number; marketType?: string; initialStatus?: string }) =>
    api('/orders', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (orderId: string) =>
    api(`/orders/${orderId}/cancel`, { method: 'POST' }),
  setStatus: (orderId: string, status: string) =>
    api(`/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const twoFactorApi = {
  getSetup: () =>
    api<TwoFactorSetupResponse>('/auth/2fa/setup', { method: 'GET' }),

  enable: (code: string) =>
    api<{ success: boolean; backupCodes?: string[] }>('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  disable: (code: string) =>
    api<{ success: boolean }>('/auth/2fa/disable', {
      method: 'POST',
      body: JSON.stringify({ code }),
    }),

  getBackupCodes: () =>
    api<{ codes: string[]; message?: string }>('/auth/2fa/backup-codes', { method: 'GET' }),

  regenerateBackupCodes: () =>
    api<TwoFactorBackupCodesResponse>('/auth/2fa/backup-codes/regenerate', {
      method: 'POST',
    }),

  verify: (body: Verify2FaRequest) =>
    authApi.verify2Fa(body.tempToken, body.code),

  getStatus: () => api<{ enabled: boolean }>('/auth/2fa/status', { method: 'GET' }),
};
