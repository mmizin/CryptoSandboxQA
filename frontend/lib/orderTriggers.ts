export type WorkingOrder = {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'stop';
  price: number | null;
  stopPrice: number | null;
  quantity: number;
};

/**
 * Returns the subset of orders that should trigger at the given price.
 * Buy Limit:  triggers when livePrice <= price  (market fell to/below limit)
 * Sell Limit: triggers when livePrice >= price  (market rose to/above limit)
 * Buy Stop:   triggers when livePrice >= stopPrice (market rose to/above stop)
 * Sell Stop:  triggers when livePrice <= stopPrice (market fell to/below stop)
 */
export function evaluateOrderTriggers(orders: WorkingOrder[], livePrice: number): WorkingOrder[] {
  return orders.filter((o) => {
    if (o.orderType === 'limit') {
      if (o.price == null) return false;
      return o.side === 'buy' ? livePrice <= o.price : livePrice >= o.price;
    }
    if (o.orderType === 'stop') {
      if (o.stopPrice == null) return false;
      return o.side === 'buy' ? livePrice >= o.stopPrice : livePrice <= o.stopPrice;
    }
    return false;
  });
}
