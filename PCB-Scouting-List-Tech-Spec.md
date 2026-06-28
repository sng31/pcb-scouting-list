# PCB Scouting List — Technical Specification

A personal, phone-friendly web app for settling into and exploring Panama City Beach, Panama City, and the surrounding Gulf coast. Track places and tasks, mark them *want to try → been there*, rate them, take notes (including standout dishes), and favorite the best of them. Local-first data, soft coastal aesthetic.

**Project type:** Personal-use PWA (not commercial)
**Build tool:** Claude Code (two-terminal workflow)
**Status:** Re-planning after a hosting/key-exposure snag — migrating off GitHub Pages to an all-Cloudflare stack before resuming feature work.

---

## 0. Why this spec was revised (read first)

The first deployment exposed a Google API key. The root cause is worth stating plainly because it shapes the whole architecture going forward:

- The app calls the **Google Places web service** directly from the browser (`AddItem.tsx` sends `X-Goog-Api-Key`). The key was supplied through Vite's `import.meta.env.VITE_GOOGLE_PLACES_KEY`, which **inlines the value into the built JavaScript bundle**. So the key shipped, in plain text, inside the public JS served by GitHub Pages — readable by anyone who opened the site.
- The GitHub Actions workflow fed the key from `secrets.VITE_GOOGLE_PLACES_KEY`. This did **not** protect it: a "secret" used by client-side code is baked into the bundle at build time and becomes public anyway. **GitHub secrets and key "encryption" cannot hide a key that the browser itself uses.**

Two correct fixes exist, and this spec adopts both where each applies:

1. **For a browser-only Maps key** (e.g. displaying a map): you cannot hide it, and you don't need to — you *restrict* it (HTTP-referrer + API restrictions + a usage cap) so a leaked copy is useless off your domain.
2. **For a server-side web service** (Places Autocomplete / Place Details, Geocoding — what this app actually uses): the key must never reach the browser. It lives in a **Cloudflare Worker proxy**, stored as an encrypted Wrangler secret. The app calls the Worker; the Worker calls Google. This is the same proven pattern already running in the Hunger Habit project.

Because the app's Google usage is the *web service* kind, the **Worker-proxy path is the primary fix**.

---

## 1. Goals & Principles

- **Phone-first.** Designed for a phone screen, installable to the home screen, works offline.
- **Free, no dedicated server.** Hosted on Cloudflare's free tier. No bills, no machine of mine acting as a server, no keeping a laptop running.
- **Usable on the go.** Deployed to a public HTTPS URL (a free `*.workers.dev` subdomain), not a local-network-only dev server.
- **Secrets stay secret.** No API key is ever shipped in client code. Keys live only in the Worker as encrypted secrets.
- **Local-first, durable data.** Data is instant and offline off the device, with JSON export/import as a guaranteed backup and an **optional** Cloudflare-backed cloud sync so a browser-cache clear or a second device doesn't lose or fragment data.
- **Low-friction logging.** Marking *been*, tapping a rating, jotting a note should each take one or two taps.
- **Calm coastal feel.** Soft sand-and-seafoam palette, rounded cards, gentle shadows. Pleasant to open daily.
- **Seeded, not empty.** Launches pre-filled with real area places so it's useful on day one.

---

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **React 18 + TypeScript** | Type-safe data model; great Claude Code support |
| Build/dev | **Vite** | Fast dev server + hot reload; trivial static build |
| Routing | **React Router** | Simple client-side routes |
| App state | **Zustand** | Tiny store driving the UI |
| Local persistence | **IndexedDB** (via `idb-keyval` or `zustand` persist with an IndexedDB adapter) | More durable and roomier than `localStorage`; survives more than `localStorage` does and is the right base for offline-first |
| Durable storage request | `navigator.storage.persist()` | Asks the browser to mark storage as persistent so it isn't silently evicted under pressure |
| Styling | **Tailwind CSS v4** + CSS-variable design tokens | Fast to build; palette centralized and themeable |
| Icons | **lucide-react** | Clean, consistent line icons |
| IDs | `crypto.randomUUID()` | Built-in, no dependency |
| PWA | **vite-plugin-pwa** | Manifest, service worker, offline cache, add-to-home-screen |
| **Hosting** | **Cloudflare Workers static assets** (free) | Free HTTPS + free `*.workers.dev` subdomain (required for PWA install); auto-deploy from GitHub via Workers Builds; root `wrangler.toml` serves `dist/` with SPA fallback. *(Was planned as Cloudflare Pages; the unified dashboard now creates a Worker instead — equivalent for a static SPA.)* |
| **API proxy** | **Cloudflare Worker** (free) | Holds the Google key server-side; the only component that ever sees it |
| **Optional cloud sync** | **Cloudflare D1** (SQL) or **Workers KV** (key-value) | Same account as hosting; free tier; lets data survive a cache clear and sync across devices when enabled |

No charts, no analytics libraries, no notifications — kept deliberately lean.

**Why all-Cloudflare (vs. Vercel/Netlify):** every layer above the static site — proxy, optional database, optional file storage — lives in one free account with one mental model (Wrangler, Workers, Pages). The Worker-proxy pattern and `wrangler secret put` workflow are already proven in the Hunger Habit project, so both apps share one platform and one set of habits. Cloudflare's free tier is generous (Pages: unlimited static requests; Workers: 100k requests/day; D1 and KV both have free allowances that dwarf personal use). **Nothing here requires a paid plan or a purchased domain** — the only thing that ever costs money on any host is an *optional* custom domain name, which this project does not need.

---

## 3. Architecture

```
                         Cloudflare (one free account)
                ┌───────────────────────────────────────────────┐
   Phone        │                                               │
 ┌────────┐     │   ┌──────────────┐        ┌────────────────┐   │      ┌──────────────────┐
 │  PWA   │──1──┼──►│ Pages        │        │ Worker (proxy) │──┼──3──►│ Google Places API │
 │ (React)│     │   │ static app + │        │ holds GOOGLE_  │   │      │ (web service)     │
 │        │◄─2──┼───│ service      │        │ PLACES_KEY as  │◄─┼──────└──────────────────┘
 │        │     │   │ worker       │        │ encrypted      │   │
 │        │──4──┼──────────────────────────►│ secret         │   │
 └────────┘     │   └──────────────┘        └────────────────┘   │
   │   ▲        │                            │ optional 5         │
   │   │ local-first (IndexedDB)             ▼                    │
   │   └────────┼──────────────────  ┌────────────────┐          │
   └────────────┼─ optional sync ───►│ D1 / KV (data) │          │
                │                     └────────────────┘          │
                └───────────────────────────────────────────────┘
```

1. Phone loads the static PWA from **Cloudflare (Workers static assets)** over HTTPS.
2. App shell is cached by the service worker → works offline.
3. When the user searches/adds a place, the app calls the **Worker**, which attaches the Google key (never in the browser) and calls Google Places.
4. The Worker returns only the fields the app needs.
5. *(Optional, when sync is enabled)* the app mirrors its data to **D1/KV** through a Worker route so it survives cache clears and syncs across devices.

The Google key exists in exactly one place: the Worker's encrypted secrets. It is never in source, never in the bundle, never on the phone.

---

## 4. API Proxy — Google Places via Cloudflare Worker

A small Worker (mirroring the Hunger Habit proxy) brokers the two Places calls the app makes today.

**Request contract (app → Worker):**

```jsonc
// Autocomplete suggestions while typing
{ "type": "autocomplete", "input": "wicked wheel", "lat": 30.18, "lng": -85.80 }

// Full details for a chosen place
{ "type": "details", "placeId": "ChIJ..." }
```

**Response:** only the normalized fields the Add screen fills in (name, address, location, mapUrl, website, a short editorial summary, etc.) — never the raw key or unneeded data.

**Worker responsibilities:**
- Hold `GOOGLE_PLACES_KEY` as a Wrangler secret: `npx wrangler secret put GOOGLE_PLACES_KEY`.
- Call the Places API (New) endpoints with `X-Goog-Api-Key` + a tight `X-Goog-FieldMask` (move the field mask from the client into the Worker).
- Restrict CORS to the app's own origin(s): `*.<sub>.workers.dev` (the app is a Worker) and `*.pages.dev`, plus `http://localhost:5173` for dev and anything in `ALLOWED_ORIGINS`. (Don't leave `Access-Control-Allow-Origin: *` in production.)
- **App-token guard:** require an `X-App-Token` header matching a `PROXY_APP_TOKEN` secret; reject mismatches with `401` before any work is done. (No-op if the secret is unset.)
- Optional: a tiny in-Worker rate-limit / daily counter as a backstop against runaway usage.

**Why a token guard at all (and its honest limits).** A standard free-tier Cloudflare Worker has no fixed egress IP, so the Google key *cannot* be IP-restricted — that option only exists on paid Dedicated Egress IPs. The next-best server-side control is to gate the Worker itself. Two layers do that:

1. **CORS Origin check** — already in the Worker. But CORS is enforced only by browsers; a non-browser client (curl, a bot) can spoof the `Origin` header, so this alone stops nothing determined.
2. **Shared app-token** — the app sends `X-App-Token`; the Worker checks it. This raises the bar past drive-by abuse of anyone who simply discovers the Worker URL.

Be clear-eyed about layer 2: in a public PWA the token ships in the bundle (it travels via the non-secret `VITE_PROXY_TOKEN`), so a determined person *can* read it. It is **friction, not a wall** — its value is filtering out bots and scrapers, not defeating a motivated attacker. The token is held as a Worker *secret* on the server side so it can be rotated freely without redeploying Google credentials.

**The real billing backstop is the Worker's free-tier daily cap** (implemented in `proxy/src/index.js`). Google **removed** the ability to set a hard quota cap for Places API (New) — the Cloud Console "Edit quota" control is greyed out — so the cap lives in the Worker instead. Three layers bound the worst case:

1. **Per-IP rate limiting** — Cloudflare Rate Limiting binding (`RATE_LIMITER`, 40 req/10s per IP) rejects bursts with a 429 before any Google call.
2. **Response caching** — Cache API serves identical autocomplete/details lookups (1h / 24h TTL) without re-hitting Google.
3. **Free-tier daily cap** — a KV-backed (`CAP_KV`) per-type, per-UTC-day counter 429s once a call type hits its cap (autocomplete 300/day, details 30/day). Caps are sized to stay inside Google's monthly free tier (per SKU: Essentials 10k / Pro 5k / Enterprise 1k). The Place Details field mask includes premium fields (`generativeSummary`, `editorialSummary`, `priceLevel`) so it's billed at the Enterprise tier → 30/day; dropping those fields would allow a higher cap. All three fail open if their binding is absent.

**Google Cloud Console hardening (defense in depth, even though the key is server-side):**
- Restrict the key to **only** the Places API (New).
- Set a **billing budget alert** — but note it only *notifies*; it does not cap spending. The Worker cap is what actually stops a runaway bill. (A hard quota cap is no longer settable for Places API New.)
- A server-side (proxied) key uses **API + quota restrictions** rather than HTTP-referrer restrictions (referrer locks are for browser keys).

**Client change:** `AddItem.tsx` stops importing `import.meta.env.VITE_GOOGLE_PLACES_KEY` and stops sending `X-Goog-Api-Key`. It calls the Worker URL instead, adding an `X-App-Token: ${import.meta.env.VITE_PROXY_TOKEN}` header on each request. The Worker URL and the app token are **not real secrets** — both can live in non-secret `VITE_PROXY_URL` / `VITE_PROXY_TOKEN` env vars (the token is a friction layer, not a credential; see the guard note above).

---

## 5. Data Model & Storage

### 5.1 Item model (unchanged)

A single unified `Item` type covers every category, which keeps Favorites, search, and filtering simple. Category-specific fields are optional.

```ts
type Category =
  | 'restaurant' | 'beach' | 'activity'
  | 'excursion' | 'market' | 'sunset' | 'task';
type Area = 'pcb' | 'panama-city' | 'surrounding' | 'excursion';
type Status = 'want' | 'been';        // tasks reuse this as todo/done

interface Item {
  id: string;
  name: string;
  category: Category;
  area: Area;
  status: Status;
  rating: 1 | 2 | 3 | 4 | 5 | null;   // null = unrated
  favorite: boolean;
  description?: string;                 // short app-provided blurb (seed); distinct from user notes
  notes: string;                       // the user's own notes — never pre-filled by seed
  tags: string[];                      // e.g. ['seafood', 'sunset', 'dog-friendly']

  // location (all optional)
  address?: string;
  mapUrl?: string;                     // Google/Apple Maps deep link
  website?: string;

  // restaurant-specific (optional)
  cuisine?: string;
  priceTier?: 1 | 2 | 3 | 4;           // $ to $$$$
  favoriteDishes?: string[];

  // metadata
  dateVisited?: string;                // ISO date
  createdAt: string;                   // ISO timestamp
  updatedAt: string;                   // ISO timestamp
}

interface AppData {
  version: number;                     // for future migrations
  items: Item[];
  seededAt?: string;                   // set after first-run seed load
  // sync metadata (only populated when cloud sync is enabled)
  deviceId?: string;                   // random per-device id
  lastSyncedAt?: string;               // ISO timestamp of last successful sync
}
```

**Seeding rule:** on launch, if the persisted store is empty (no `seededAt`), hydrate `items` from the bundled seed dataset and stamp `seededAt`. After that, the user's data is authoritative and the seed never overwrites it.

### 5.2 Storage strategy — local-first, durable, sync-ready

The old plan ("everything in `localStorage`") had two weaknesses the user flagged: a **browser cache clear can wipe it**, and it's **single-device**. The revised strategy keeps the speed and offline of local storage while closing both gaps.

**Tier 1 — Local-first (always on):**
- Persist to **IndexedDB**, not `localStorage`. IndexedDB is roomier and is the proper foundation for offline-first apps. The store still hydrates instantly and works with no signal.
- On first load, call `navigator.storage.persist()` to request **persistent** storage. Granted persistent storage is not evicted under storage pressure and is much harder to lose to a routine "clear cache." Surface the result in Settings ("Storage: Persistent ✓ / Best-effort").
- Encourage **installing to the home screen** — installed PWAs get stronger storage durability (especially on iOS, where an installed app's data is far less likely to be evicted than a tab's).

**Tier 2 — Export / Import JSON (always available, the guaranteed backup):**
- Manual **Export** → `pcb-scouting-list-backup.json`.
- **Import** → restore from a backup (replace-all behind a confirm; merge-by-id is a documented future option).
- Optional gentle reminder to export periodically until cloud sync is enabled.

**Tier 3 — Optional Cloudflare cloud sync (opt-in, designed in from the start):**
- A Settings toggle enables sync to **Cloudflare D1** (relational, the better long-term choice) or **Workers KV** (simplest key-value blob) through a Worker route.
- Purpose: survive a cache clear on the primary device and **sync across devices**.
- **Scalability note (a stated goal):** the data layer is written behind a small `SyncProvider` interface — `pull()`, `push()`, `merge()` — so the same abstraction can back future apps, and so swapping KV↔D1, or adding accounts later, doesn't mean a rewrite. The Hunger Habit app can adopt the identical provider.
- **Conflict handling (v1):** single user, so last-write-wins per item using `updatedAt`, with the JSON export as the safety net. A field-level merge is a future option.
- **Auth (v1):** since it's personal, the simplest acceptable gate is a single secret sync token stored as a Worker secret and entered once in Settings. Full user accounts (Cloudflare Access, or D1 + a login) are a documented later upgrade — the `SyncProvider` interface leaves room for it.

> Sync is **optional and off by default** to honor "no accounts, no bills" out of the box, while the architecture leaves the door open exactly as requested for "data later or in other apps."

---

## 6. Screens & Navigation

Bottom tab bar (app-like on a phone): **Home · Browse · Favorites · Settings**

1. **Home / Dashboard**
   - Soft coastal hero (wave motif, app name).
   - Quick stats: *# want to try*, *# been*, *# favorites*.
   - Category tiles (Restaurants, Beaches, Activities, Excursions, Markets, Sunset Spots) with counts → tap into Browse.
   - "Recently visited" strip.

2. **Browse (category list)**
   - Category switcher (segmented control or tabs) at top.
   - Search bar (matches name, notes, tags).
   - Filters: status (want/been/all), area, minimum rating, favorites-only.
   - Sort: name, rating, date added, date visited.
   - Cards show name, area chip, star rating, favorite star, status pill. Tap → detail.
   - Floating **+ Add** button (place search goes through the Worker proxy).

3. **Item Detail / Edit**
   - View + edit every field in place.
   - One-tap **status toggle** (want ↔ been; sets `dateVisited` on first "been").
   - **Star rating** tap row.
   - **Favorite** star toggle.
   - Notes textarea; tags chips (add/remove).
   - Restaurants: cuisine, price tier, **favorite dishes** list.
   - Map link button (opens `mapUrl`/address in Maps).
   - Delete (with confirm).

4. **Favorites**
   - Cross-category view of everything `favorite: true`, grouped by category, sorted by rating.

5. **Settings / Data**
   - **Storage status** — shows whether persistent storage was granted; button to re-request.
   - **Export data** → downloads `pcb-scouting-list-backup.json`.
   - **Import data** → upload a backup. **Replaces** all current data behind a confirmation dialog.
   - **Cloud sync (optional)** — toggle on/off, enter sync token, "Sync now", show `lastSyncedAt`.
   - **Proxy URL** — the Worker endpoint (non-secret), pre-filled for the deployed app.
   - Theme note / about.
   - **Reset to seed** (with confirm).

---

## 7. Core Features

- **Status tracking** — want-to-try vs. been (todo/done for tasks).
- **Ratings** — 1–5 stars, tap to set/clear.
- **Notes & favorite dishes** — free text + per-restaurant dish list.
- **Favorites** — cross-category flag + dedicated view.
- **Tags** — free-form, used in search and as filter chips.
- **Search / filter / sort** — within Browse.
- **Place search & autofill** — via the Cloudflare Worker proxy (no key in the browser).
- **Map links** — deep-link to Maps from any place.
- **Export / Import JSON** — the guaranteed backup mechanism.
- **Optional cloud sync** — survive cache clears + multi-device, opt-in.
- **Offline** — service worker caches the app shell; fully usable without signal.

---

## 8. Design — Soft Coastal Theme

Centralize as CSS variables (and mirror into the Tailwind theme).

| Token | Value | Use |
|---|---|---|
| `--sand` | `#FBF8F3` | App background |
| `--surface` | `#FFFFFF` | Cards |
| `--seafoam` | `#7FC2B8` | Primary / "been" |
| `--sky` | `#A8D5E2` | Secondary accents |
| `--coral` | `#F2A28C` | Primary action / highlights |
| `--sunshine` | `#F2D9A0` | Warm accent (favorite/stars) |
| `--ink` | `#2E4747` | Primary text (soft teal-charcoal, not pure black) |
| `--muted` | `#7A8C8C` | Secondary text |
| `--line` | `#ECE6DC` | Borders/dividers |

- **Shadows:** soft, diffuse, slightly teal-tinted (e.g. `0 8px 24px rgba(46,71,71,0.08)`).
- **Radius:** generous — 18px cards, pill-shaped buttons and chips.
- **Typography (locked):** **Fraunces** (soft serif) for headings + **Nunito Sans** for body — warmth without feeling theme-park.
- **Motifs:** subtle wave divider on the Home hero; star icons for ratings; a shell or sun glyph for favorites.
- **Motion:** gentle — fade/slide on card mount, a small bounce on favorite toggle.

---

## 9. Content Scope (for seeding)

Real places across these buckets, compiled into the seed dataset:

- **Restaurants** — PCB + Panama City; seafood, Gulf-view spots, breakfast/brunch, local favorites, casual + nicer options.
- **Beaches & beach access** — named PCB beaches, St. Andrews State Park, Shell Island, Camp Helen, etc.
- **Activities (PCB + Panama City + nearby)** — piers, state parks, nature/eco (Conservation Park, kayaking, dolphin tours), mini-golf/arcades, Pier Park, downtown Panama City arts district, etc.
- **Weekend excursions** — 30A & Seaside, Destin, Grayton Beach, Apalachicola, springs (Econfina, Vortex, Morrison), Florida Caverns, Wakulla, etc.
- **Markets** — St. Andrews Waterfront & downtown farmers markets, seafood markets, neighborhood markets.
- **Sunset Spots** — west-facing beaches, piers, rooftop bars, boardwalks, sunset cruises.

*(Seed dataset lives in `seed.json`, conforming to the §5.1 schema. Casual dining is weighted heavily; a few special-occasion restaurants are flagged with a `special-occasion` tag.)*

---

## 10. Cleanup & Migration off GitHub Pages

This is the un-do list for the exposed-key deployment, in order. **Do step 1 first, today** — the leaked key should be treated as compromised the moment it was public.

**1. Rotate the Google key (urgent).**
- In Google Cloud Console, **delete or regenerate** the key currently in `.env.local` (`AIzaSy…Qc3A`). It was served inside the public GitHub Pages bundle, so assume strangers have it.
- Create a **fresh** key, restricted to the Places API (New), with a quota cap and a budget alert.
- Put the new key **only** in the Worker as `npx wrangler secret put GOOGLE_PLACES_KEY`. Never in `.env.local`, never in any `VITE_*` var, never committed.

**2. Take down / neutralize the GitHub Pages deployment.**
- Disable GitHub Pages for the repo (Settings → Pages → unset the source), or make the repo private if it's public.
- **Delete `.github/workflows/deploy.yml`** — it builds for Pages and injects the key into the client bundle. It is the mechanism that leaked the key and must not run again.
- Remove the `VITE_GOOGLE_PLACES_KEY` GitHub Actions secret (no longer used; reduces footprint).
- Note: rotating the key (step 1) is what actually protects you. Scrubbing the built artifact matters less because the *old* key is now dead — but still remove the public deployment so the dead key and any stale bundle aren't lingering.

**3. Remove client-side key usage in code.**
- Edit `AddItem.tsx`: delete `const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_KEY`, remove the `X-Goog-Api-Key` headers, and point the two fetches at the Worker (`type: 'autocomplete'` / `type: 'details'`).
- Delete `VITE_GOOGLE_PLACES_KEY` from `.env.local`. Add `VITE_PROXY_URL` (non-secret) for the Worker endpoint if convenient.
- Keep `.env.local` in `.gitignore` (already there) — it just won't hold secrets anymore.

**4. Stand up Cloudflare.**
- New `proxy/` Worker (copy the Hunger Habit structure: `wrangler.toml`, `src/index.js`, `wrangler secret put`). Deploy with `npx wrangler deploy`; note the `*.workers.dev` URL.
- Connect the GitHub repo to Cloudflare (Workers & Pages → Create → import repository). On the current unified dashboard this creates a **Worker** serving static assets, configured by the root `wrangler.toml` (`[assets] directory=./dist`, `not_found_handling="single-page-application"`). Build `npm run build`; deploy `npx wrangler deploy`. Every push to `main` auto-deploys to a free `*.workers.dev` HTTPS URL. *(The original plan said Cloudflare Pages; the unified dashboard no longer offers a separate Pages git flow for new projects — Workers static assets is the equivalent.)*
- Set build variables `VITE_PROXY_URL` and `VITE_PROXY_TOKEN` (non-secret) in the project settings so they're baked in at build time.

**5. Verify.**
- Confirm the new key works *only* through the Worker, and that the deployed bundle contains **no** `AIza…` string (search the built JS).
- Confirm the old key is dead (a direct call with it should fail).
- Install the PWA to the home screen from the `*.workers.dev` URL and confirm offline launch.

**6. (Optional) git history.** The key was not found in the git *source* history (`git log -S AIza` is empty — it only ever lived in the gitignored `.env.local` and the built bundle), so a history rewrite is likely unnecessary. If you want belt-and-suspenders, rewrite history with `git filter-repo` or simply start a fresh private repo. Either way, key rotation in step 1 is the real protection.

---

## 11. Build Phases (revised — status reconciled with the code, June 2026)

> The numbering below is historical. In practice Phase 2's breadth was built before the migration,
> so the actual outstanding work is **Phase 1 (storage hardening)**, then Phase 3 polish.

**Phase 0 — Security migration** ✅ **done**
Rotated the key (§10.1, restricted to Places API New + quota cap). Tore down the Pages workflow
(§10.2). Stood up the Worker proxy with an **app-token guard** (§4) and deployed the app as
**Cloudflare Workers static assets** (not Pages — Cloudflare's unified dashboard creates a Worker
when you connect a repo; root `wrangler.toml` uses `[assets]` + `not_found_handling`). Moved
`AddItem.tsx` onto the proxy (§10.3). Also fixed the GitHub-Pages `base`/`start_url` subpath,
switched `HashRouter` → `BrowserRouter`, and removed `_redirects` + `vercel.json`. Verified no key in
the bundle (§10.5). *Exit criteria met: app live on `*.workers.dev`, place search works through the
Worker, no key in client code.*

**Phase 1 — Storage hardening** ⬅️ **next / current**
Migrate persistence from `localStorage` (still the live backend) to **IndexedDB**. Add
`navigator.storage.persist()` request + a Settings storage-status readout. Export/import already
works (Settings) — just confirm it round-trips cleanly on the new store.

**Phase 2 — Full breadth** ✅ **largely done**
Implemented: all 7 categories, Favorites view, Browse search + filters (area, status) + sort
(alpha/newest/rating), tags, restaurant dish lists, and map/website links. Revisit only for gaps.

**Phase 3 — Polish & data safety** ◐ **partial**
Done: empty states, card animations. Remaining: offline verification, seed-on-first-run
confirmation, PWA install verification on iOS + Android (from the `*.workers.dev` URL).

**Phase 4 — Optional cloud sync**
Add the `SyncProvider` interface and a Cloudflare D1 (or KV) backing via a Worker route, gated behind a Settings toggle + sync token. Last-write-wins on `updatedAt`. Designed so Hunger Habit can reuse the same provider.

---

## 12. Claude Code Setup Notes

- Repo stays **private**: `gh repo create pcb-scouting-list --private` (already done — keep it private).
- Two-terminal workflow: Claude Code in one, `npm run dev` (Vite) in the other for hot reload. For on-device testing pre-deploy, open the local URL on the phone (same Wi-Fi); post-deploy, just use the `*.workers.dev` URL.
- The app deploys via **Cloudflare Workers Builds** on push to `main` (build `npm run build`, deploy `npx wrangler deploy` reading the root `wrangler.toml`). The proxy in `proxy/` is a *separate* Worker, deployed manually with `npx wrangler deploy` from `proxy/`.
- Worker dev: `npx wrangler dev` runs the proxy locally; point `VITE_PROXY_URL` at it during development.
- `.gitignore` already covers `node_modules/`, `dist/`, `dev-dist/`, `.env.local`, and `pcb-scouting-list-backup.json`. Keep it that way.
- **Never** reintroduce a `VITE_`-prefixed secret — anything `VITE_*` is public by definition.

---

## 13. Cost summary (everything free)

| Item | Cost |
|---|---|
| Cloudflare Workers static-assets hosting + `*.workers.dev` HTTPS subdomain | $0 |
| Cloudflare Worker proxy (≤100k req/day) | $0 |
| Cloudflare D1 / KV for optional sync + the `CAP_KV` spend-cap counter (personal-scale) | $0 |
| Cloudflare Rate Limiting binding | $0 |
| Google Places API | $0 — the Worker's free-tier daily cap (autocomplete 300/day, details 30/day) keeps usage inside Google's monthly free tier, so it can't surprise-bill |
| Custom domain | **Not needed.** Optional only; the one thing that would ever cost money on any host |

---

## Open questions / easy to change later

- D1 (relational, future-proof) vs. KV (dead-simple) for the optional sync backend — defaulting to D1 unless KV's simplicity wins for v1.
- Replace data on import, or merge-by-id? (v1: replace.)
- Whether to add real accounts (Cloudflare Access) once more than one app shares the sync layer.
- Heading font: Fraunces + Nunito Sans (locked) vs. fully rounded Quicksand.
