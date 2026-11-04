import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "zh-CN" | "zh-TW" | "en" | "km";
type Dictionary = Record<string, string>;
const zhCN: Dictionary = {
  Home:"首页",Markets:"行情",Trade:"交易",Assets:"资产",My:"我的",Orders:"订单",Earn:"理财",Support:"客服",Settings:"设置",Manage:"管理",
  Search:"搜索",Preview:"预览环境", "Market overview":"市场总览","Live spot prices and 24-hour market movement.":"现货实时价格与 24 小时涨跌情况。",
  Connecting:"连接中","Feed unavailable":"行情暂不可用","Live market feed":"实时行情","Market analytics":"市场分析",
  "Historical chart integration is still in progress.":"历史图表接口仍在接入中。","Choose your trading mode":"选择交易模式",
  "Your balances and transaction activity will appear here after the authenticated account API is connected.":"账户 API 接通后，将在此显示余额和交易记录。",
  "No account data loaded":"尚未加载账户数据","This preview does not invent balances or transaction history. Sign in and connect the account service to load your actual assets.":"预览环境不会伪造余额或交易记录。登录并连接账户服务后即可查看真实资产。",
  "Sign in":"登录","Create account":"创建账户","My account":"我的账户","Sign in to continue":"登录后继续",
  "Account details are not loaded in this preview.":"当前预览环境尚未加载账户详情。","Open deposit":"前往充值","Open withdrawal":"前往提现","Explore Earn":"查看理财",
  "Integration pending":"接口接入中","This page is scaffolded; no live action is enabled in this preview.":"此页面已建立，当前预览环境尚未开放真实操作。",
  "BTCBOX / MARKETS":"BTCBOX / 行情","BTCBOX / TRADE":"BTCBOX / 交易","BTCBOX / WALLET":"BTCBOX / 钱包","BTCBOX / ACCOUNT":"BTCBOX / 账户","BTCBOX / WORKSPACE":"BTCBOX / 工作区",
  Spot:"现货",Seconds:"秒合约","Buy and sell supported digital assets at market or limit prices.":"以市价或限价买卖支持的数字资产。",
  "Short-duration direction contracts with open positions and history.":"短周期方向合约、持仓与历史记录。","API integration pending":"接口接入中",Open:"打开",Futures:"期货",
  "Coming soon — no supported futures service is registered in the current backend.":"即将推出——当前后台尚未提供期货服务。",Unavailable:"暂不可用",Deposit:"充值",Withdraw:"提现",
  Verification:"身份认证","Spot trading":"现货交易","Seconds trading":"秒合约交易","Manage your profile, verification, security and support.":"管理个人资料、身份认证、安全与客服。",
  "Trading interfaces are being connected to BTCBOX's existing order and position services.":"交易界面正在接入 BTCBOX 现有订单和持仓服务。"
};
const zhTW: Dictionary = {
  Home:"首頁",Markets:"行情",Trade:"交易",Assets:"資產",My:"我的",Orders:"訂單",Earn:"理財",Support:"客服",Settings:"設定",Manage:"管理",
  Search:"搜尋",Preview:"預覽環境","Market overview":"市場總覽","Live spot prices and 24-hour market movement.":"現貨即時價格與 24 小時漲跌情況。",
  Connecting:"連線中","Feed unavailable":"行情暫不可用","Live market feed":"即時行情","Market analytics":"市場分析",
  "Historical chart integration is still in progress.":"歷史圖表介接仍在進行中。","Choose your trading mode":"選擇交易模式",
  "Your balances and transaction activity will appear here after the authenticated account API is connected.":"帳戶 API 接通後，將在此顯示餘額與交易紀錄。",
  "No account data loaded":"尚未載入帳戶資料","This preview does not invent balances or transaction history. Sign in and connect the account service to load your actual assets.":"預覽環境不會偽造餘額或交易紀錄。登入並連接帳戶服務後即可查看實際資產。",
  "Sign in":"登入","Create account":"建立帳戶","My account":"我的帳戶","Sign in to continue":"登入以繼續",
  "Account details are not loaded in this preview.":"目前預覽環境尚未載入帳戶詳情。","Open deposit":"前往充值","Open withdrawal":"前往提現","Explore Earn":"查看理財",
  "Integration pending":"介接中","This page is scaffolded; no live action is enabled in this preview.":"此頁面已建立，目前預覽環境尚未開放實際操作。",
  "BTCBOX / MARKETS":"BTCBOX / 行情","BTCBOX / TRADE":"BTCBOX / 交易","BTCBOX / WALLET":"BTCBOX / 錢包","BTCBOX / ACCOUNT":"BTCBOX / 帳戶","BTCBOX / WORKSPACE":"BTCBOX / 工作區",
  Spot:"現貨",Seconds:"秒合約","Buy and sell supported digital assets at market or limit prices.":"以市價或限價買賣支援的數位資產。",
  "Short-duration direction contracts with open positions and history.":"短週期方向合約、持倉與歷史紀錄。","API integration pending":"API 介接中",Open:"開啟",Futures:"期貨",
  "Coming soon — no supported futures service is registered in the current backend.":"即將推出——目前後端尚未提供期貨服務。",Unavailable:"暫不可用",Deposit:"充值",Withdraw:"提現",
  Verification:"身分驗證","Spot trading":"現貨交易","Seconds trading":"秒合約交易","Manage your profile, verification, security and support.":"管理個人資料、身分驗證、安全與客服。",
  "Trading interfaces are being connected to BTCBOX's existing order and position services.":"交易介面正在介接 BTCBOX 現有訂單與持倉服務。"
};
const km: Dictionary = {
  Home:"ទំព័រដើម",Markets:"ទីផ្សារ",Trade:"ជួញដូរ",Assets:"ទ្រព្យសកម្ម",My:"គណនីខ្ញុំ",Orders:"ការបញ្ជាទិញ",Earn:"ប្រាក់ចំណូល",Support:"ជំនួយ",Settings:"ការកំណត់",Manage:"គ្រប់គ្រង",
  Search:"ស្វែងរក",Preview:"បរិស្ថានសាកល្បង","Market overview":"ទិដ្ឋភាពទូទៅទីផ្សារ","Live spot prices and 24-hour market movement.":"តម្លៃ Spot ផ្ទាល់ និងការប្រែប្រួលក្នុងរយៈពេល ២៤ ម៉ោង។",
  Connecting:"កំពុងភ្ជាប់","Feed unavailable":"មិនអាចទទួលទិន្នន័យបាន","Live market feed":"ទិន្នន័យទីផ្សារផ្ទាល់","Market analytics":"ការវិភាគទីផ្សារ",
  "Choose your trading mode":"ជ្រើសរើសរបៀបជួញដូរ","No account data loaded":"មិនទាន់មានទិន្នន័យគណនី","Sign in":"ចូលគណនី","Create account":"បង្កើតគណនី","My account":"គណនីរបស់ខ្ញុំ",
  "Sign in to continue":"ចូលគណនីដើម្បីបន្ត","Integration pending":"កំពុងភ្ជាប់ប្រព័ន្ធ","BTCBOX / MARKETS":"BTCBOX / ទីផ្សារ","BTCBOX / TRADE":"BTCBOX / ជួញដូរ",
  "BTCBOX / WALLET":"BTCBOX / កាបូប","BTCBOX / ACCOUNT":"BTCBOX / គណនី","BTCBOX / WORKSPACE":"BTCBOX / កន្លែងធ្វើការ",
  Spot:"Spot",Seconds:"កិច្ចសន្យាវិនាទី","Buy and sell supported digital assets at market or limit prices.":"ទិញ និងលក់ទ្រព្យសកម្មឌីជីថលដោយតម្លៃទីផ្សារ ឬតម្លៃកំណត់។",
  "Short-duration direction contracts with open positions and history.":"កិច្ចសន្យារយៈពេលខ្លី ជាមួយទីតាំងបើក និងប្រវត្តិ។","API integration pending":"កំពុងភ្ជាប់ API",Open:"បើក",Futures:"Futures",
  "Coming soon — no supported futures service is registered in the current backend.":"នឹងមានឆាប់ៗនេះ — ប្រព័ន្ធខាងក្រោយមិនទាន់គាំទ្រ Futures ទេ។",Unavailable:"មិនទាន់មាន",Deposit:"ដាក់ប្រាក់",Withdraw:"ដកប្រាក់",
  Verification:"ផ្ទៀងផ្ទាត់អត្តសញ្ញាណ","Spot trading":"ការជួញដូរ Spot","Seconds trading":"ការជួញដូររយៈពេលវិនាទី"
};
const dictionaries: Record<Language, Dictionary> = { "zh-CN":zhCN, "zh-TW":zhTW, en:{}, km };
type I18nValue = { language:Language; setLanguage:(language:Language)=>void; t:(value:string)=>string };
const I18nContext=createContext<I18nValue|null>(null);
export function I18nProvider({children}:{children:ReactNode}){
 const [language,setLanguageState]=useState<Language>(()=>{const saved=typeof window!=="undefined"?window.localStorage.getItem("btcbox-language"):null;return saved==="zh-CN"||saved==="zh-TW"||saved==="km"||saved==="en"?saved:"en";});
 const setLanguage=(next:Language)=>{setLanguageState(next);if(typeof window!=="undefined")window.localStorage.setItem("btcbox-language",next);document.documentElement.lang=next;};
 const value=useMemo(()=>({language,setLanguage,t:(text:string)=>dictionaries[language][text]||text}),[language]);
 return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n(){const value=useContext(I18nContext);if(!value)throw new Error("useI18n must be used inside I18nProvider");return value;}
