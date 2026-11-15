import React from 'react';

export default function ExchangeTerminal() {
  return (
    <main className="flex flex-col h-screen bg-[#0B0E11] text-[#F0F4F8] font-sans overflow-hidden select-none">
      {/* 顶部导航栏 */}
      <header className="h-12 border-b border-[#2B3139] flex items-center px-4 justify-between bg-[#161B22]">
        <div className="flex items-center space-x-6">
          <div className="text-lg font-bold tracking-wider text-[#F0F4F8]">
            BTC/USDT <span className="text-xs text-[#0ECB81] bg-[#0ECB81]/10 px-2 py-0.5 rounded ml-2">Perpetual</span>
          </div>
          <div className="flex items-center space-x-6 text-sm font-mono">
            <div>
              <span className="text-[#9CA3AF] text-[11px] block">Latest Price</span>
              <span className="text-[#0ECB81] font-bold text-base">105,876.45</span>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-[11px] block">24h Change</span>
              <span className="text-[#0ECB81]">+4.52%</span>
            </div>
            <div>
              <span className="text-[#9CA3AF] text-[11px] block">24h Volume</span>
              <span className="text-[#F0F4F8]">48,291.12 BTC</span>
            </div>
          </div>
        </div>
      </header>

      {/* 中部核心三栏交易区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：盘口与最新成交 */}
        <div className="w-80 border-r border-[#2B3139] flex flex-col bg-[#161B22]">
          <div className="h-9 border-b border-[#2B3139] px-3 flex items-center text-xs font-semibold text-[#9CA3AF]">
            Order Book / Trades
          </div>
          <div className="flex-1 p-2 font-mono text-xs flex flex-col justify-between">
            <div className="space-y-0.5">
              {[65003, 65002, 65001].map((p, i) => (
                <div key={i} className="flex justify-between px-1 py-0.5 hover:bg-[#2B3139]/50 relative">
                  <span className="text-[#F6465D]">{p.toFixed(2)}</span>
                  <span className="text-[#F0F4F8]">1.248{i}</span>
                  <div className="absolute right-0 top-0 bottom-0 bg-[#F6465D]/10 w-1/3 pointer-events-none" />
                </div>
              ))}
            </div>
            <div className="py-2 text-center border-y border-[#2B3139] my-2">
              <span className="text-lg font-bold text-[#0ECB81]">65,000.00 USD</span>
            </div>
            <div className="space-y-0.5">
              {[64999, 64998, 64997].map((p, i) => (
                <div key={i} className="flex justify-between px-1 py-0.5 hover:bg-[#2B3139]/50 relative">
                  <span className="text-[#0ECB81]">{p.toFixed(2)}</span>
                  <span className="text-[#F0F4F8]">2.115{i}</span>
                  <div className="absolute right-0 top-0 bottom-0 bg-[#0ECB81]/10 w-2/3 pointer-events-none" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 中间：K线图表与深度区 */}
        <div className="flex-1 flex flex-col bg-[#0B0E11]">
          <div className="h-9 border-b border-[#2B3139] px-4 flex items-center space-x-4 text-xs text-[#9CA3AF]">
            <span className="text-[#F0F4F8] font-semibold border-b-2 border-[#0ECB81] pb-2 pt-2">TradingView</span>
            <span className="hover:text-[#F0F4F8] cursor-pointer">Depth Chart</span>
          </div>
          <div className="flex-1 flex items-center justify-center text-[#9CA3AF] bg-[#0B0E11]">
            <div className="text-center">
              <p className="text-sm font-medium">TradingView Charting Library Container</p>
              <p className="text-xs text-[#6E7681] mt-1">WebSocket Real-time Feed Connected</p>
            </div>
          </div>
        </div>

        {/* 右侧：专业下单执行面板 */}
        <div className="w-80 border-l border-[#2B3139] flex flex-col bg-[#161B22]">
          <div className="h-9 border-b border-[#2B3139] px-3 flex items-center text-xs font-semibold text-[#9CA3AF]">
            Order Execution
          </div>
          <div className="p-4 space-y-4">
            <div className="flex bg-[#0B0E11] p-1 rounded">
              <button className="flex-1 py-1 text-xs font-medium rounded bg-[#161B22] text-[#F0F4F8] shadow">Limit</button>
              <button className="flex-1 py-1 text-xs font-medium text-[#9CA3AF] hover:text-[#F0F4F8]">Market</button>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#9CA3AF]">Price (USDT)</label>
              <input type="text" defaultValue="65,000.00" className="w-full bg-[#0B0E11] border border-[#2B3139] rounded px-3 py-2 text-sm font-mono text-[#F0F4F8] focus:border-[#0ECB81] outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-[#9CA3AF]">Amount (BTC)</label>
              <input type="text" placeholder="0.00" className="w-full bg-[#0B0E11] border border-[#2B3139] rounded px-3 py-2 text-sm font-mono text-[#F0F4F8] focus:border-[#0ECB81] outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button className="w-full bg-[#0ECB81] hover:bg-[#0ECB81]/90 text-[#0B0E11] font-bold py-2.5 rounded text-sm transition-all">
                Buy / Long
              </button>
              <button className="w-full bg-[#F6465D] hover:bg-[#F6465D]/90 text-[#F0F4F8] font-bold py-2.5 rounded text-sm transition-all">
                Sell / Short
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 底部：持仓与当前委托面板 */}
      <div className="h-44 border-t border-[#2B3139] bg-[#161B22] flex flex-col">
        <div className="h-9 border-b border-[#2B3139] px-4 flex items-center space-x-6 text-xs font-semibold text-[#9CA3AF]">
          <span className="text-[#F0F4F8] border-b-2 border-[#0ECB81] pb-2 pt-2 cursor-pointer">Positions (1)</span>
          <span className="hover:text-[#F0F4F8] cursor-pointer">Open Orders (3)</span>
          <span className="hover:text-[#F0F4F8] cursor-pointer">Order History</span>
          <span className="hover:text-[#F0F4F8] cursor-pointer">Assets</span>
        </div>
        <div className="flex-1 p-3 overflow-y-auto font-mono text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[#9CA3AF] border-b border-[#2B3139] pb-2">
                <th className="pb-2 font-normal">Contract</th>
                <th className="pb-2 font-normal">Size</th>
                <th className="pb-2 font-normal">Entry Price</th>
                <th className="pb-2 font-normal">Mark Price</th>
                <th className="pb-2 font-normal">Liq. Price</th>
                <th className="pb-2 font-normal text-right">Profit (ROE %)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#2B3139]/30 hover:bg-[#2B3139]/20">
                <td className="py-2.5 font-bold text-[#F0F4F8]">BTCUSDT <span className="text-[#0ECB81] text-[10px] ml-1">20x</span></td>
                <td className="py-2.5">0.50 BTC</td>
                <td className="py-2.5">64,210.50</td>
                <td className="py-2.5">65,000.00</td>
                <td className="py-2.5 text-[#F6465D]">61,850.00</td>
                <td className="py-2.5 text-right font-bold text-[#0ECB81]">+394.75 USD (+12.35%)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
