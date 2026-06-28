# Migration off GitHub Pages → Cloudflare (Phase 0)

Tracks the move that fixes the exposed Google key. Full rationale in the tech spec
(`PCB-Scouting-List-Tech-Spec.md` §0, §4, §10). **Do Step 1 first — today.**

## ✅ Already done (in code)

- [x] `AddItem.tsx` calls the Worker proxy (`VITE_PROXY_URL`); no key, no `X-Goog-Api-Key`, no direct Google URLs.
- [x] Leaked `AIza…` key removed from `.env.local`; replaced with non-secret `VITE_PROXY_URL`.
- [x] GitHub Pages workflow (`.github/`) deleted so it can't rebuild and leak the key again.
- [x] Worker proxy scaffolded in `proxy/` (`src/index.js`, `wrangler.toml`, `README.md`).
- [x] Tech spec + `CLAUDE.md` updated to the all-Cloudflare stack.

## ⏳ Remaining manual steps

### 1. Rotate the Google key (URGENT — do today)
The old key `AIzaSy…Qc3A` was served publicly in the GitHub Pages bundle. Treat it as compromised.

- [ ] [Google Cloud Console](https://console.cloud.google.com/apis/credentials) → **delete or regenerate** that key.
- [ ] Create a **fresh** key.
- [ ] Restrict it: **Places API (New)** only.
- [ ] Set a **quota cap** + a **billing budget alert** (so a leak/bug can never run up a bill).
- [ ] Confirm the *old* key is dead (a direct call with it should now fail).

### 2. Deploy the Worker proxy
From `proxy/`:

- [ ] `npx wrangler login`
- [ ] `npx wrangler secret put GOOGLE_PLACES_KEY` → paste the **NEW** key (never the old one).
- [ ] *(Recommended)* `npx wrangler secret put PROXY_APP_TOKEN` → paste a random value (`openssl rand -hex 24`). Adds the `X-App-Token` guard; skip it to run CORS-only.
- [ ] `npx wrangler deploy` → note the printed `https://pcb-scouting-places.<subdomain>.workers.dev` URL.
- [ ] Set `VITE_PROXY_URL` in `.env.local` to that URL, and `VITE_PROXY_TOKEN` to the token (if you set one).
- [ ] Test: `curl -s <worker-url> -H 'Content-Type: application/json' -H 'X-App-Token: <token>' -d '{"type":"autocomplete","input":"wicked wheel"}'` returns suggestions. (Without the header, the guard should return `401`.)

### 3. Deploy the app to Cloudflare Pages
- [ ] [Cloudflare dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → connect the GitHub repo.
- [ ] Build settings: framework **Vite**, build command `npm run build`, output dir `dist`.
- [ ] Add env vars `VITE_PROXY_URL` = your Worker URL (and `VITE_PROXY_TOKEN` = your token, if set) in the Pages project settings.
- [ ] Deploy → note the `https://<project>.pages.dev` URL.

### 4. Lock down CORS + token guard
- [ ] In `proxy/wrangler.toml`, set `ALLOWED_ORIGINS = "https://<project>.pages.dev"`.
- [ ] `npx wrangler deploy` again to apply.
  (localhost + any `*.pages.dev` origin already work by default.)
- [ ] Confirm `AddItem.tsx` sends the `X-App-Token` header (if you enabled `PROXY_APP_TOKEN`).

> **Note on what this does and doesn't protect.** A free Worker has no fixed egress IP, so the
> Google key can't be IP-restricted. CORS + the app-token guard cut nuisance traffic, but the
> token ships in the public bundle and is *friction, not a wall*. The hard backstop against a
> surprise bill is the **Google quota cap + budget alert** from Step 1 — keep that in place.

### 5. Verify
- [ ] In the deployed app, place search + autofill work (calls go to the Worker, not Google).
- [ ] Built bundle contains **no** key: `npm run build && grep -r "AIza" dist/ || echo "clean"`.
- [ ] Install the PWA to the home screen from the `*.pages.dev` URL; confirm it launches offline.

### 6. (Optional) git history
The key was only ever in the gitignored `.env.local` + the built bundle, not in git source
(`git log -S AIza` is empty), so a history rewrite is likely unnecessary. Rotation in Step 1 is
the real protection. If you want belt-and-suspenders, start a fresh private repo or use
`git filter-repo`.

---

When all boxes are checked, Phase 0 is complete → move on to **Phase 1 (storage hardening:
localStorage → IndexedDB)** in the tech spec.
