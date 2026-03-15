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
