// PCB Scouting List — Google Places proxy (Cloudflare Worker)
//
// Holds the Google Places API key server-side and brokers the two calls the
// Add screen makes, so the key is NEVER shipped in the app bundle.
//
//   App ──POST {type:'autocomplete'|'details', ...}──►  Worker (holds key)  ──►  Google Places API
//                                                              └─ returns Google's JSON, unchanged
//
// The Worker returns Google's raw response so the existing client-side parsing
// in AddItem.tsx (descriptionFromPlace, typesToCategory, …) keeps working — the
// only client change is the fetch URL and dropping the key header.
//
// Request body (one of):
//   { "type": "autocomplete", "input": "wicked wheel" }
//   { "type": "details", "placeId": "ChIJ..." }
//
// Secrets / vars (see README):
//   GOOGLE_PLACES_KEY  (secret, required) — `npx wrangler secret put GOOGLE_PLACES_KEY`
//   PROXY_APP_TOKEN    (secret, optional) — `npx wrangler secret put PROXY_APP_TOKEN`
//       A shared token the app sends in the `X-App-Token` header. When set, the
//       Worker rejects any request that doesn't present the matching value. This
//       is a *friction* layer, not a true secret: in a public PWA the token ships
//       in the bundle, so a determined person can read it. Its job is to stop
//       drive-by abuse of the Worker URL by bots/scrapers that just find the
//       endpoint. The real billing protection is the Google quota cap (see README).
//       If PROXY_APP_TOKEN is unset, the check is skipped (open, CORS-only).
//   ALLOWED_ORIGINS    (var, optional)    — comma-separated; defaults to localhost + *.pages.dev
//   RATE_LIMITER       (binding, optional) — Cloudflare Workers Rate Limiting binding.
//       When configured in wrangler.toml, each client IP is capped at a few dozen
//       requests per 10s window; excess requests get a 429 *before* any Google call.
//       This blocks scraping volume at the edge. If the binding is absent the check
//       is skipped, so the Worker still runs without it. (Free; see README.)
//   CAP_KV             (binding, optional) — KV namespace holding per-day, per-type
//       counters of Google-bound calls. Each call type 429s once it hits its daily
//       cap (see DAILY_CAP), sized to stay inside Google's monthly free tier so the
//       app never costs anything. This ceiling is yours, independent of Google's
//       quota limits. No-op (fail open) if absent. Create once:
//       `npx wrangler kv namespace create CAP_KV`, then paste the id into wrangler.toml.
//
// Caching: identical autocomplete/details lookups are served from the Cloudflare
// Cache API (no binding needed), so repeated requests for the same place don't
// generate new Google calls — cutting both cost and the blast radius of abuse.

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const DETAILS_BASE = 'https://places.googleapis.com/v1/places/';

// Field mask for Place Details — moved here from the client. Keep in sync with
// the fields AddItem.tsx reads.
const DETAILS_FIELD_MASK = [
  'displayName', 'formattedAddress', 'location', 'websiteUri',
  'types', 'primaryType', 'editorialSummary', 'generativeSummary',
  'googleMapsUri', 'priceLevel',
].join(',');

// Location bias toward the Panama City Beach area (mirrors the old client values).
const LOCATION_BIAS = {
  circle: { center: { latitude: 30.165, longitude: -85.8 }, radius: 50000 },
};

// How long to cache successful Google responses, in seconds. Autocomplete results
// drift more than place details, so it gets a shorter window. Both are well under
// Google's caching limits and dramatically cut repeat calls.
const CACHE_TTL = { autocomplete: 3600, details: 86400 }; // 1h / 24h

// Hard daily ceilings sized to keep this app permanently inside Google's free
// tier, so it never costs a cent. Google's free allotment is PER SKU, PER MONTH:
// Essentials 10,000 · Pro 5,000 · Enterprise 1,000 free events/month. We track a
// separate counter per call type and 429 once that type hits its daily cap (each
// = monthly free ÷ 31, rounded down for headroom). Cache hits do NOT count.
//   - autocomplete → SKU "Autocomplete Requests" (Essentials, 10k/mo) → 300/day
//   - details      → Place Details. This app's field mask includes premium fields
//     (generativeSummary, editorialSummary, priceLevel), so the call is billed at
//     the highest applicable tier (Enterprise, 1k/mo) → 30/day.
// To raise the details cap, drop those premium fields from DETAILS_FIELD_MASK so
// the call falls to a cheaper SKU (Pro 5k/mo, or Essentials 10k/mo).
const DAILY_CAP = { autocomplete: 300, details: 30 };

// ── CORS ────────────────────────────────────────────────────────────────
// Lock responses to the app's own origins. Add your real *.pages.dev URL once
// you know it (or set ALLOWED_ORIGINS in wrangler.toml / the dashboard).
const DEFAULT_ALLOWED = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function allowedOrigins(env) {
  const fromEnv = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...DEFAULT_ALLOWED, ...fromEnv];
}

// Cloudflare-hosted app origins:
//   *.pages.dev          → Pages (one label):           app.pages.dev
//   *.<sub>.workers.dev  → Workers static assets (two): app.sub.workers.dev
// The app is deployed as a Worker, so its origin is the workers.dev form. Both
// are allowed; the X-App-Token guard is the real gate on who can use the proxy.
const PAGES_ORIGIN = /^https:\/\/[a-z0-9-]+\.pages\.dev$/i;
const WORKERS_ORIGIN = /^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/i;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  const ok = list.includes(origin) || PAGES_ORIGIN.test(origin) || WORKERS_ORIGIN.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : list[0] || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
    'Vary': 'Origin',
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors },
  });
}

// ── App-token guard ───────────────────────────────────────────────────────
// Length-constant string compare so the check doesn't leak the token via timing.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Returns true if the request is allowed to proceed. If PROXY_APP_TOKEN is not
// configured, the guard is disabled (open) and we rely on CORS alone.
function tokenOk(request, env) {
  if (!env.PROXY_APP_TOKEN) return true;
  return safeEqual(request.headers.get('X-App-Token') || '', env.PROXY_APP_TOKEN);
}

// ── Rate limiting ───────────────────────────────────────────────────────────
// Uses the Cloudflare Workers Rate Limiting binding if configured. Keyed on the
// caller's IP so a single client can't flood the proxy (and thus Google). The
// binding is per-Cloudflare-location and eventually consistent — fine as an abuse
// backstop. If env.RATE_LIMITER is absent (binding not set up), this is a no-op.
async function rateLimited(request, env) {
  if (!env.RATE_LIMITER) return false;
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return !success;
  } catch {
    // Never let a rate-limiter hiccup take down the proxy — fail open.
    return false;
  }
}

// ── Response caching (Cache API) ──────────────────────────────────────────────
// We cache the raw Google JSON body keyed by a synthetic URL, NOT the full HTTP
// response, so per-origin CORS headers are never cached — callers always get CORS
// computed for their own origin. caches.default needs no binding or config.
function cacheRequest(keyStr) {
  return new Request('https://places-cache.internal/' + encodeURIComponent(keyStr));
}

async function getCached(keyStr) {
  const hit = await caches.default.match(cacheRequest(keyStr));
  if (!hit) return null;
  return hit.json().catch(() => null);
}

async function putCached(keyStr, data, ttl) {
  const res = new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${ttl}` },
  });
  // Awaiting keeps it simple; this is a fast same-location write.
  await caches.default.put(cacheRequest(keyStr), res);
}

// ── Self-controlled daily spend cap (KV) ──────────────────────────────────────
// A per-UTC-day counter in KV bounds total Google-bound calls regardless of who
// is calling, so abuse can't run up the bill even when Google won't let you set a
// quota cap. KV is eventually consistent, so the count is approximate — fine for a
// safety backstop. If the CAP_KV binding isn't configured, every function here is
// a no-op (fail open) so the Worker still runs before you finish KV setup.
function capKey(type) {
  // cap:<type>:YYYY-MM-DD (UTC) — a separate per-day counter for each call type.
  return 'cap:' + type + ':' + new Date().toISOString().slice(0, 10);
}

async function dailyCapReached(env, type) {
  if (!env.CAP_KV) return false;
  try {
    const n = parseInt(await env.CAP_KV.get(capKey(type)), 10) || 0;
    return n >= (DAILY_CAP[type] ?? Infinity);
  } catch {
    return false; // never block real users on a KV hiccup
  }
}

// Increment today's counter for this call type. Call only on a real (cache-miss)
// Google call. Auto-expires after 2 days so old day-counters clean themselves up.
async function bumpDailyCount(env, type) {
  if (!env.CAP_KV) return;
  try {
    const key = capKey(type);
    const n = (parseInt(await env.CAP_KV.get(key), 10) || 0) + 1;
    await env.CAP_KV.put(key, String(n), { expirationTtl: 172800 });
  } catch {
    // ignore — a failed counter write must never break a request
  }
}

export default {
  async fetch(request, env, ctx) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);
    // App-token guard (no-op if PROXY_APP_TOKEN is unset). Checked before we do
    // any work or touch the Google key.
    if (!tokenOk(request, env)) {
      return json({ error: 'Unauthorized.' }, 401, cors);
    }
    // Per-IP rate limit (no-op if RATE_LIMITER binding isn't configured). Checked
    // before any work or Google call so abusive volume is rejected cheaply.
    if (await rateLimited(request, env)) {
      return json({ error: 'Too many requests. Please slow down.' }, 429, cors);
    }
    if (!env.GOOGLE_PLACES_KEY) {
      return json({ error: 'Proxy missing GOOGLE_PLACES_KEY.' }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'Invalid JSON body.' }, 400, cors);
    }

    try {
      if (body.type === 'autocomplete') {
        if (!body.input || !String(body.input).trim()) {
          return json({ error: 'Missing input for autocomplete.' }, 400, cors);
        }
        // Normalize so "Wicked Wheel" and "wicked wheel " share a cache entry.
        const input = String(body.input).trim();
        const cacheId = 'ac:' + input.toLowerCase();
        const cached = await getCached(cacheId);
        if (cached) return json(cached, 200, cors);

        // Cache miss → a real Google call. Enforce the free-tier daily cap, then
        // count it. (Cache hits above are free and never blocked or counted.)
        if (await dailyCapReached(env, 'autocomplete')) {
          return json({ error: 'Daily free-tier limit reached. Please try again tomorrow.' }, 429, cors);
        }
        ctx.waitUntil(bumpDailyCount(env, 'autocomplete'));
        const upstream = await fetch(AUTOCOMPLETE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
          },
          body: JSON.stringify({
            input,
            locationBias: LOCATION_BIAS,
            includedRegionCodes: ['us'],
          }),
        });
        const data = await upstream.json().catch(() => ({}));
        if (upstream.ok) await putCached(cacheId, data, CACHE_TTL.autocomplete);
        return json(data, upstream.ok ? 200 : upstream.status, cors);
      }

      if (body.type === 'details') {
        if (!body.placeId) {
          return json({ error: 'Missing placeId for details.' }, 400, cors);
        }
        const placeId = String(body.placeId);
        const cacheId = 'dt:' + placeId;
        const cached = await getCached(cacheId);
        if (cached) return json(cached, 200, cors);

        // Cache miss → a real Google call. Enforce the free-tier daily cap, then
        // count it. (Cache hits above are free and never blocked or counted.)
        if (await dailyCapReached(env, 'details')) {
          return json({ error: 'Daily free-tier limit reached. Please try again tomorrow.' }, 429, cors);
        }
        ctx.waitUntil(bumpDailyCount(env, 'details'));
        // placeId is path data — encode it.
        const url = DETAILS_BASE + encodeURIComponent(placeId);
        const upstream = await fetch(url, {
          headers: {
            'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': DETAILS_FIELD_MASK,
          },
        });
        const data = await upstream.json().catch(() => ({}));
        if (upstream.ok) await putCached(cacheId, data, CACHE_TTL.details);
        return json(data, upstream.ok ? 200 : upstream.status, cors);
      }

      return json({ error: 'Unknown request type. Use "autocomplete" or "details".' }, 400, cors);
    } catch {
      return json({ error: 'Could not reach Google Places.' }, 502, cors);
    }
  },
};
