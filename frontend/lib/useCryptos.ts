'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cryptosApi, type CryptoItem } from './api';

export function useCryptos(params: {
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  const [data, setData] = useState<CryptoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const limit = params.limit ?? 10;
  const search = params.search ?? '';
  const sortBy = params.sortBy ?? 'volume24h';
  const sortOrder = params.sortOrder ?? 'desc';

  const fetchPage = useCallback(
    async (pageOffset: number, append: boolean) => {
      const id = ++fetchIdRef.current;
      setLoading(true);
      setError(null);
      if (!append) setData([]);
      try {
        const res = await cryptosApi.list({
          limit,
          offset: pageOffset,
          search: search || undefined,
          sortBy,
          sortOrder,
        });
        if (id !== fetchIdRef.current) return 0;
        setData((prev) => (append ? [...prev, ...res.data] : res.data));
        setTotal(res.total);
        setOffset(pageOffset);
        return res.data.length;
      } catch (err) {
        if (id !== fetchIdRef.current) return 0;
        setError(err instanceof Error ? err.message : 'Failed to load');
        if (!append) {
          setData([]);
          setTotal(0);
        }
        return 0;
      } finally {
        if (id === fetchIdRef.current) setLoading(false);
      }
    },
    [limit, search, sortBy, sortOrder]
  );

  const dataLengthRef = useRef(0);
  dataLengthRef.current = data.length;

  const loadMore = useCallback(() => {
    fetchPage(dataLengthRef.current, true);
  }, [fetchPage]);

  const goNext = useCallback(() => {
    const nextOffset = offset + limit;
    if (nextOffset < total) fetchPage(nextOffset, false);
  }, [offset, limit, total, fetchPage]);

  const goPrev = useCallback(() => {
    const prevOffset = Math.max(0, offset - limit);
    fetchPage(prevOffset, false);
  }, [offset, limit, fetchPage]);

  useEffect(() => {
    fetchPage(0, false);
  }, [fetchPage]);

  const canGoNext = offset + limit < total;
  const canGoPrev = offset > 0;

  return {
    data,
    total,
    offset,
    loading,
    error,
    loadMore,
    goNext,
    goPrev,
    canGoNext,
    canGoPrev,
    refetch: () => fetchPage(0, false),
  };
}
