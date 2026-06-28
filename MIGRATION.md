# Migration off GitHub Pages → Cloudflare (Phase 0) — ✅ COMPLETE

Tracks the move that fixes the exposed Google key. Full rationale in the tech spec
(`PCB-Scouting-List-Tech-Spec.md` §0, §4, §10).

> **Done — June 2026.** App is live on `*.workers.dev`, place search works through the proxy, and
> the built bundle contains no `AIza…` key. See "Final architecture" at the bottom for how the
> result differs from the original plan.

## ✅ Already done (in code)

- [x] `AddItem.tsx` calls the Worker proxy (`VITE_PROXY_URL`); no key, no `X-Goog-Api-Key`, no direct Google URLs.
- [x] Leaked `AIza…` key removed from `.env.local`; replaced with non-secret `VITE_PROXY_URL`.
- [x] GitHub Pages workflow (`.github/`) deleted so it can't rebuild and leak the key again.
- [x] Worker proxy scaffolded in `proxy/` (`src/index.js`, `wrangler.toml`, `README.md`).
- [x] Tech spec + `CLAUDE.md` updated to the all-Cloudflare stack.

## ✅ Manual steps (all done)

### 1. Rotate the Google key
The old key `AIzaSy…Qc3A` was served publicly in the GitHub Pages bundle — treated as compromised.

- [x] Deleted/regenerated the old key in Google Cloud Console.
- [x] Created a **fresh** key (a "Maps Platform API Key" — the Places API is part of Maps Platform).
- [x] Restricted it: **Places API (New)** only; Application restriction = None (a free Worker has no fixed egress IP to pin).
- [x] Set a **quota cap** + a **billing budget alert**.
- [x] Confirmed the *old* key is dead.

### 2. Deploy the Worker proxy
From `proxy/`:

- [x] `npx wrangler login` (CSRF cookie error worked around with a `CLOUDFLARE_API_TOKEN`).
- [x] `npx wrangler secret put GOOGLE_PLACES_KEY` → the **NEW** key.
- [x] `npx wrangler secret put PROXY_APP_TOKEN` → random value; enables the `X-App-Token` guard.
- [x] `npx wrangler deploy` → live at `https://pcb-scouting-places.sng31.workers.dev`.
- [x] Set `VITE_PROXY_URL` + `VITE_PROXY_TOKEN` in `.env.local`.
- [x] Verified: curl with the token returns suggestions; without it returns `401`.

### 3. Deploy the app to Cloudflare (Workers static assets)
- [x] Cloudflare dashboard → **Workers & Pages** → **Create** → import the GitHub repo. *(The unified dashboard creates a **Worker**, not a Pages project — no separate Pages git flow exists for new accounts.)*
- [x] Added a root `wrangler.toml` (`[assets] directory=./dist`, `not_found_handling="single-page-application"`) so `npx wrangler deploy` serves the SPA.
- [x] Build command `npm run build`; deploy command `npx wrangler deploy`.
- [x] Added build vars `VITE_PROXY_URL` + `VITE_PROXY_TOKEN`.
- [x] Fixed `vite.config.ts` `base`/`start_url` from `/pcb-scouting-list/` → `/` (GitHub Pages subpath would have blank-screened on Cloudflare).
- [x] Removed `public/_redirects` (caused a Workers "infinite loop" error; SPA routing now via `wrangler.toml`) and stale `vercel.json` + `files.zip`.

### 4. CORS + token guard
- [x] Proxy CORS allows `*.pages.dev` **and** `*.<sub>.workers.dev` (the app is a Worker) + `ALLOWED_ORIGINS`.
- [x] `AddItem.tsx` sends the `X-App-Token` header on every proxy call.

> **What this does and doesn't protect.** A free Worker has no fixed egress IP, so the Google key
> can't be IP-restricted. CORS + the app-token guard cut nuisance traffic, but the token ships in the
> public bundle and is *friction, not a wall*. The hard backstop against a surprise bill is the
> **Google quota cap + budget alert** from Step 1.

### 5. Verify
- [x] Place search + autofill work in the deployed app (calls go to the Worker, not Google).
- [x] Built bundle contains **no** key (`grep -r "AIza" dist/` → clean).
- [ ] *(Phase 3)* Install the PWA to the home screen from the `*.workers.dev` URL; confirm offline launch.

### 6. (Optional) git history
The key was only ever in the gitignored `.env.local` + the built bundle, not in git source
(`git log -S AIza` is empty), so a history rewrite is unnecessary. Rotation in Step 1 is the real
protection.

---

## Final architecture (how the result differs from the original plan)

| Original plan | What was actually built |
|---|---|
| Cloudflare **Pages** (`*.pages.dev`) | Cloudflare **Workers static assets** (`*.workers.dev`) — the unified dashboard creates a Worker; root `wrangler.toml` serves `dist/` |
| Proxy protected by CORS only | CORS **+ `X-App-Token` app-token guard** (`PROXY_APP_TOKEN` secret) |
| `HashRouter` (GitHub Pages routing workaround) | `BrowserRouter` (clean URLs) + SW `navigateFallback` for offline deep links |
| `base: '/pcb-scouting-list/'` | `base: '/'` (root-hosted on Cloudflare) |

**Phase 0 complete.** Next: **Phase 1 — storage hardening** (`localStorage` → IndexedDB +
`navigator.storage.persist()` + Settings storage readout). Note Phase 2's feature breadth is already
built, so Phase 1 is the real next piece of work.
