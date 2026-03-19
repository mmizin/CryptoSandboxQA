'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  role?: string;
} | null;

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const BACK_TO_ADMIN_KEY = 'back_to_admin';

export function useAuth(requireAuth = false) {
  const [user, setUser] = useState<User>(null);
  const [impersonating, setImpersonating] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setImpersonating(null);
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((u) => {
        setUser(u);
        const backToAdmin = localStorage.getItem(BACK_TO_ADMIN_KEY);
        setImpersonating(backToAdmin ? { email: u?.email ?? '' } : null);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem(BACK_TO_ADMIN_KEY);
        setUser(null);
        setImpersonating(null);
        if (requireAuth) router.push('/');
      })
      .finally(() => setLoading(false));
  }, [requireAuth, router]);

  useEffect(() => {
    refreshUser();
  }, [requireAuth, router, pathname, refreshUser]);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(BACK_TO_ADMIN_KEY);
    setUser(null);
    setImpersonating(null);
    router.push('/');
  };

  const impersonate = async (targetUserId: string): Promise<void> => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('Not authenticated');

    const res = await fetch(`${API_URL}/auth/impersonate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
      body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Impersonation failed');
    }

    const data = await res.json();
    localStorage.setItem(BACK_TO_ADMIN_KEY, data.backToAdminToken);
    localStorage.setItem('token', data.access_token);
    setUser(data.user);
    setImpersonating({ email: data.user.email });
    router.push('/dashboard');
  };

  const returnToAdmin = async (): Promise<void> => {
    const backToAdminToken = localStorage.getItem(BACK_TO_ADMIN_KEY);
    if (!backToAdminToken) {
      logout();
      return;
    }

    const res = await fetch(`${API_URL}/auth/end-impersonation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backToAdminToken }),
    });
    localStorage.removeItem(BACK_TO_ADMIN_KEY);

    if (!res.ok) {
      localStorage.removeItem('token');
      setUser(null);
      setImpersonating(null);
      router.push('/login');
      return;
    }

    const data = await res.json();
    localStorage.setItem('token', data.access_token);
    setUser(data.user);
    setImpersonating(null);
    router.push('/dashboard');
  };

  return {
    user,
    loading,
    logout,
    impersonating,
    impersonate,
    returnToAdmin,
    isAdmin: user?.role === 'admin',
  };
}
