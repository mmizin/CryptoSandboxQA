'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useTicker(symbol: string) {
  const [ticker, setTicker] = useState<{ lastPrice: number; volume24h: number } | null>(null);

  useEffect(() => {
    const socket = io(`${WS_URL}/ticker`, { transports: ['websocket', 'polling'] });
    socket.emit('subscribe', symbol);
    socket.on('ticker', (data: { symbol: string; lastPrice: number; volume24h: number }) => {
      if (data.symbol === symbol) {
        setTicker({ lastPrice: data.lastPrice, volume24h: data.volume24h });
      }
    });
    return () => {
      socket.emit('unsubscribe', symbol);
      socket.disconnect();
    };
  }, [symbol]);

  return ticker;
}
