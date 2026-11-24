# BTCBOX perpetual worker runtime

The perpetual workers are long-running production infrastructure, not Vercel request handlers.
Do not put these loops in `api/` routes or use a Vercel Cron schedule for sub-minute risk work.

## Container

Build from the repository root:

```sh
docker build -f backend/Dockerfile.perpetual-workers -t btcbox-perpetual-workers .
```

Run as a dedicated always-on container with restart policy `unless-stopped`
(or the hosting platform's equivalent `ALWAYS` policy):

```sh
docker run -d --name btcbox-perpetual-workers --restart unless-stopped \
  -e SUPABASE_URL='https://<project>.supabase.co' \
  -e SUPABASE_SERVICE_ROLE_KEY='<service-role-secret>' \
  btcbox-perpetual-workers
```

Supply secrets through the hosting provider's secret manager, not a checked-in
file, image build argument, or public environment. Restrict this container to
the production Supabase project and keep service-role credentials out of logs.

## Worker cadence

The supervisor starts each one-pass worker immediately and then schedules
non-overlapping passes:

| Worker | Interval | Responsibility |
|---|---:|---|
| Mark/index price | 60 seconds | 3-provider index, bootstrap or order-book mark |
| Funding-rate producer | 15 seconds | Versioned formula snapshot for the next boundary |
| Funding settlement | 5 seconds | Atomic due-boundary settlement |
| Liquidation | 1 second | Database-authoritative maintenance-margin checks |

The mark-price cadence is 60 seconds because the configured market freshness
window is 60 seconds. Each pass batches Binance 24-hour tickers, OKX spot
tickers, and CoinGecko multi-ID prices into one request per provider, then
processes enabled markets with bounded concurrency. Bootstrap marks require all
three distinct fresh providers; normal order-book marks still require at least
two fresh index providers. Review provider quotas and pass duration before
increasing market count or shortening the cadence. A stale feed blocks new risk
and pauses liquidation;
the worker never substitutes an old or fabricated price.

## Operational gates

1. Do not set `FINANCIAL_PERPETUAL_WORKERS_READY=1` until the container is
   deployed as an always-on service, its restart policy and log/alert routing
   are verified, and all four worker loops have completed successful passes.
2. Keep `FINANCIAL_PERPETUAL_ENGINE_ENABLED` off until market precision,
   collateral, order/fill/cancel/close, funding and liquidation lifecycle
   tests have passed in an isolated environment.
3. Configure the host to alert on container restart loops, worker non-zero
   exits, stale price feed, missed funding boundary, and non-zero bad debt.
4. Verify the worker process is alive and the latest mark snapshots are fresh
   before opening any market. A READY web deployment does not prove worker
   readiness.

This repository change only supplies the container and process supervisor.
It does not provision a hosting service, store production secrets, create
perpetual markets, enable trading, or apply a production migration.
