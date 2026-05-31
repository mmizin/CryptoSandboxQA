'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ordersApi } from '@/lib/api';
import { evaluateOrderTriggers, type WorkingOrder } from '@/lib/orderTriggers';

interface UseOrderTriggersOptions {
  symbol: string | null;
  livePrice: number | null;
  onTriggered: () => void;
}

export function useOrderTriggers({ symbol, livePrice, onTriggered }: UseOrderTriggersOptions) {
  const [workingOrders, setWorkingOrders] = useState<WorkingOrder[]>([]);
  const triggeringRef = useRef<Set<string>>(new Set());

  // Seed limit orders from the DB on mount / symbol change
  useEffect(() => {
    if (!symbol) return;
    ordersApi
      .list({ status: 'open', symbol: `${symbol}_USD` })
      .then(({ data }) => {
        const orders: WorkingOrder[] = (data as Array<Record<string, unknown>>)
          .filter((o) => o.type === 'limit' || o.type === 'stop')
          .map((o) => ({
            id: String(o.id),
            symbol: String(o.symbol).split('_')[0],
            side: o.side as 'buy' | 'sell',
            orderType: o.type as 'limit' | 'stop',
            price: o.price != null ? parseFloat(String(o.price)) : null,
            stopPrice: o.stopPrice != null ? parseFloat(String(o.stopPrice)) : null,
            quantity: parseFloat(String(o.quantity)) || 0,
          }));
        setWorkingOrders(orders);
      })
      .catch(() => {});
  }, [symbol]);

  // Evaluate triggers on each price tick
  useEffect(() => {
    if (livePrice == null || workingOrders.length === 0) return;

    const eligible = workingOrders.filter((o) => !triggeringRef.current.has(o.id));
    const toTrigger = evaluateOrderTriggers(eligible, livePrice);
    if (toTrigger.length === 0) return;

    for (const order of toTrigger) {
      triggeringRef.current.add(order.id);
    }

    Promise.allSettled(
      toTrigger.map((order) =>
        ordersApi
          .setStatus(order.id, 'filled')
          .then(() => {
            setWorkingOrders((prev) => prev.filter((o) => o.id !== order.id));
            onTriggered();
          })
          .catch(() => {
            triggeringRef.current.delete(order.id);
          }),
      ),
    );
  }, [livePrice, workingOrders, onTriggered]);

  const addWorkingOrder = useCallback((order: WorkingOrder) => {
    setWorkingOrders((prev) => {
      if (prev.some((o) => o.id === order.id)) return prev;
      return [...prev, order];
    });
  }, []);

  const removeWorkingOrder = useCallback((id: string) => {
    triggeringRef.current.delete(id);
    setWorkingOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  return { workingOrders, addWorkingOrder, removeWorkingOrder };
}
