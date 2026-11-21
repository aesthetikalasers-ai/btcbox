import { Link } from "react-router-dom";
import { Gift } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent } from "../../components/ui/card";
import { useI18n } from "../../lib/i18n";
import { PageFrame } from "./Pages";

/**
 * Launchpool is intentionally an honest unavailable state until a verified
 * campaign catalogue and participation API are connected. Never render
 * placeholder projects, invented APRs, pool totals, participants or positions.
 */
export function NewListingsPage() {
  const { t } = useI18n();

  return (
    <PageFrame title="New coin mining" tone="market" backTo="/markets">
      <Card className="border-brand-border bg-brand-surface">
        <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-surface-2 text-brand-text-muted">
            <Gift className="h-6 w-6" />
          </span>
          <h2 className="text-base font-semibold text-brand-text">
            {t("Launchpool is not currently available")}
          </h2>
          <p className="max-w-lg text-sm leading-6 text-brand-text-muted">
            {t("No verified launchpool campaigns are currently published. Staking pools, reward rates and campaign statistics will appear here only when confirmed campaign data is available.")}
          </p>
          <Button asChild size="sm" variant="outline" className="mt-1">
            <Link to="/earn">{t("View Earn products")}</Link>
          </Button>
        </CardContent>
      </Card>
    </PageFrame>
  );
}
