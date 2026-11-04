import { create } from "zustand";

export const topTokens = [
  {
    id: "ETH",
    name: "Ethereum",
    symbol: "ETH",
    liquidity: "$688.41m",
    volume: "US$190,980,899",
    price: "US$2,267",
    change: "+1.42%",
    isPositive: true,
  },
  {
    id: "USDT",
    name: "Tether USD",
    symbol: "USDT",
    liquidity: "US$62,880,160",
    volume: "US$23,049,275",
    price: "US$1.00",
    change: "-0.02%",
    isPositive: false,
  },
  {
    id: "USDC",
    name: "USDC",
    symbol: "USDC",
    liquidity: "US$73,825,043",
    volume: "US$17,572,042",
    price: "US$1.00",
    change: "+12.62%",
    isPositive: true,
  },
  {
    id: "OXT",
    name: "Orchid",
    symbol: "OXT",
    liquidity: "US$7,621,786",
    volume: "US$12,364,368",
    price: "US$5.00",
    change: "+0.12%",
    isPositive: true,
  },
  {
    id: "SOL",
    name: "Solana",
    symbol: "SOL",
    liquidity: "US$15,482,911",
    volume: "US$8,947,520",
    price: "US$8.70",
    change: "+3.12%",
    isPositive: true,
  },
];

// Simple store for time ranges
interface DashboardState {
  liquidityRange: string;
  volumeRange: string;
  setLiquidityRange: (range: string) => void;
  setVolumeRange: (range: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  liquidityRange: '30d',
  volumeRange: '7d',
  setLiquidityRange: (range) => set({ liquidityRange: range }),
  setVolumeRange: (range) => set({ volumeRange: range }),
}));
