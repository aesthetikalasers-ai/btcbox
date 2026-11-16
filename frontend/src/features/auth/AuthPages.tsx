import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChartNoAxesCombined, Globe2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { BrandLogo } from "../../components/BrandLogo";
import { useAuth } from "../../lib/auth";
import { useI18n, type Language } from "../../lib/i18n";
import { useAuthDialog } from "../../lib/auth-dialog";
import { AuthFormPanel, type AuthMode } from "./AuthFormPanel";
import { AuthRestoreState } from "../../components/AuthRestoreState";

/**
 * Legacy `/login` and `/register` compatibility routes.
 *
 * These paths stay valid for bookmarks and external links, but they no longer
 * render a separate authentication implementation: they reuse the shared
 * `AuthFormPanel` that the modal also uses, so Email, Google and Wallet behave
 * identically everywhere.
 */
export function AuthPage({ mode }: { mode: AuthMode; redirectTo?: string }) {
  const { t, language, setLanguage, canChangeLanguage } = useI18n();
  const { status } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const navigate = useNavigate();
  const [currentMode, setCurrentMode] = useState<AuthMode>(mode);
  const registering = currentMode === "register";

  useEffect(() => { setCurrentMode(mode); }, [mode]);

  if (status === "loading") return <AuthRestoreState />;

  return <main data-testid="auth-mobile-shell" className="tone-support relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] items-center justify-center px-3 py-4 sm:px-3 sm:py-5">
    <div className="grid w-full items-center gap-4">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-5 flex items-center justify-between">
          <Link to="/home" aria-label={t("BTCBOX home")}><BrandLogo variant="white" size="sm" /></Link>
          <Link to="/markets" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-accent/25 bg-brand-accent/[0.07] px-3 text-xs font-semibold text-brand-accent transition-colors hover:border-brand-accent/45 hover:bg-brand-accent/[0.12] hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"><ChartNoAxesCombined className="h-3.5 w-3.5" />{t("Explore markets")} <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        <Card className="w-full overflow-hidden border-brand-accent/20 bg-brand-surface">
          <div className="h-1 bg-brand-accent"/>
          <CardHeader className="gap-3 border-b border-brand-border/70 bg-brand-surface px-5 pb-4 pt-6 sm:px-8 sm:pt-8">
            <div className="flex items-center gap-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-accent/25 bg-brand-accent/[0.12] text-brand-accent shadow-sm shadow-brand-accent/[0.08]">
                {registering ? <Globe2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </span>
              <span className="text-xs font-semibold uppercase tracking-[.16em] text-brand-text-muted">{registering ? t("Join BTCBOX") : t("Secure access")}</span>
              <label className="ml-auto flex h-9 items-center gap-1 rounded-lg border border-brand-border bg-brand-surface-2 px-2 text-brand-accent shadow-sm shadow-brand-accent/10">
                <Globe2 className="h-3.5 w-3.5"/>
                <select disabled={!canChangeLanguage} aria-label={t("Language")} value={language} onChange={event => setLanguage(event.target.value as Language)} className="min-w-[88px] cursor-pointer appearance-none bg-transparent text-xs font-semibold text-brand-text outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70 disabled:cursor-not-allowed disabled:opacity-60 [color-scheme:dark]">
                  <option className="bg-brand-surface text-brand-text" value="ja">🇯🇵 日本語</option>
                  <option className="bg-brand-surface text-brand-text" value="zh-CN">🇨🇳 中文</option>
                  <option className="bg-brand-surface text-brand-text" value="en">🇺🇸 English</option>
                  <option className="bg-brand-surface text-brand-text" value="es">🇪🇸 Español</option>
                  <option className="bg-brand-surface text-brand-text" value="de">🇩🇪 Deutsch</option>
                  <option className="bg-brand-surface text-brand-text" value="it">🇮🇹 Italiano</option>
                  <option className="bg-brand-surface text-brand-text" value="pt">🇵🇹 Português</option>
                </select>
              </label>
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {registering ? t("Create your BTCBOX account") : t("Welcome back")}
            </CardTitle>
            <CardDescription className="max-w-[380px] text-sm leading-6 text-brand-text-muted">
              {registering ? t("Create an account with email, Google or a wallet.") : t("Sign in with email, Google or a wallet to access your BTCBOX account.")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-6 sm:px-8 sm:pb-8">
            <AuthFormPanel
              mode={currentMode}
              onModeChange={(next) => { setCurrentMode(next); navigate(next === "register" ? "/register" : "/login", { replace: true }); }}
            />
            <div className="border-t border-brand-border/80 pt-3">
              <button type="button" onClick={() => openAuthDialog(currentMode)} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-brand-surface-2/70 px-4 text-sm font-medium text-brand-text-secondary shadow-sm transition-all hover:border-brand-accent/35 hover:bg-brand-surface-hover hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/70"><ArrowLeft className="h-4 w-4" /> {t("Back to BTCBOX")}</button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-brand-text-muted"><ShieldCheck className="h-3.5 w-3.5 shrink-0" /> {t("Protected account access · Public markets remain available without signing in")}</p>
      </div>
    </div>
  </main>;
}

export { AuthCallbackPage } from "./AuthCallbackPage";
