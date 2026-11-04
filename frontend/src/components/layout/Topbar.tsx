import { Search, Bell, User, Radio, Menu, Languages } from "lucide-react";
import { useI18n, type Language } from "../../lib/i18n";

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <header className="relative z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-brand-border bg-brand-bg/95 px-3 backdrop-blur-xl sm:px-4 md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        {onMenuClick && (
          <button aria-label="Open navigation" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="relative min-w-0 max-[480px]:hidden">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text-muted" />
          <input type="search" aria-label="Search BTCBOX" placeholder={t("Search")} className="h-11 w-[min(30vw,190px)] rounded-xl border border-brand-border bg-brand-surface px-3 pl-10 text-sm text-brand-text placeholder:text-brand-text-muted focus:border-brand-accent focus:outline-none md:w-[240px]" />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <div className="hidden items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-3 py-2 sm:flex">
          <Radio className="h-3.5 w-3.5 text-profit" />
          <span className="text-xs font-semibold text-brand-text">{t("Preview")}</span>
        </div>
        <label className="flex h-11 items-center gap-1.5 rounded-xl border border-brand-border bg-brand-surface px-2 text-brand-text-secondary sm:px-2.5">
          <Languages className="h-4 w-4 shrink-0" />
          <select aria-label="Language" value={language} onChange={(e) => setLanguage(e.target.value as Language)} className="w-[74px] bg-transparent text-xs font-semibold text-brand-text outline-none sm:w-[88px]">
            <option value="en">English</option><option value="ja">日本語</option><option value="zh-CN">简体中文</option><option value="es">Español</option><option value="vi">Tiếng Việt</option><option value="it">Italiano</option><option value="pt">Português</option>
          </select>
        </label>
        <button aria-label="Notifications" className="flex h-11 w-11 items-center justify-center rounded-xl text-brand-text-secondary transition-colors hover:bg-brand-surface hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <Bell className="h-[18px] w-[18px]" />
        </button>
        <button aria-label="Account" className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-border bg-brand-surface text-brand-text-secondary transition-colors hover:border-brand-accent/40 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent">
          <User className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
