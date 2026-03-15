'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type User = { id: string; email: string; displayName: string | null } | null;

export function useAuth(requireAuth = false) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      if (requireAuth) router.push('/');
      return;
    }
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
        if (requireAuth) router.push('/');
      })
      .finally(() => setLoading(false));
  }, [requireAuth, router]);

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    router.push('/');
  };

  return { user, loading, logout };
}
