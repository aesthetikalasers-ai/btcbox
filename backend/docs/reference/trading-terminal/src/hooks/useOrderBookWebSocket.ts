import { useState, useEffect, useRef } from 'react';

export function useOrderBookWebSocket(symbol: string) {
  const [bids, setBids] = useState<[string, string][]>([]);
  const [asks, setAsks] = useState<[string, string][]>([]);

  const orderBookRef = useRef<{ bids: Map<string, string>; asks: Map<string, string> }>({
    bids: new Map(),
    asks: new Map(),
  });

  const updateRef = useRef(false);

  useEffect(() => {
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@depth@100ms`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.b) {
        data.b.forEach(([price, size]: [string, string]) => {
          if (parseFloat(size) === 0) {
            orderBookRef.current.bids.delete(price);
          } else {
            orderBookRef.current.bids.set(price, size);
          }
        });
      }

      if (data.a) {
        data.a.forEach(([price, size]: [string, string]) => {
          if (parseFloat(size) === 0) {
            orderBookRef.current.asks.delete(price);
          } else {
            orderBookRef.current.asks.set(price, size);
          }
        });
      }

      updateRef.current = true;
    };

    let animationFrameId: number;
    const processUpdates = () => {
      if (updateRef.current) {
        const sortedBids = Array.from(orderBookRef.current.bids.entries())
          .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]))
          .slice(0, 15);

        const sortedAsks = Array.from(orderBookRef.current.asks.entries())
          .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
          .slice(0, 15)
          .reverse();

        setBids(sortedBids);
        setAsks(sortedAsks);
        updateRef.current = false;
      }
      animationFrameId = requestAnimationFrame(processUpdates);
    };

    animationFrameId = requestAnimationFrame(processUpdates);

    return () => {
      ws.close();
      cancelAnimationFrame(animationFrameId);
    };
  }, [symbol]);

  return { bids, asks };
}
