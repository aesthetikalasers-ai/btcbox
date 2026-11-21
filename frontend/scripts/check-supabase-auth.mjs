#!/usr/bin/env node
/**
 * Non-destructive Supabase Auth connectivity check.
 *
 * This only calls GET /auth/v1/settings. It never signs up, logs in, requests
 * an OTP, or sends an email, so it does not consume the project's email quota.
 */
const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const apiKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

function fail(message) {
  console.error(`[Supabase Auth] FAIL: ${message}`);
  process.exitCode = 1;
}

if (!rawUrl || !apiKey) {
  fail("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).");
} else {
  let baseUrl;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("Supabase URL must use HTTPS (except local development).");
    }
    baseUrl = parsed.origin;
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid SUPABASE_URL.");
  }

  if (baseUrl) {
    const endpoint = `${baseUrl}/auth/v1/settings`;
    const startedAt = Date.now();
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: { apikey: apiKey, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      const latency = Date.now() - startedAt;
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload || typeof payload !== "object") {
        fail(`Auth settings endpoint returned HTTP ${response.status}.`);
      } else {
        console.log(`[Supabase Auth] Connected (HTTP ${response.status}, ${latency} ms).`);
        console.log(`[Supabase Auth] New sign-ups: ${payload.disable_signup === true ? "disabled" : "not disabled"}.`);

        const emailEnabled = payload.external?.email;
        if (emailEnabled === false) {
          fail("Email provider is explicitly disabled in Supabase Auth.");
        } else if (emailEnabled === true) {
          console.log("[Supabase Auth] Email provider: enabled.");
        } else {
          console.log("[Supabase Auth] Email provider: not reported by this Auth settings response.");
        }

        if (payload.mailer_autoconfirm === true) {
          console.warn("[Supabase Auth] Email auto-confirm is enabled; signup may not send a confirmation email.");
        } else if (payload.mailer_autoconfirm === false) {
          console.log("[Supabase Auth] Email confirmation: required.");
        } else {
          console.log("[Supabase Auth] Email confirmation mode: not reported.");
        }

        console.log("[Supabase Auth] This check does not test SMTP delivery or send an email.");
        if (payload.disable_signup === true) {
          fail("Supabase has disabled new account sign-ups.");
        }
      }
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError"
        ? "connection timed out after 8 seconds"
        : error instanceof Error ? error.message : "network request failed";
      fail(reason);
    }
  }
}
