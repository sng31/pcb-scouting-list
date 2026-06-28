# PCB Scouting List

A personal, phone-first PWA for settling into and exploring Panama City Beach, Panama City,
and the surrounding Gulf coast. Track places and tasks, mark them *want to try → been there*,
rate them, take notes (incl. standout dishes), and favorite the best.

**Local-first, free, no required backend.** Data lives on-device in **IndexedDB** via zustand
`persist` (a custom adapter in `src/storage.ts`; legacy `localStorage` data is migrated in
transparently on first read), hardened with `navigator.storage.persist()`. JSON export/import is the
guaranteed backup (already built), and an **optional** Cloudflare-backed sync is planned for
cache-clear survival + multi-device. No accounts required by default. Soft coastal aesthetic.
Seeded with ~156 real area places on first run.

**Keys are never in client code.** The Google Places key lives only in a Cloudflare Worker proxy
(encrypted Wrangler secret). Anything `VITE_*` is public by definition — never put a secret there.

Full spec: `PCB-Scouting-List-Tech-Spec.md` (see §0 for why this was revised, §10 for the GitHub-Pages
cleanup, §11 for phases). Seed data: `seed.json` (conforms to the Item schema). Worker proxy: `proxy/`.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build/dev | Vite |
| Routing | React Router — **BrowserRouter** (clean URLs; SPA fallback via Worker + SW `navigateFallback`) |
| App state | Zustand |
| Local persistence | **IndexedDB** via zustand `persist` (custom adapter in `src/storage.ts`, transparent `localStorage`→IDB migration) + `navigator.storage.persist()` |
| Styling | Tailwind CSS v4 + CSS-variable design tokens |
| Icons | lucide-react |
| IDs | `crypto.randomUUID()` |
| PWA | vite-plugin-pwa (manifest, service worker, offline, add-to-home-screen) |
| Hosting | **Cloudflare Workers static assets** (root `wrangler.toml` with `[assets] directory=./dist`, `not_found_handling="single-page-application"`; free `*.workers.dev` subdomain). Deployed via Workers Builds on push to `main`. |
| API proxy | **Cloudflare Worker** (`proxy/`) — separate Worker; holds the Google Places key as an encrypted secret |
| Optional sync | **Cloudflare D1 / Workers KV** (opt-in; same free account) |

> **Hosting note:** the original plan was Cloudflare *Pages*, but Cloudflare's unified dashboard now
> creates a *Worker* when you connect a repo, so the app is served as Workers static assets instead.
> Functionally equivalent for a static SPA; the app URL is `*.workers.dev`, not `*.pages.dev`.

Deliberately lean: no charts, analytics, or notification libraries. All-Cloudflare so hosting,
proxy, and optional data layer share one free account (same pattern as the Hunger Habit proxy).

## Data Model

A single unified `Item` type covers every category (keeps Favorites/search/filter simple).
Category-specific fields are optional.

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
  deviceId?: string;                   // optional sync: random per-device id
  lastSyncedAt?: string;               // optional sync: ISO timestamp
}
```

**Seeding rule:** on launch, if the persisted store is empty (no `seededAt`), hydrate `items`
from bundled `seed.json` and stamp `seededAt`. After that the user's data is authoritative and
the seed never overwrites it.

## Design — Soft Coastal Theme

Centralized as CSS variables, mirrored into the Tailwind theme.

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

- **Shadows:** soft, diffuse, slightly teal-tinted — `0 8px 24px rgba(46,71,71,0.08)`.
- **Radius:** generous — 18px cards, pill-shaped buttons and chips.
- **Typography (locked):** Fraunces (soft serif) for headings + Nunito Sans for body.
- **Motifs:** subtle wave divider on Home hero; star icons for ratings; shell/sun glyph for favorites.
- **Motion:** gentle — fade/slide on card mount, small bounce on favorite toggle.

## Navigation

Bottom tab bar: **Home · Browse · Favorites · Settings**

## Place Search (Google Places)

The Add screen's place search/autofill goes **through the Cloudflare Worker** in `proxy/`, never
directly to Google. The app POSTs `{type:'autocomplete'|'details', ...}` to the Worker URL
(`VITE_PROXY_URL`, non-secret) with an `X-App-Token` header (`VITE_PROXY_TOKEN`); the Worker
attaches the key and field mask and returns normalized fields. `AddItem.tsx` must not import any
`VITE_GOOGLE_*` key or send `X-Goog-Api-Key`.

**Proxy access controls (defense in depth — see `proxy/src/index.js`):**
- **App-token guard** — the Worker checks `X-App-Token` against its `PROXY_APP_TOKEN` secret and
  401s on mismatch. This is *friction, not a real secret*: `VITE_PROXY_TOKEN` ships in the public
  bundle, so it only filters drive-by bots.
- **CORS** — allows `*.pages.dev` and `*.<sub>.workers.dev` origins (the app is a Worker, so its
  origin is the `workers.dev` form), plus anything in the `ALLOWED_ORIGINS` var.
- **Per-IP rate limiting** — Cloudflare Rate Limiting binding (`RATE_LIMITER`, 40 req/10s per IP)
  rejects bursts with a 429 before any Google call. Fails open if the binding is absent.
- **Response caching** — identical autocomplete/details lookups are served from the Cache API
  (1h / 24h TTL), so repeats never re-hit Google.
- **Free-tier daily cap** — a KV-backed (`CAP_KV`) per-type, per-UTC-day counter 429s once a call
  type hits its cap (autocomplete 300/day, details 30/day). Caps are sized to stay inside Google's
  monthly free tier (Essentials 10k / Pro 5k / Enterprise 1k per SKU). **This is the real billing
  backstop** — Google's own quota cap is no longer settable for Places API (New) (the Cloud Console
  "Edit quota" control is disabled), so the cap lives in the Worker instead. Fails open if `CAP_KV`
  is absent. Cache hits don't count.
- A free Worker has no fixed egress IP, so the Google key can't be IP-restricted; it's restricted to
  **Places API (New)** only. A billing budget alert is advisory only (it notifies, it doesn't cap).

> **Note on the details cap:** the Place Details field mask requests premium fields
> (`generativeSummary`, `editorialSummary`, `priceLevel`), so the call is billed at the Enterprise
> tier (1k/mo free → 30/day). Dropping those fields would move it to a cheaper SKU and allow a
> higher cap.

## Build Phases

> **Status (reconciled with the code, not the original plan):** Phases 0–3 are ✅ done — the app is
> feature-complete and shipped. Only **Phase 4 (optional cloud sync)** remains, and it's explicitly
> optional. The numbering is historical — don't read it as strict order.

**Phase 0 — Security migration** ✅ *done*
Rotated the leaked Google key (restricted to Places API New + quota cap). Removed the GitHub Pages
workflow. Stood up the Worker proxy with an app-token guard. Deployed the app as Cloudflare Workers
static assets. Moved `AddItem.tsx` onto the proxy. Fixed the `base`/`start_url` subpath, switched
to BrowserRouter, removed `_redirects`/`vercel.json` cruft. Verified no `AIza…` string in the bundle.

**Phase 1 — Storage hardening** ✅ *done*
Persistence migrated `localStorage` → **IndexedDB** (custom zustand-`persist` adapter in
`src/storage.ts`, with transparent one-time `localStorage`→IDB migration and a `localStorage`
fallback). Added `navigator.storage.persist()` on launch, async-safe hydration (first-run seed moved
into `onRehydrateStorage`, gated by a `hasHydrated` flag + loading splash), and a Settings
storage-status readout (backend, permanent vs best-effort, usage/quota). Verified in-browser:
fresh seed, migration, persistence across reload.

**Phase 2 — Full breadth** ✅ *largely done*
All 7 categories, Favorites view, Browse search/filter (area, status)/sort (alpha/newest/rating),
tags, restaurant dish lists, and map/website links are implemented. Revisit only for gaps.

**Phase 3 — Polish & data safety** ✅ *done*
Empty states and card animations exist. Offline verified against the production build (app shell,
deep-link SPA fallback, IndexedDB data all work offline); fonts added to the Workbox precache so
offline typography is durable (`globPatterns` includes `woff`/`woff2`). PWA installability confirmed
via CDP (manifest + SW + SVG icon all valid). Home quick-stat tiles link out (Want→Browse filtered,
Favorites→Favorites, Been there→Recently visited), and Favorites has a search bar.

**Phase 4 — Optional cloud sync**
`SyncProvider` interface backed by Cloudflare D1/KV via a Worker route, gated behind a Settings
toggle + sync token. Last-write-wins on `updatedAt`. Reusable by other apps. (A `SyncResult` type
already exists in `store.ts` as scaffolding.)

## Conventions

- Build one screen at a time; pause so the user can check it in the browser before moving on.
- Ask before installing new dependencies.
- Two-terminal workflow: Claude Code in one, `npm run dev` in the other for hot reload.
  For the proxy, `npx wrangler dev` runs the Worker locally; point `VITE_PROXY_URL` at it.
- `.gitignore`: `node_modules/`, `dist/`, `dev-dist/`, `.vite/`, `*.tsbuildinfo`, `.env.local`,
  `pcb-scouting-list-backup.json`, `.claude/`, `.wrangler/`.
- **Never** put a secret in a `VITE_*` var — it gets inlined into the public bundle (this is the bug
  that leaked the original key). Secrets go in the Worker via `npx wrangler secret put`.
