import React, { useState } from "react";
import { MobileBottomSheet } from "./MobileBottomSheet";
import { sanitizeNumericInput } from "../lib/tradeMath";

interface QuickOrderDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialSide: "buy" | "sell";
  symbol: string;
  latestPrice: string;
  availableBalance: string;
  lotSize: string;
  feeRate?: string;
  onSubmitOrder: (order: {
    side: "buy" | "sell";
    price: string;
    amount: string;
  }) => void;
}

export function QuickOrderDrawer({
  isOpen,
  onClose,
  initialSide,
  symbol,
  latestPrice,
  availableBalance,
  lotSize,
  feeRate = "0.001",
  onSubmitOrder,
}: QuickOrderDrawerProps) {
  const [side, setSide] = useState(initialSide);
  const [price, setPrice] = useState(latestPrice);
  const [amount, setAmount] = useState("");
  const [totalUsdt, setTotalUsdt] = useState("0");

  // 价格输入变化处理
  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valid = sanitizeNumericInput(e.target.value, 8);
    setPrice(valid);
  };

  // 数量输入变化处理
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valid = sanitizeNumericInput(e.target.value, 4);
    setAmount(valid);
  };

  // 确认下单
  const handleSubmit = () => {
    if (!price || !amount) return;
    onSubmitOrder({
      side,
      price: sanitizeNumericInput(price, 8),
      amount: sanitizeNumericInput(amount, 4),
    });
    onClose();
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={side === "buy" ? "买入 BTC/USDT" : "卖出 BTC/USDT"}
    >
      <div className="pb-safe">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <h3 className="text-base font-bold text-[#EAECEF]">
            {side === "buy" ? "买入" : "卖出"} BTC/USDT
          </h3>
          <button onClick={onClose} className="text-[#848E9C] hover:text-[#EAECEF] p-1" aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#848E9C]">委托价格</span>
            <span className="text-[#EAECEF] font-bold">{price} USDT</span>
          </div>
          <input
            type="text"
            placeholder="输入价格"
            value={price}
            onChange={handlePriceChange}
            className="w-full bg-[#2B3139] border border-[#474D57] rounded-xl px-3 py-2 text-xs text-[#EAECEF] focus:outline-none focus:border-[#0ECB81]"
            inputMode="decimal"
          />
          <div className="text-xs text-[#848E9C]">当前最新价: {latestPrice} USDT</div>
        </div>

        <div className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[#848E9C]">委托数量</span>
            <span className="text-[#EAECEF] font-bold">{amount ?? "0"} BTC</span>
          </div>
          <input
            type="text"
            placeholder="输入数量"
            value={amount ?? ""}
            onChange={handleAmountChange}
            className="w-full bg-[#2B3139] border border-[#474D57] rounded-xl px-3 py-2 text-xs text-[#EAECEF] focus:outline-none focus:border-[#0ECB81]"
            inputMode="decimal"
          />
          <div className="text-xs text-[#848E9C]">可用余额: {availableBalance} USDT</div>
        </div>

        <div className="p-4 border-t border-white/5">
          <div className="text-[848E9C] space-y-1 text-xs">
            <div>交易额: <span className="text-[#EAECEF]">{totalUsdt} USDT</span></div>
          </div>
        </div>

        <div className="p-4">
          <button
            onClick={handleSubmit}
            className="w-full h-11 bg-gradient-to-r from-[#0ECB81] to-[#F6465D] rounded-xl text-white font-bold text-xs uppercase hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed">
              {side === "buy" ? "买入 BTC" : "卖出 BTC"}
          </button>
        </div>
      </div>
    </MobileBottomSheet>
  );
}