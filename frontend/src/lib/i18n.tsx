import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "ja" | "zh-CN" | "es" | "vi" | "it" | "pt";
type Dictionary = Record<string, string>;

const dictionaries: Record<Language, Dictionary> = {
  en: {
    "BTCBOX / OPEN MARKET":"BTCBOX / OPEN MARKET",
    "Digital asset exchange":"Digital asset exchange",
    "Explore the market. Trade with confidence.":"Explore the market. Trade with confidence.",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.",
    "Public market access":"Public market access",
    "View market prices and historical movement before you sign in.":"View market prices and historical movement before you sign in.",
    "Account protection":"Account protection",
    "Personal assets and account actions require an authenticated session.":"Personal assets and account actions require an authenticated session.",
    "Ready to access your account?":"Ready to access your account?",
    "Create an account or sign in to manage your personal assets and account services.":"Create an account or sign in to manage your personal assets and account services.",
    "Spot markets":"Spot markets","Live prices from the BTCBOX market service":"Live prices from the BTCBOX market service","Loading…":"Loading…","pairs":"pairs","Market feed unavailable":"Market feed unavailable","Market data is temporarily unavailable. Please try again shortly.":"Market data is temporarily unavailable. Please try again shortly.","No market pairs are currently available.":"No market pairs are currently available.",
    "Asset":"Asset","Last price":"Last price","24h change":"24h change","24h volume":"24h volume","24h high":"24h high","24h low":"24h low","Choose your trading mode":"Choose your trading mode","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"Browse live Earn products and your positions. Subscribe and redeem are available only when backend controls are enabled.","Live product catalog":"Live product catalog"
  },
  ja: {
    "BTCBOX / OPEN MARKET":"BTCBOX / 公開市場",
    "Digital asset exchange":"デジタル資産取引所",
    "Explore the market. Trade with confidence.":"市場を知り、安心して取引を始めましょう。",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"デジタル資産のリアルタイム市場や価格変動、BTCBOXの取引サービスをご覧いただけます。公開市場情報はログイン不要です。",
    "Public market access":"公開市場へのアクセス",
    "View market prices and historical movement before you sign in.":"ログイン前でも市場価格と過去の値動きを確認できます。",
    "Account protection":"アカウント保護",
    "Personal assets and account actions require an authenticated session.":"個人資産やアカウント操作には認証が必要です。",
    "Ready to access your account?":"アカウントを利用しますか？",
    "Create an account or sign in to manage your personal assets and account services.":"アカウントを作成またはログインして、資産や各種サービスを管理できます。",
    "Spot markets":"現物市場","Live prices from the BTCBOX market service":"BTCBOXマーケットサービスのリアルタイム価格","Loading…":"読み込み中…","pairs":"通貨ペア","Market feed unavailable":"相場データを取得できません","Market data is temporarily unavailable. Please try again shortly.":"市場データを一時的に取得できません。しばらくしてからもう一度お試しください。","No market pairs are currently available.":"現在利用できる通貨ペアはありません。",
    "Asset":"銘柄","Last price":"最終価格","24h change":"24時間変動","24h volume":"24時間取引高","24h high":"24時間高値","24h low":"24時間安値",
    Home:"ホーム",Markets:"市場",Trade:"取引",Assets:"資産",My:"マイページ",Orders:"注文",Earn:"運用",Support:"サポート",Settings:"設定",Manage:"管理",Search:"検索",
    "Market overview":"マーケット概要","Live spot prices and 24-hour market movement.":"現物価格と24時間の価格変動。",Connecting:"接続中","Feed unavailable":"相場データを取得できません","Live market feed":"リアルタイム相場","Market analytics":"マーケット分析",
    "Historical chart integration is still in progress.":"過去チャートの接続を準備中です。","Choose your trading mode":"取引方法を選択","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"リアルタイムの運用商品と保有ポジションを確認できます。申込・償還はバックエンドの金融管理機能が有効な場合のみ利用できます。","Live product catalog":"リアルタイム商品一覧","Sign in":"ログイン","Create account":"アカウント作成","My account":"マイアカウント","Sign in to continue":"続行するにはログインしてください",
    "No account data loaded":"アカウントデータがありません",
    Spot:"現物",Seconds:"秒単位取引",Futures:"先物",Deposit:"入金",Withdraw:"出金",Verification:"本人確認",Open:"開く",Unavailable:"利用不可",
    "BTCBOX / MARKETS":"BTCBOX / 市場","BTCBOX / TRADE":"BTCBOX / 取引","BTCBOX / WALLET":"BTCBOX / ウォレット","BTCBOX / ACCOUNT":"BTCBOX / アカウント","BTCBOX / WORKSPACE":"BTCBOX / ワークスペース",
    "API integration pending":"API接続準備中","Open deposit":"入金する","Open withdrawal":"出金する","Explore Earn":"運用を見る","Spot trading":"現物取引","Seconds trading":"秒単位取引",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"認証済みアカウントAPIの接続後、残高と取引履歴がここに表示されます。",
    
    "Manage your profile, verification, security and support.":"プロフィール、本人確認、セキュリティ、サポートを管理します。",
    "Close navigation":"ナビゲーションを閉じる",
    "Open navigation":"ナビゲーションを開く",
    "Search BTCBOX":"BTCBOXを検索",
    "Notifications unavailable":"通知は利用できません",
    "Notifications are not connected yet":"通知機能はまだ接続されていません",
    "Language":"言語",
    "Primary navigation":"メインナビゲーション",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"取引画面をBTCBOXの既存注文・ポジションサービスに接続中です。",
    "Mobile navigation":"モバイルナビゲーション",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"対応するデジタル資産を成行または指値で売買できます。",
    "Short-duration direction contracts with open positions and history.":"短期方向性契約、オープンポジションと履歴。",
    "Loading markets":"市場を読み込み中",
  },
  "zh-CN": {
    "BTCBOX / OPEN MARKET":"BTCBOX / 公开市场",
    "Digital asset exchange":"数字资产交易平台",
    "Explore the market. Trade with confidence.":"洞察市场，安心开启交易。",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"查看数字资产实时行情、价格走势并了解 BTCBOX 交易服务。公开市场信息无需登录即可浏览。",
    "Public market access":"公开行情",
    "View market prices and historical movement before you sign in.":"登录前即可查看市场价格和历史走势。",
    "Account protection":"账户安全保护",
    "Personal assets and account actions require an authenticated session.":"个人资产和账户操作需要登录验证。",
    "Ready to access your account?":"准备好使用账户服务了吗？",
    "Create an account or sign in to manage your personal assets and account services.":"创建账户或登录，即可管理个人资产和账户服务。",
    "Spot markets":"现货市场","Live prices from the BTCBOX market service":"BTCBOX 行情服务实时价格","Loading…":"加载中…","pairs":"个交易对","Market feed unavailable":"行情数据暂不可用","Market data is temporarily unavailable. Please try again shortly.":"行情数据暂时不可用，请稍后重试。","No market pairs are currently available.":"当前暂无可用交易对。",
    "Asset":"币种","Last price":"最新价格","24h change":"24小时涨跌","24h volume":"24小时成交量","24h high":"24小时最高","24h low":"24小时最低",
    Home:"首页",Markets:"行情",Trade:"交易",Assets:"资产",My:"我的",Orders:"订单",Earn:"理财",Support:"客服",Settings:"设置",Manage:"管理",Search:"搜索",
    "Market overview":"市场总览","Live spot prices and 24-hour market movement.":"现货实时价格与 24 小时涨跌情况。",Connecting:"连接中","Feed unavailable":"行情暂不可用","Live market feed":"实时行情","Market analytics":"市场分析",
    "Historical chart integration is still in progress.":"历史图表接口仍在接入中。","Choose your trading mode":"选择交易模式","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"查看实时理财产品和持仓。只有后端资金控制功能启用后，才能申购或赎回。","Live product catalog":"实时产品目录","Sign in":"登录","Create account":"创建账户","My account":"我的账户","Sign in to continue":"登录后继续",
    "No account data loaded":"尚未加载账户数据",
    Spot:"现货",Seconds:"秒合约",Futures:"期货",Deposit:"充值",Withdraw:"提现",Verification:"身份认证",Open:"打开",Unavailable:"暂不可用",
    "BTCBOX / MARKETS":"BTCBOX / 行情","BTCBOX / TRADE":"BTCBOX / 交易","BTCBOX / WALLET":"BTCBOX / 钱包","BTCBOX / ACCOUNT":"BTCBOX / 账户","BTCBOX / WORKSPACE":"BTCBOX / 工作区",
    "API integration pending":"接口接入中","Open deposit":"前往充值","Open withdrawal":"前往提现","Explore Earn":"查看理财","Spot trading":"现货交易","Seconds trading":"秒合约交易",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"账户 API 接通后，将在此显示余额和交易记录。",
    
    "Manage your profile, verification, security and support.":"管理个人资料、身份认证、安全与客服。",
    "Close navigation":"关闭导航菜单",
    "Open navigation":"打开导航菜单",
    "Search BTCBOX":"搜索 BTCBOX",
    "Notifications unavailable":"通知暂不可用",
    "Notifications are not connected yet":"通知功能尚未接通",
    "Language":"语言",
    "Primary navigation":"主导航",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"交易界面正在接入 BTCBOX 现有订单与持仓服务。",
    "Mobile navigation":"移动端导航",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"以市价或限价买卖当前支持的数字资产。",
    "Short-duration direction contracts with open positions and history.":"短周期方向合约，包含持仓与历史记录。",
    "Loading markets":"正在加载行情",
  },
  es: {
    "BTCBOX / OPEN MARKET":"BTCBOX / MERCADO ABIERTO",
    "Digital asset exchange":"Exchange de activos digitales",
    "Explore the market. Trade with confidence.":"Explora el mercado. Opera con confianza.",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"Descubre mercados de activos digitales en vivo, consulta los movimientos de precios y explora los servicios de BTCBOX. La información pública está disponible sin iniciar sesión.",
    "Public market access":"Acceso al mercado público",
    "View market prices and historical movement before you sign in.":"Consulta precios y movimientos históricos antes de iniciar sesión.",
    "Account protection":"Protección de la cuenta",
    "Personal assets and account actions require an authenticated session.":"Los activos personales y las operaciones de cuenta requieren una sesión autenticada.",
    "Ready to access your account?":"¿Listo para acceder a tu cuenta?",
    "Create an account or sign in to manage your personal assets and account services.":"Crea una cuenta o inicia sesión para gestionar tus activos y servicios.",
    "Spot markets":"Mercados spot","Live prices from the BTCBOX market service":"Precios en vivo del servicio de mercado de BTCBOX","Loading…":"Cargando…","pairs":"pares","Market feed unavailable":"Datos de mercado no disponibles","Market data is temporarily unavailable. Please try again shortly.":"Los datos del mercado no están disponibles temporalmente. Inténtalo de nuevo en breve.","No market pairs are currently available.":"No hay pares de mercado disponibles.",
    "Asset":"Activo","Last price":"Último precio","24h change":"Cambio 24 h","24h volume":"Volumen 24 h","24h high":"Máximo 24 h","24h low":"Mínimo 24 h",
    Home:"Inicio",Markets:"Mercados",Trade:"Operar",Assets:"Activos",My:"Mi cuenta",Orders:"Órdenes",Earn:"Ganancias",Support:"Soporte",Settings:"Configuración",Manage:"Administrar",Search:"Buscar",
    "Market overview":"Resumen del mercado","Live spot prices and 24-hour market movement.":"Precios spot en tiempo real y variación de las últimas 24 horas.",Connecting:"Conectando","Feed unavailable":"Datos de mercado no disponibles","Live market feed":"Mercado en tiempo real","Market analytics":"Análisis del mercado",
    "Historical chart integration is still in progress.":"La integración del historial de gráficos sigue en curso.","Choose your trading mode":"Elige tu modalidad de trading","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"Consulta los productos Earn activos y tus posiciones. Las suscripciones y los reembolsos solo estarán disponibles cuando se habiliten los controles financieros del backend.","Live product catalog":"Catálogo de productos en tiempo real","Sign in":"Iniciar sesión","Create account":"Crear cuenta","My account":"Mi cuenta","Sign in to continue":"Inicia sesión para continuar",
    "No account data loaded":"No se han cargado datos de la cuenta",
    Spot:"Spot",Seconds:"Contratos por segundos",Futures:"Futuros",Deposit:"Depositar",Withdraw:"Retirar",Verification:"Verificación",Open:"Abrir",Unavailable:"No disponible",
    "BTCBOX / MARKETS":"BTCBOX / MERCADOS","BTCBOX / TRADE":"BTCBOX / TRADING","BTCBOX / WALLET":"BTCBOX / BILLETERA","BTCBOX / ACCOUNT":"BTCBOX / CUENTA","BTCBOX / WORKSPACE":"BTCBOX / ESPACIO DE TRABAJO",
    "API integration pending":"Integración de API pendiente","Open deposit":"Ir a depósitos","Open withdrawal":"Ir a retiros","Explore Earn":"Ver ganancias","Spot trading":"Trading spot","Seconds trading":"Trading por segundos",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"Tus saldos y movimientos aparecerán aquí cuando se conecte la API autenticada de la cuenta.",
    
    "Manage your profile, verification, security and support.":"Administra tu perfil, verificación, seguridad y asistencia.",
    "Close navigation":"Cerrar navegación",
    "Open navigation":"Abrir navegación",
    "Search BTCBOX":"Buscar en BTCBOX",
    "Notifications unavailable":"Notificaciones no disponibles",
    "Notifications are not connected yet":"Las notificaciones aún no están conectadas",
    "Language":"Idioma",
    "Primary navigation":"Navegación principal",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"Las interfaces de trading se están conectando a los servicios de órdenes y posiciones existentes de BTCBOX.",
    "Mobile navigation":"Navegación móvil",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"Compra y vende activos digitales compatibles a precio de mercado o limitado.",
    "Short-duration direction contracts with open positions and history.":"Contratos direccionales de corta duración con posiciones abiertas e historial.",
    "Loading markets":"Cargando mercados",
  },
  vi: {
    "BTCBOX / OPEN MARKET":"BTCBOX / THỊ TRƯỜNG MỞ",
    "Digital asset exchange":"Sàn giao dịch tài sản số",
    "Explore the market. Trade with confidence.":"Khám phá thị trường. Giao dịch tự tin.",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"Khám phá thị trường tài sản số trực tiếp, theo dõi biến động giá và các dịch vụ giao dịch BTCBOX. Thông tin thị trường công khai không cần đăng nhập.",
    "Public market access":"Truy cập thị trường công khai",
    "View market prices and historical movement before you sign in.":"Xem giá và biến động lịch sử trước khi đăng nhập.",
    "Account protection":"Bảo vệ tài khoản",
    "Personal assets and account actions require an authenticated session.":"Tài sản cá nhân và thao tác tài khoản yêu cầu phiên đăng nhập đã xác thực.",
    "Ready to access your account?":"Bạn đã sẵn sàng truy cập tài khoản?",
    "Create an account or sign in to manage your personal assets and account services.":"Tạo tài khoản hoặc đăng nhập để quản lý tài sản và dịch vụ cá nhân.",
    "Spot markets":"Thị trường giao ngay","Live prices from the BTCBOX market service":"Giá trực tiếp từ dịch vụ thị trường BTCBOX","Loading…":"Đang tải…","pairs":"cặp","Market feed unavailable":"Dữ liệu thị trường không khả dụng","Market data is temporarily unavailable. Please try again shortly.":"Dữ liệu thị trường tạm thời không khả dụng. Vui lòng thử lại sau.","No market pairs are currently available.":"Hiện không có cặp thị trường nào khả dụng.",
    "Asset":"Tài sản","Last price":"Giá gần nhất","24h change":"Thay đổi 24 giờ","24h volume":"Khối lượng 24 giờ","24h high":"Cao nhất 24 giờ","24h low":"Thấp nhất 24 giờ",
    Home:"Trang chủ",Markets:"Thị trường",Trade:"Giao dịch",Assets:"Tài sản",My:"Tài khoản",Orders:"Lệnh",Earn:"Kiếm lợi nhuận",Support:"Hỗ trợ",Settings:"Cài đặt",Manage:"Quản lý",Search:"Tìm kiếm",
    "Market overview":"Tổng quan thị trường","Live spot prices and 24-hour market movement.":"Giá giao ngay trực tiếp và biến động trong 24 giờ.",Connecting:"Đang kết nối","Feed unavailable":"Không có dữ liệu thị trường","Live market feed":"Dữ liệu thị trường trực tiếp","Market analytics":"Phân tích thị trường",
    "Historical chart integration is still in progress.":"Đang hoàn thiện kết nối biểu đồ lịch sử.","Choose your trading mode":"Chọn phương thức giao dịch","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"Xem sản phẩm Earn trực tiếp và các vị thế của bạn. Chỉ có thể đăng ký và tất toán khi các kiểm soát tài chính ở backend được bật.","Live product catalog":"Danh mục sản phẩm trực tiếp","Sign in":"Đăng nhập","Create account":"Tạo tài khoản","My account":"Tài khoản của tôi","Sign in to continue":"Đăng nhập để tiếp tục",
    "No account data loaded":"Chưa tải dữ liệu tài khoản",
    Spot:"Giao ngay",Seconds:"Hợp đồng giây",Futures:"Hợp đồng tương lai",Deposit:"Nạp tiền",Withdraw:"Rút tiền",Verification:"Xác minh",Open:"Mở",Unavailable:"Chưa khả dụng",
    "BTCBOX / MARKETS":"BTCBOX / THỊ TRƯỜNG","BTCBOX / TRADE":"BTCBOX / GIAO DỊCH","BTCBOX / WALLET":"BTCBOX / VÍ","BTCBOX / ACCOUNT":"BTCBOX / TÀI KHOẢN","BTCBOX / WORKSPACE":"BTCBOX / KHÔNG GIAN LÀM VIỆC",
    "API integration pending":"Đang chờ tích hợp API","Open deposit":"Mở nạp tiền","Open withdrawal":"Mở rút tiền","Explore Earn":"Xem sản phẩm lợi nhuận","Spot trading":"Giao dịch giao ngay","Seconds trading":"Giao dịch hợp đồng giây",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"Số dư và lịch sử giao dịch sẽ hiển thị sau khi kết nối API tài khoản đã xác thực.",
    
    "Manage your profile, verification, security and support.":"Quản lý hồ sơ, xác minh, bảo mật và hỗ trợ.",
    "Close navigation":"Đóng điều hướng",
    "Open navigation":"Mở điều hướng",
    "Search BTCBOX":"Tìm kiếm BTCBOX",
    "Notifications unavailable":"Thông báo chưa khả dụng",
    "Notifications are not connected yet":"Thông báo chưa được kết nối",
    "Language":"Ngôn ngữ",
    "Primary navigation":"Điều hướng chính",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"Giao diện giao dịch đang được kết nối với các dịch vụ lệnh và vị thế hiện có của BTCBOX.",
    "Mobile navigation":"Điều hướng di động",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"Mua và bán tài sản số được hỗ trợ theo giá thị trường hoặc giá giới hạn.",
    "Short-duration direction contracts with open positions and history.":"Hợp đồng dự đoán xu hướng ngắn hạn với vị thế đang mở và lịch sử.",
    "Loading markets":"Đang tải thị trường",
  },
  it: {
    "BTCBOX / OPEN MARKET":"BTCBOX / MERCATO APERTO",
    "Digital asset exchange":"Exchange di asset digitali",
    "Explore the market. Trade with confidence.":"Esplora il mercato. Fai trading con fiducia.",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"Scopri i mercati di asset digitali in tempo reale, consulta i movimenti dei prezzi ed esplora i servizi BTCBOX. Le informazioni pubbliche sono disponibili senza accesso.",
    "Public market access":"Accesso al mercato pubblico",
    "View market prices and historical movement before you sign in.":"Consulta prezzi e andamento storico prima di accedere.",
    "Account protection":"Protezione dell’account",
    "Personal assets and account actions require an authenticated session.":"Gli asset personali e le operazioni dell’account richiedono una sessione autenticata.",
    "Ready to access your account?":"Vuoi accedere al tuo account?",
    "Create an account or sign in to manage your personal assets and account services.":"Crea un account o accedi per gestire asset personali e servizi.",
    "Spot markets":"Mercati spot","Live prices from the BTCBOX market service":"Prezzi in tempo reale dal servizio di mercato BTCBOX","Loading…":"Caricamento…","pairs":"coppie","Market feed unavailable":"Dati di mercato non disponibili","Market data is temporarily unavailable. Please try again shortly.":"I dati di mercato non sono temporaneamente disponibili. Riprova tra poco.","No market pairs are currently available.":"Nessuna coppia di mercato è attualmente disponibile.",
    "Asset":"Asset","Last price":"Ultimo prezzo","24h change":"Variazione 24 h","24h volume":"Volume 24 h","24h high":"Massimo 24 h","24h low":"Minimo 24 h",
    Home:"Home",Markets:"Mercati",Trade:"Trading",Assets:"Asset",My:"Account",Orders:"Ordini",Earn:"Rendimenti",Support:"Assistenza",Settings:"Impostazioni",Manage:"Gestione",Search:"Cerca",
    "Market overview":"Panoramica del mercato","Live spot prices and 24-hour market movement.":"Prezzi spot in tempo reale e variazioni delle ultime 24 ore.",Connecting:"Connessione in corso","Feed unavailable":"Dati di mercato non disponibili","Live market feed":"Mercato in tempo reale","Market analytics":"Analisi del mercato",
    "Historical chart integration is still in progress.":"L'integrazione dei grafici storici è in corso.","Choose your trading mode":"Scegli la modalità di trading","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"Consulta i prodotti Earn attivi e le tue posizioni. Sottoscrizioni e riscatti saranno disponibili solo quando saranno abilitati i controlli finanziari del backend.","Live product catalog":"Catalogo prodotti in tempo reale","Sign in":"Accedi","Create account":"Crea account","My account":"Il mio account","Sign in to continue":"Accedi per continuare",
    "No account data loaded":"Nessun dato account caricato",
    Spot:"Spot",Seconds:"Contratti a secondi",Futures:"Futures",Deposit:"Deposita",Withdraw:"Preleva",Verification:"Verifica",Open:"Apri",Unavailable:"Non disponibile",
    "BTCBOX / MARKETS":"BTCBOX / MERCATI","BTCBOX / TRADE":"BTCBOX / TRADING","BTCBOX / WALLET":"BTCBOX / PORTAFOGLIO","BTCBOX / ACCOUNT":"BTCBOX / ACCOUNT","BTCBOX / WORKSPACE":"BTCBOX / AREA DI LAVORO",
    "API integration pending":"Integrazione API in attesa","Open deposit":"Vai ai depositi","Open withdrawal":"Vai ai prelievi","Explore Earn":"Scopri i rendimenti","Spot trading":"Trading spot","Seconds trading":"Trading a secondi",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"I saldi e le attività appariranno qui dopo il collegamento dell'API autenticata dell'account.",
    
    "Manage your profile, verification, security and support.":"Gestisci profilo, verifica, sicurezza e assistenza.",
    "Close navigation":"Chiudi navigazione",
    "Open navigation":"Apri navigazione",
    "Search BTCBOX":"Cerca in BTCBOX",
    "Notifications unavailable":"Notifiche non disponibili",
    "Notifications are not connected yet":"Le notifiche non sono ancora collegate",
    "Language":"Lingua",
    "Primary navigation":"Navigazione principale",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"Le interfacce di trading sono in fase di collegamento ai servizi ordini e posizioni esistenti di BTCBOX.",
    "Mobile navigation":"Navigazione mobile",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"Acquista e vendi asset digitali supportati a prezzo di mercato o limite.",
    "Short-duration direction contracts with open positions and history.":"Contratti direzionali di breve durata con posizioni aperte e storico.",
    "Loading markets":"Caricamento dei mercati",
  },
  pt: {
    "BTCBOX / OPEN MARKET":"BTCBOX / MERCADO ABERTO",
    "Digital asset exchange":"Exchange de ativos digitais",
    "Explore the market. Trade with confidence.":"Explore o mercado. Negocie com confiança.",
    "Discover live digital asset markets, review price movements and explore BTCBOX trading services. Public market information is available without signing in.":"Descubra mercados de ativos digitais em tempo real, acompanhe os movimentos de preços e conheça os serviços BTCBOX. As informações públicas estão disponíveis sem login.",
    "Public market access":"Acesso ao mercado público",
    "View market prices and historical movement before you sign in.":"Consulte preços e movimentos históricos antes de entrar.",
    "Account protection":"Proteção da conta",
    "Personal assets and account actions require an authenticated session.":"Ativos pessoais e ações da conta exigem uma sessão autenticada.",
    "Ready to access your account?":"Pronto para acessar sua conta?",
    "Create an account or sign in to manage your personal assets and account services.":"Crie uma conta ou entre para gerenciar seus ativos e serviços pessoais.",
    "Spot markets":"Mercados spot","Live prices from the BTCBOX market service":"Preços ao vivo do serviço de mercado BTCBOX","Loading…":"Carregando…","pairs":"pares","Market feed unavailable":"Dados de mercado indisponíveis","Market data is temporarily unavailable. Please try again shortly.":"Os dados do mercado estão temporariamente indisponíveis. Tente novamente em breve.","No market pairs are currently available.":"Não há pares de mercado disponíveis no momento.",
    "Asset":"Ativo","Last price":"Último preço","24h change":"Variação 24 h","24h volume":"Volume 24 h","24h high":"Máxima 24 h","24h low":"Mínima 24 h",
    Home:"Início",Markets:"Mercados",Trade:"Negociar",Assets:"Ativos",My:"Minha conta",Orders:"Ordens",Earn:"Rendimentos",Support:"Suporte",Settings:"Configurações",Manage:"Gerenciar",Search:"Pesquisar",
    "Market overview":"Visão geral do mercado","Live spot prices and 24-hour market movement.":"Preços spot em tempo real e variação nas últimas 24 horas.",Connecting:"Conectando","Feed unavailable":"Dados de mercado indisponíveis","Live market feed":"Mercado em tempo real","Market analytics":"Análise de mercado",
    "Historical chart integration is still in progress.":"A integração do histórico de gráficos está em andamento.","Choose your trading mode":"Escolha seu modo de negociação","Review live Earn products and your positions. Subscribe and redeem are available only when backend financial controls are enabled.":"Consulte os produtos Earn ativos e suas posições. Inscrições e resgates só estarão disponíveis quando os controles financeiros do backend forem habilitados.","Live product catalog":"Catálogo de produtos em tempo real","Sign in":"Entrar","Create account":"Criar conta","My account":"Minha conta","Sign in to continue":"Entre para continuar",
    "No account data loaded":"Nenhum dado da conta carregado",
    Spot:"Spot",Seconds:"Contratos por segundos",Futures:"Futuros",Deposit:"Depositar",Withdraw:"Sacar",Verification:"Verificação",Open:"Abrir",Unavailable:"Indisponível",
    "BTCBOX / MARKETS":"BTCBOX / MERCADOS","BTCBOX / TRADE":"BTCBOX / NEGOCIAÇÃO","BTCBOX / WALLET":"BTCBOX / CARTEIRA","BTCBOX / ACCOUNT":"BTCBOX / CONTA","BTCBOX / WORKSPACE":"BTCBOX / ESPAÇO DE TRABALHO",
    "API integration pending":"Integração da API pendente","Open deposit":"Ir para depósitos","Open withdrawal":"Ir para saques","Explore Earn":"Ver rendimentos","Spot trading":"Negociação spot","Seconds trading":"Negociação por segundos",
    "Your balances and transaction activity will appear here after the authenticated account API is connected.":"Seus saldos e atividades aparecerão aqui após a conexão da API autenticada da conta.",
    
    "Manage your profile, verification, security and support.":"Gerencie seu perfil, verificação, segurança e suporte.",
    "Close navigation":"Fechar navegação",
    "Open navigation":"Abrir navegação",
    "Search BTCBOX":"Pesquisar no BTCBOX",
    "Notifications unavailable":"Notificações indisponíveis",
    "Notifications are not connected yet":"As notificações ainda não estão conectadas",
    "Language":"Idioma",
    "Primary navigation":"Navegação principal",
    
    "Trading interfaces are being connected to BTCBOX's existing order and position services.":"As interfaces de negociação estão sendo conectadas aos serviços existentes de ordens e posições da BTCBOX.",
    "Mobile navigation":"Navegação móvel",
    
    
    "Buy and sell supported digital assets at market or limit prices.":"Compre e venda ativos digitais compatíveis a preço de mercado ou limite.",
    "Short-duration direction contracts with open positions and history.":"Contratos direcionais de curta duração com posições abertas e histórico.",
    "Loading markets":"Carregando mercados",
  }
};

type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (value: string) => string };
const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("btcbox-language") : null;
    return saved === "en" || saved === "ja" || saved === "zh-CN" || saved === "es" || saved === "vi" || saved === "it" || saved === "pt" ? saved : "en";
  });
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    if (typeof window !== "undefined") window.localStorage.setItem("btcbox-language", next);
    document.documentElement.lang = next;
  };
  const value = useMemo(() => ({ language, setLanguage, t: (text: string) => dictionaries[language][text] || text }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider");
  return value;
}
