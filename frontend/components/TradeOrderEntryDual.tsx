'use client';

import { TradeOrderEntry } from '@/components/TradeOrderEntry';
import { type TradeCoin } from '@/lib/tradeMockData';
import { type WorkingOrder } from '@/lib/orderTriggers';

interface TradeOrderEntryDualProps {
  selectedCoin: TradeCoin | null;
  marketType?: 'spot' | 'futures';
  currentPrice?: number;
  onOrderSubmitted?: () => void;
  onOrderCreated?: (order: WorkingOrder) => void;
}

export function TradeOrderEntryDual({
  selectedCoin,
  marketType,
  currentPrice,
  onOrderSubmitted,
  onOrderCreated,
}: TradeOrderEntryDualProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <TradeOrderEntry
        selectedCoin={selectedCoin}
        marketType={marketType}
        currentPrice={currentPrice}
        onOrderSubmitted={onOrderSubmitted}
        onOrderCreated={onOrderCreated}
        fixedSide="buy"
      />
      <TradeOrderEntry
        selectedCoin={selectedCoin}
        marketType={marketType}
        currentPrice={currentPrice}
        onOrderSubmitted={onOrderSubmitted}
        onOrderCreated={onOrderCreated}
        fixedSide="sell"
      />
    </div>
  );
}
