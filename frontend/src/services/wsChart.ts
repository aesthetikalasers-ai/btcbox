// WebSocket market data channel for K-line/candles
// Connects to OKX public candle channels

export const marketWS = {
  subscribe: (
    params: { channel: string; instId: string },
    callback: (res: { data: any[] }) => void
  ) => {
    // In a real implementation, this would establish a WebSocket connection
    // to the exchange's candle channel and return an unsubscribe function.
    // For now, we set up a basic message handler pattern.
    const ws = new WebSocket(`wss://okx.ws.com/candle?channel=${params.channel}&instId=${params.instId}`);

    ws.onmessage = (event) => {
      const res = JSON.parse(event.data);
      callback({ data: res });
    };

    return () => {
      ws.close();
    };
  },
};