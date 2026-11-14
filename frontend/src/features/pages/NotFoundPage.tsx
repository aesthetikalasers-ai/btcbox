import { Link } from "react-router-dom";
import { Compass, ChartNoAxesCombined, House } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useI18n } from "../../lib/i18n";

export function NotFoundPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center p-4">
      <Card className="w-full max-w-md border-brand-border bg-brand-surface text-center shadow-xl">
        <CardContent className="flex flex-col items-center p-8">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-accent/20 bg-brand-accent/10 text-brand-accent">
            <Compass className="h-8 w-8 animate-pulse" />
          </div>
          <span className="font-mono text-4xl font-extrabold tracking-tight text-brand-text">404</span>
          <h1 className="mt-2 text-xl font-bold text-brand-text">{t("Page not found")}</h1>
          <p className="mt-2 text-sm leading-relaxed text-brand-text-muted">
            {t("The market, route or page you are looking for does not exist or has been moved.")}
          </p>

          <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
            <Button asChild className="flex-1" variant="default">
              <Link to="/home" className="inline-flex items-center justify-center gap-2">
                <House className="h-4 w-4" />
                {t("Home")}
              </Link>
            </Button>
            <Button asChild className="flex-1" variant="outline">
              <Link to="/markets" className="inline-flex items-center justify-center gap-2">
                <ChartNoAxesCombined className="h-4 w-4" />
                {t("Markets")}
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
