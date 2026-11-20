import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gift,
  Leaf,
  Lock,
  PieChart,
  Sparkles,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { TokenIcon } from "../../components/ui/TokenIcon";
import { useI18n } from "../../lib/i18n";
import { PageFrame } from "./Pages";

/**
 * Mining / Launchpool (新币挖矿).
 *
 * Modelled on the launchpool surfaces major exchanges publish (Binance
 * Launchpool, OKX Jumpstart) rather than on a spot-market table: the page is a
 * campaign board of staking pools for upcoming coins, with a rotating project
 * slot, pool statistics, live/upcoming project cards and the participation
 * rules. No spot price table lives here — trading belongs to /markets and /trade.
 *
 * Honesty rules kept from the previous version:
 *   1. No invented APR, TVL or reward figures. When operators have not opened a
 *      pool, cards render an explicit "upcoming / not open" state, not fake
 *      numbers.
 *   2. The rotating slot is always present, even with zero projects, so the
 *      layout never collapses.
 */

interface MiningPool {
  /** Stake asset the user locks, e.g. "USDT" or "BNB". */
  stake: string;
  /** Reward asset distributed, e.g. "NEW". */
  reward: string;
}

interface MiningProject {
  id: string;
  /** Project / token symbol shown as the headline. */
  symbol: string;
  name: string;
  status: "live" | "upcoming";
  pools: MiningPool[];
  /** Optional backend-supplied figures; rendered as "—" when absent. */
  apr?: number | null;
  totalStaked?: number | null;
  participants?: number | null;
  /** ISO timestamps for the campaign window, when known. */
  startsAt?: string | null;
  endsAt?: string | null;
  /** Progress 0-1 for the live campaign bar, when measurable. */
  progress?: number | null;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
// Placeholder pool definitions the page owns. Operators can replace this with a
// backend catalogue later; until then it drives the "upcoming" presentation.
const UPCOMING_PROJECTS: MiningProject[] = [
  { id: "usp-1", symbol: "NEW", name: "Upcoming Launchpad", status: "upcoming", pools: [{ stake: "USDT", reward: "NEW" }, { stake: "BNB", reward: "NEW" }], apr: null, totalStaked: null, participants: null, startsAt: null, endsAt: null, progress: null },
  { id: "usp-2", symbol: "SOON", name: "Coming Launchpool", status: "upcoming", pools: [{ stake: "USDT", reward: "SOON" }, { stake: "BTC", reward: "SOON" }], apr: null, totalStaked: null, participants: null, startsAt: null, endsAt: null, progress: null },
];
/* eslint-enable @typescript-eslint/no-unused-vars */

function fmtInt(value: number | null | undefined, locale: string): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function fmtApr(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function countdown(endsAt: string | null | undefined): string {
  if (!endsAt) return "—";
  const remaining = Date.parse(endsAt) - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0) return "—";
  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}

/** One project card: reward asset, stake pools, stats and the CTA. */
function ProjectCard({ project }: { project: MiningProject }) {
  const { t } = useI18n();
  const live = project.status === "live";
  return (
    <article className="group relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-all duration-300 hover:border-brand-accent/30 hover:shadow-[0_10px_30px_-14px_rgba(14,203,129,0.5)]">
      <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-brand-accent/10 blur-2xl" />
      <div className="relative flex items-start gap-3">
        <TokenIcon symbol={project.symbol} className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-brand-text">{project.symbol}</h3>
            <Badge
              variant="outline"
              className={live ? "border-brand-accent/30 bg-brand-accent/10 text-[10px] text-brand-accent" : "border-brand-warning/30 bg-brand-warning/10 text-[10px] text-brand-warning"}
            >
              {live ? t("Live") : t("Upcoming")}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-brand-text-muted">{t(project.name)}</p>
        </div>
      </div>

      <div className="relative mt-3 flex flex-wrap gap-1.5">
        {project.pools.map((pool) => (
          <span key={pool.stake + pool.reward} className="inline-flex items-center gap-1 rounded-md border border-brand-border bg-brand-surface-2 px-2 py-1 text-[10px] font-medium text-brand-text-secondary">
            <Lock className="h-3 w-3 text-brand-text-muted" strokeWidth={2} />
            {t("Stake")} {pool.stake}
            <ArrowRight className="h-2.5 w-2.5 text-brand-text-muted" />
            <span className="text-brand-text">{pool.reward}</span>
          </span>
        ))}
      </div>

      <dl className="relative mt-3 grid grid-cols-3 gap-2 border-t border-brand-border/60 pt-3 text-center">
        <div>
          <dt className="text-[10px] text-brand-text-muted">{t("Est. APR")}</dt>
          <dd className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-brand-accent">{fmtApr(project.apr)}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-brand-text-muted">{t("Total staked")}</dt>
          <dd className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-brand-text">{fmtInt(project.totalStaked, "en-US")}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-brand-text-muted">{t("Ends in")}</dt>
          <dd className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-brand-text">{countdown(project.endsAt)}</dd>
        </div>
      </dl>

      {live && project.progress !== null && project.progress !== undefined ? (
        <div className="relative mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-surface-2">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-accent to-brand-success" style={{ width: `${Math.min(100, Math.max(0, project.progress * 100))}%` }} />
          </div>
        </div>
      ) : null}

      <div className="relative mt-3">
        <Button size="sm" variant={live ? "default" : "secondary"} className="h-9 w-full font-semibold" disabled={!live}>
          {live ? t("Stake now") : t("Not open yet")}
        </Button>
      </div>
    </article>
  );
}

/**
 * Three-step participation explainer — the same pattern launchpool pages use.
 */
function HowItWorks() {
  const { t } = useI18n();
  const steps = [
    { icon: Wallet, title: t("1. Hold or deposit"), body: t("Fund your spot wallet with the stake asset for the pool you want to join.") },
    { icon: Lock, title: t("2. Stake for the pool"), body: t("Lock the stake asset while the campaign runs. It stays yours and earns rewards.") },
    { icon: Gift, title: t("3. Earn rewards"), body: t("Rewards accrue by the hour and are distributed when the project's pool closes.") },
  ];
  return (
    <section aria-label={t("How mining works")} className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
      <div className="border-b border-brand-border px-4 py-2.5">
        <h2 className="type-section-title font-bold">{t("How mining works")}</h2>
      </div>
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border border-brand-border/60 bg-brand-surface-2/40 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
              <step.icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-brand-text">{step.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-brand-text-muted">{step.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NewListingsPage() {
  const { t } = useI18n();

  // Live projects would come from the backend catalogue. Until operators open a
  // pool, the board shows the upcoming placeholders so the campaign layout and
  // the rotating slot are always visible.
  const [projects] = useState<MiningProject[]>([]);
  const liveProjects = projects.filter((p) => p.status === "live");
  const upcomingProjects = projects.filter((p) => p.status === "upcoming");
  const displayProjects = liveProjects.length > 0 || upcomingProjects.length > 0 ? [...liveProjects, ...upcomingProjects] : UPCOMING_PROJECTS;

  // Rotating hero slot. Slides are the available projects; when there are none
  // the slot keeps two styled placeholder slides so the carousel is never blank.
  const heroSlides: Array<{ key: string; project?: MiningProject }> = displayProjects.length > 0
    ? displayProjects.map((p) => ({ key: p.id, project: p }))
    : [{ key: "slot-1" }, { key: "slot-2" }];
  const [slide, setSlide] = useState(0);
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => setSlide((s) => (s + 1) % heroSlides.length), 5000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);
  const activeHero = heroSlides[Math.min(slide, heroSlides.length - 1)];
  const go = (dir: -1 | 1) => setSlide((s) => (s + dir + heroSlides.length) % heroSlides.length);

  // Aggregate statistics. Summed from real project figures only; a page with no
  // figures reads "—" rather than an invented total.
  const stats = (() => {
    const tvl = liveProjects.reduce((sum, p) => sum + (Number.isFinite(p.totalStaked ?? NaN) ? (p.totalStaked as number) : 0), 0);
    const people = liveProjects.reduce((sum, p) => sum + (Number.isFinite(p.participants ?? NaN) ? (p.participants as number) : 0), 0);
    const hasTvl = liveProjects.some((p) => Number.isFinite(p.totalStaked ?? NaN));
    const hasPeople = liveProjects.some((p) => Number.isFinite(p.participants ?? NaN));
    return { tvl: hasTvl ? tvl : null, people: hasPeople ? people : null, running: liveProjects.length, upcoming: upcomingProjects.length };
  })();




  return (
    <PageFrame title="New coin mining" tone="market" backTo="/me">
      <p className="max-w-2xl text-sm leading-relaxed text-brand-text-muted">
        {t("Stake idle assets for upcoming coins and share the launchpool rewards.")}
      </p>

      {/* Rotating hero slot: campaign card, or a styled placeholder when no pool
          is open yet. The position is always rendered so it never collapses. */}
      <section aria-label={t("Featured mining project")} className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-brand-accent/15 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-8 -bottom-10 h-32 w-32 rounded-full bg-brand-warning/10 blur-3xl" />
        <div className="relative flex min-h-[150px] flex-col justify-center gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          {activeHero.project ? (
            <div className="flex min-w-0 items-center gap-3.5">
              <TokenIcon symbol={activeHero.project.symbol} className="h-14 w-14 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-lg font-bold text-brand-text">{activeHero.project.symbol}</span>
                  <Badge variant="outline" className="shrink-0 border-brand-warning/30 bg-brand-warning/10 text-[10px] text-brand-warning">{t("Upcoming")}</Badge>
                </div>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-brand-text-muted">{t("Stake to share this project's launchpool allocation.")}</p>
              </div>
            </div>
          ) : (
            <div className="flex min-w-0 items-start gap-3.5">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-warning/12 text-brand-warning shadow-[inset_0_1px_0_0_rgba(255,255,255,0.16)]">
                <Coins className="h-7 w-7" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-brand-text">{t("No pool open yet")}</span>
                  <Badge variant="outline" className="shrink-0 border-brand-warning/30 bg-brand-warning/10 text-[10px] text-brand-warning">{t("Standby")}</Badge>
                </div>
                <p className="mt-1 max-w-md text-xs leading-relaxed text-brand-text-muted">
                  {t("New mining pools open regularly. The next project will take this spotlight slot.")}
                </p>
              </div>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
            <Button asChild size="sm" variant="secondary" className="h-9 font-semibold">
              <Link to="/earn">{t("Explore earn")} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>

        {heroSlides.length > 1 ? (
          <div className="relative flex items-center justify-between border-t border-brand-border/60 px-3 py-2">
            <button type="button" aria-label={t("Previous")} onClick={() => go(-1)} className="flex h-7 w-7 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5" role="tablist" aria-label={t("Featured mining project")}>
              {heroSlides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  aria-label={`${t("Slide")} ${i + 1}`}
                  onClick={() => setSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i === slide ? "w-5 bg-brand-accent" : "w-1.5 bg-brand-border-strong hover:bg-brand-text-muted"}`}
                />
              ))}
            </div>
            <button type="button" aria-label={t("Next")} onClick={() => go(1)} className="flex h-7 w-7 items-center justify-center rounded-md text-brand-text-muted transition-colors hover:bg-brand-surface-hover hover:text-brand-text">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </section>


      {/* Pool statistics overview. */}
      <section aria-label={t("Mining overview")} className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { icon: PieChart, label: t("Total staked"), value: stats.tvl === null ? "—" : fmtInt(stats.tvl, "en-US") },
          { icon: Users, label: t("Participants"), value: stats.people === null ? "—" : fmtInt(stats.people, "en-US") },
          { icon: Sparkles, label: t("Live pools"), value: String(stats.running) },
          { icon: Timer, label: t("Upcoming"), value: String(stats.upcoming) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-brand-border bg-brand-surface p-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
              <stat.icon className="h-4 w-4" strokeWidth={1.9} />
            </span>
            <p className="mt-2 font-mono text-base font-bold tabular-nums text-brand-text">{stat.value}</p>
            <p className="mt-0.5 text-[11px] text-brand-text-muted">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Project board. */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border/40 pb-2">
          <h2 className="type-section-title font-bold">{t("Mining projects")}</h2>
          <span className="text-xs text-brand-text-muted">{displayProjects.length} {t("projects")}</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {displayProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </section>

      <HowItWorks />

      {/* My mining positions — empty until a pool is joined. */}
      <section aria-label={t("My mining positions")} className="overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
        <div className="flex items-center justify-between border-b border-brand-border px-4 py-2.5">
          <h2 className="type-section-title font-bold">{t("My mining positions")}</h2>
          <Leaf className="h-4 w-4 text-brand-text-muted" />
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-brand-text-secondary">{t("You have no active mining positions.")}</p>
          <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-brand-text-muted">
            {t("Once you stake in a live pool, your positions and accrued rewards appear here.")}
          </p>
        </div>
      </section>
    </PageFrame>
  );
}

