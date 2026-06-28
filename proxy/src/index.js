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

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const list = allowedOrigins(env);
  // Allow exact matches, plus any *.pages.dev preview/prod origin.
  const ok = list.includes(origin) || /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin);
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

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405, cors);
    // App-token guard (no-op if PROXY_APP_TOKEN is unset). Checked before we do
    // any work or touch the Google key.
    if (!tokenOk(request, env)) {
      return json({ error: 'Unauthorized.' }, 401, cors);
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
        const upstream = await fetch(AUTOCOMPLETE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
          },
          body: JSON.stringify({
            input: String(body.input),
            locationBias: LOCATION_BIAS,
            includedRegionCodes: ['us'],
          }),
        });
        const data = await upstream.json().catch(() => ({}));
        return json(data, upstream.ok ? 200 : upstream.status, cors);
      }

      if (body.type === 'details') {
        if (!body.placeId) {
          return json({ error: 'Missing placeId for details.' }, 400, cors);
        }
        // placeId is path data — encode it.
        const url = DETAILS_BASE + encodeURIComponent(String(body.placeId));
        const upstream = await fetch(url, {
          headers: {
            'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': DETAILS_FIELD_MASK,
          },
        });
        const data = await upstream.json().catch(() => ({}));
        return json(data, upstream.ok ? 200 : upstream.status, cors);
      }

      return json({ error: 'Unknown request type. Use "autocomplete" or "details".' }, 400, cors);
    } catch {
      return json({ error: 'Could not reach Google Places.' }, 502, cors);
    }
  },
};
