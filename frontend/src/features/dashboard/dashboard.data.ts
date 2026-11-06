import { create } from "zustand";

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
