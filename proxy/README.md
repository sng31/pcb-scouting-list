# PCB Scouting List — Google Places proxy (Cloudflare Worker)

A tiny serverless proxy that holds your **Google Places API key** and brokers the Add screen's
place search/autofill calls. The app only ever calls this Worker's URL — the key is never bundled
into the app, never inlined into the build, never visible in the browser.

```
App ──POST {type:'autocomplete'|'details', ...}──►  Worker (holds key)  ──►  Google Places API
                                                            └─ returns Google's JSON, unchanged
```

The Worker returns Google's **raw** response, so the existing parsing in `AddItem.tsx`
(`descriptionFromPlace`, `typesToCategory`, …) keeps working unchanged.

## What you need

- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- A **fresh** Google Places API key (the old one was exposed — rotate it first; see spec §10)
- Node/npm (you already have it from the app) — `wrangler` runs via `npx`

## Deploy (~5 minutes)

From this `proxy/` folder:

```sh
# 1. Log in to Cloudflare (opens a browser)
npx wrangler login

# 2. Store your NEW Google key as an encrypted secret (NOT in any file)
npx wrangler secret put GOOGLE_PLACES_KEY
#   → paste your AIza... key when prompted

# 3. Deploy
npx wrangler deploy
```

`wrangler deploy` prints your Worker URL, e.g.
`https://pcb-scouting-places.<your-subdomain>.workers.dev`.

## Lock down CORS

Once your app is live on Pages, set its origin so only your app can call the proxy. Edit
`wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://pcb-scouting-list.pages.dev"
```

`http://localhost:5173` and any `*.pages.dev` origin are already allowed by default, so dev and
preview deploys work out of the box.

## Add the app-token guard (optional but recommended)

CORS only stops *browsers* on other origins — a bot hitting your Worker URL with `curl` can spoof
the `Origin` header. A shared token adds a second gate: the app sends an `X-App-Token` header and
the Worker rejects anything that doesn't match (`401`).

```sh
# Pick a random value and store it as a Worker secret:
npx wrangler secret put PROXY_APP_TOKEN
#   → paste a random string, e.g. the output of:  openssl rand -hex 24
npx wrangler deploy
```

Then give the app the same value as a **non-secret** var (next section).

**Honest caveat:** this is *friction, not a wall.* In a public PWA the token ships inside the
JavaScript bundle, so a determined person can read it from the network tab. Its job is to filter
out drive-by bots and scrapers, not to defeat a motivated attacker. The thing that actually caps
your exposure is the **Worker's free-tier daily cap** (see "Spend controls" below) — even if the
token leaks, the cap means nobody can push you into paid usage. If you skip `PROXY_APP_TOKEN`, the
guard is simply disabled and the Worker falls back to CORS-only.

## Wire it into the app

1. Add **non-secret** env vars to the app's `.env.local`:
   ```
   VITE_PROXY_URL=https://pcb-scouting-places.<your-subdomain>.workers.dev
   VITE_PROXY_TOKEN=<the same value you set as PROXY_APP_TOKEN>
   ```
   (Neither is a real secret — the URL is public, and the token is friction-only as noted above.
   Omit `VITE_PROXY_TOKEN` if you didn't set `PROXY_APP_TOKEN`.)
2. In `src/screens/AddItem.tsx`:
   - Delete `const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY`.
   - Point `fetchSuggestions` at the proxy:
     ```ts
     const res = await fetch(import.meta.env.VITE_PROXY_URL, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-App-Token': import.meta.env.VITE_PROXY_TOKEN,
       },
       body: JSON.stringify({ type: 'autocomplete', input: query }),
     })
     // …same data.suggestions parsing as before
     ```
   - Point `fetchPlaceDetails` at the proxy:
     ```ts
     const res = await fetch(import.meta.env.VITE_PROXY_URL, {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-App-Token': import.meta.env.VITE_PROXY_TOKEN,
       },
       body: JSON.stringify({ type: 'details', placeId }),
     })
     // …same p.displayName / p.location / etc. parsing as before
     ```
   - Remove the `X-Goog-Api-Key` / `X-Goog-FieldMask` headers and the hard-coded Google URLs
     (the Worker owns the field mask and location bias now).

## Spend controls (the real billing backstop)

The Worker enforces three layers in front of Google so a leak or bot can't run up a bill:

- **Per-IP rate limiting** (`RATE_LIMITER` binding, 40 req/10s) — rejects bursts with a 429 before
  any Google call. Configure in `wrangler.toml`; fails open if absent.
- **Response caching** (Cache API, no setup) — identical autocomplete/details lookups are served
  from cache (1h / 24h) instead of re-hitting Google.
- **Free-tier daily cap** (`CAP_KV` binding) — a per-type, per-UTC-day counter 429s once a call
  type hits its cap (autocomplete 300/day, details 30/day). The caps are sized to stay inside
  Google's monthly free tier, so the app never costs anything. Set it up once:
  ```sh
  npx wrangler kv namespace create CAP_KV
  # paste the printed id into the [[kv_namespaces]] block in wrangler.toml, then:
  npx wrangler deploy
  ```
  Verify it's counting (note `--remote` — kv commands default to local!):
  ```sh
  npx wrangler kv key list --namespace-id <your-id> --remote
  ```

**Why the cap lives in the Worker, not Google:** Google removed the ability to set a hard quota cap
for Places API (New) — the Cloud Console "Edit quota" control is greyed out — so the Worker-side cap
is what guarantees no surprise bill. Tune the caps (`DAILY_CAP`) in `src/index.js`.

Also in Google Cloud:
- Limit the key to the **Places API (New)** only (server-side keys use API/quota restrictions, not
  HTTP-referrer restrictions; a free Worker has no fixed egress IP to restrict).
- A **billing budget alert** is still worth setting, but note it only *notifies* — it does not cap
  spending. The Worker cap is the thing that actually stops it.

## Local test (optional)

```sh
npx wrangler dev   # runs the Worker locally; still calls the real Google API
# then POST a sample request (add -H 'X-App-Token: <token>' if you set PROXY_APP_TOKEN):
curl -s localhost:8787 -H 'Content-Type: application/json' \
  -d '{"type":"autocomplete","input":"wicked wheel"}'
```

A request with the guard enabled but no/wrong `X-App-Token` returns `401 {"error":"Unauthorized."}`.

## Request contract (if you ever swap proxies)

`POST` JSON, one of:

```jsonc
{ "type": "autocomplete", "input": "free text" }
{ "type": "details",      "placeId": "ChIJ..." }
```

Response: Google's raw Places JSON on success, or `{ "error": "..." }` with a 4xx/5xx status.
