#!/usr/bin/env node
/**
 * One-off maintenance script: appends the trading-terminal keys introduced by the
 * desktop 3-column refactor to every locale dictionary. Idempotent — keys that
 * already exist are left untouched. Run from `frontend/`: `node scripts/add-terminal-i18n-keys.mjs`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const translations = {
  "Spread": { en: "Spread", ja: "スプレッド", "zh-CN": "价差", es: "Diferencial", pt: "Spread", it: "Spread", de: "Spread", vi: "Chênh lệch" },
  "Show": { en: "Show", ja: "表示", "zh-CN": "显示", es: "Mostrar", pt: "Mostrar", it: "Mostra", de: "Anzeigen", vi: "Hiển thị" },
  "Log in": { en: "Log in", ja: "ログイン", "zh-CN": "登录", es: "Iniciar sesión", pt: "Entrar", it: "Accedi", de: "Anmelden", vi: "Đăng nhập" },
  "Register": { en: "Register", ja: "登録", "zh-CN": "注册", es: "Registrarse", pt: "Registrar", it: "Registrati", de: "Registrieren", vi: "Đăng ký" },
  "Order form": { en: "Order form", ja: "注文フォーム", "zh-CN": "下单面板", es: "Formulario de orden", pt: "Formulário de ordem", it: "Modulo ordine", de: "Orderformular", vi: "Biểu mẫu đặt lệnh" },
  "Order side": { en: "Order side", ja: "売買方向", "zh-CN": "买卖方向", es: "Lado de la orden", pt: "Lado da ordem", it: "Lato ordine", de: "Orderseite", vi: "Chiều lệnh" },
  "Order size percentage": { en: "Order size percentage", ja: "注文サイズの割合", "zh-CN": "下单比例", es: "Porcentaje del tamaño", pt: "Percentual do tamanho", it: "Percentuale dimensione", de: "Ordergröße in Prozent", vi: "Tỷ lệ khối lượng" },
  "Click a price to fill the order form": { en: "Click a price to fill the order form", ja: "価格をクリックすると注文フォームに入力されます", "zh-CN": "点击价格即可填入下单面板", es: "Haz clic en un precio para rellenar el formulario", pt: "Clique num preço para preencher o formulário", it: "Fai clic su un prezzo per compilare il modulo", de: "Preis anklicken, um das Formular zu füllen", vi: "Nhấn vào giá để điền biểu mẫu" },
  "Login / Register to Trade": { en: "Login / Register to Trade", ja: "ログイン / 登録して取引", "zh-CN": "登录 / 注册后交易", es: "Inicia sesión / regístrate para operar", pt: "Entrar / registrar para negociar", it: "Accedi / registrati per fare trading", de: "Anmelden / registrieren zum Handeln", vi: "Đăng nhập / đăng ký để giao dịch" },
  "Sign in to place orders. Market data stays fully available without an account.": {
    en: "Sign in to place orders. Market data stays fully available without an account.",
    ja: "注文にはログインが必要です。アカウントがなくてもマーケットデータはすべて閲覧できます。",
    "zh-CN": "登录后即可下单。无需账户也可查看全部行情数据。",
    es: "Inicia sesión para enviar órdenes. Los datos de mercado siguen disponibles sin cuenta.",
    pt: "Entre para enviar ordens. Os dados de mercado continuam disponíveis sem conta.",
    it: "Accedi per inviare ordini. I dati di mercato restano disponibili senza account.",
    de: "Melden Sie sich an, um Orders zu platzieren. Marktdaten bleiben auch ohne Konto verfügbar.",
    vi: "Đăng nhập để đặt lệnh. Dữ liệu thị trường vẫn xem được khi chưa có tài khoản.",
  },
  "System notices hidden": { en: "System notices hidden", ja: "システム通知を非表示にしました", "zh-CN": "已隐藏系统提示", es: "Avisos del sistema ocultos", pt: "Avisos do sistema ocultos", it: "Avvisi di sistema nascosti", de: "Systemhinweise ausgeblendet", vi: "Đã ẩn thông báo hệ thống" },
  "Sign in to view open orders.": { en: "Sign in to view open orders.", ja: "ログインすると現在の注文が表示されます。", "zh-CN": "登录后可查看当前委托。", es: "Inicia sesión para ver las órdenes abiertas.", pt: "Entre para ver as ordens abertas.", it: "Accedi per vedere gli ordini aperti.", de: "Melden Sie sich an, um offene Orders zu sehen.", vi: "Đăng nhập để xem lệnh đang mở." },
  "Sign in to view order history.": { en: "Sign in to view order history.", ja: "ログインすると注文履歴が表示されます。", "zh-CN": "登录后可查看订单历史。", es: "Inicia sesión para ver el historial de órdenes.", pt: "Entre para ver o histórico de ordens.", it: "Accedi per vedere lo storico ordini.", de: "Melden Sie sich an, um den Orderverlauf zu sehen.", vi: "Đăng nhập để xem lịch sử lệnh." },
  "Spot execution status is unavailable. Order entry is disabled.": {
    en: "Spot execution status is unavailable. Order entry is disabled.",
    ja: "現物取引の執行状況を取得できません。注文入力は無効です。",
    "zh-CN": "无法获取现货撮合状态，下单功能已禁用。",
    es: "El estado de ejecución spot no está disponible. La entrada de órdenes está desactivada.",
    pt: "O status de execução spot não está disponível. A entrada de ordens está desativada.",
    it: "Lo stato di esecuzione spot non è disponibile. L'inserimento ordini è disattivato.",
    de: "Der Spot-Ausführungsstatus ist nicht verfügbar. Die Ordereingabe ist deaktiviert.",
    vi: "Không lấy được trạng thái khớp lệnh spot. Chức năng đặt lệnh bị tắt.",
  },
  "Current price": { en: "Current price", ja: "現在価格", "zh-CN": "当前价格", es: "Precio actual", pt: "Preço atual", it: "Prezzo attuale", de: "Aktueller Preis", vi: "Giá hiện tại" },
};

const locales = ["en", "ja", "zh-CN", "es", "pt", "it", "de", "vi"];
for (const locale of locales) {
  const file = resolve("src/lib/locales", locale + ".json");
  const source = readFileSync(file, "utf8");
  const dictionary = JSON.parse(source);
  const missing = Object.entries(translations).filter(([key]) => !Object.hasOwn(dictionary, key));
  if (!missing.length) {
    console.log(locale + ": already complete");
    continue;
  }
  const trailingNewline = source.endsWith("\n") ? "\n" : "";
  const body = source.trimEnd();
  const closing = body.lastIndexOf("}");
  const inserted = missing.map(([key, values]) => "  " + JSON.stringify(key) + ": " + JSON.stringify(values[locale])).join(",\n");
  // The existing object ends with `"last key": "value"\n}` — a comma joins the two blocks.
  const next = body.slice(0, closing).trimEnd() + ",\n" + inserted + "\n}\n";
  JSON.parse(next);
  writeFileSync(file, next, "utf8");
  console.log(locale + ": added " + missing.length + " keys" + trailingNewline.replace("\n", ""));
}
