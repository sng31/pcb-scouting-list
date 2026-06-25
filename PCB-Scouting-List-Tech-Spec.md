# PCB Scouting List — Technical Specification

A personal, phone-friendly web app for settling into and exploring Panama City Beach, Panama City, and the surrounding Gulf coast. Track places and tasks, mark them *want to try → been there*, rate them, take notes (including standout dishes), and favorite the best of them. Local-only data, soft coastal aesthetic.

**Project type:** Personal-use PWA (not commercial)
**Build tool:** Claude Code (two-terminal workflow)
**Status:** Spec drafted, entering scaffold

---

## 1. Goals & Principles

- **Phone-first.** Designed for a phone screen, installable to the home screen, works offline.
- **Local & free.** All data lives in the browser (`localStorage`). No backend, no accounts, no bills.
- **Durable despite local-only.** JSON export/import so data is never trapped or unrecoverably lost.
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
| State + persistence | **Zustand** + `persist` middleware | Tiny store that auto-syncs to `localStorage` — exactly this use case |
| Styling | **Tailwind CSS v4** + CSS-variable design tokens | Fast to build; palette centralized and themeable |
| Icons | **lucide-react** | Clean, consistent line icons |
| IDs | `crypto.randomUUID()` | Built-in, no dependency |
| PWA | **vite-plugin-pwa** | Manifest, service worker, offline cache, add-to-home-screen |
| Hosting | **Vercel** or **Netlify** (free) | Free HTTPS (required for PWA install); auto-deploy from GitHub |

No charts, no analytics libraries, no notifications — kept deliberately lean.

---

## 3. Data Model

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
}
```

**Seeding rule:** on launch, if the persisted store is empty (no `seededAt`), hydrate `items` from the bundled seed dataset and stamp `seededAt`. After that, the user's data is authoritative and the seed never overwrites it.

---

## 4. Screens & Navigation

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
   - Floating **+ Add** button.

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
   - **Export data** → downloads `pcb-scouting-list-backup.json`.
   - **Import data** → upload a backup. **Replaces** all current data behind a confirmation dialog (the "restore from backup" model). Merge-by-id is a documented future option.
   - Theme note / about.
   - **Reset to seed** (with confirm).

---

## 5. Core Features

- **Status tracking** — want-to-try vs. been (todo/done for tasks).
- **Ratings** — 1–5 stars, tap to set/clear.
- **Notes & favorite dishes** — free text + per-restaurant dish list.
- **Favorites** — cross-category flag + dedicated view.
- **Tags** — free-form, used in search and as filter chips.
- **Search / filter / sort** — within Browse.
- **Map links** — deep-link to Maps from any place.
- **Export / Import JSON** — the backup mechanism that makes local-only safe.
- **Offline** — service worker caches the app shell; fully usable without signal.

---

## 6. Design — Soft Coastal Theme

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

## 7. Content Scope (for seeding)

Real places across these buckets, to be researched and compiled into the seed dataset:

- **Restaurants** — PCB + Panama City; seafood, Gulf-view spots, breakfast/brunch, local favorites, casual + nicer options.
- **Beaches & beach access** — named PCB beaches, St. Andrews State Park, Shell Island, Camp Helen, etc.
- **Activities (PCB + Panama City + nearby)** — piers, state parks, nature/eco (Conservation Park, kayaking, dolphin tours), mini-golf/arcades, Pier Park, downtown Panama City arts district, etc.
- **Weekend excursions** — 30A & Seaside, Destin, Grayton Beach, Apalachicola, springs (Econfina, Vortex, Morrison), Florida Caverns, Wakulla, etc.
- **Markets** — St. Andrews Waterfront & downtown farmers markets, seafood markets, neighborhood markets.
- **Sunset Spots** — west-facing beaches, piers, rooftop bars, boardwalks, sunset cruises.
*(Seed dataset generated → `seed.json`, conforming to the §3 schema. Casual dining is weighted heavily; a few special-occasion restaurants are flagged with a `special-occasion` tag.)*

---

## 8. Build Phases

**Phase 1 — Foundation**
Scaffold Vite + React + TS + Tailwind + PWA. Implement design tokens, `Item` model, Zustand store with `localStorage` persistence, Home, Browse (one category), Item detail/edit with add/status/rating/notes/favorite.

**Phase 2 — Full breadth**
All categories, Favorites view, search/filter/sort, tags, restaurant dish lists, map links.

**Phase 3 — Polish & data safety**
Export/import JSON, seed-data load on first run, empty states, animations, offline verification, deploy to Vercel/Netlify + verify add-to-home-screen install.

---

## 9. Claude Code Setup Notes

- Create the repo: `gh repo create pcb-scouting-list --private --source=. --remote=origin`
- Run `/init` in Claude Code to generate `CLAUDE.md`; seed it with: project purpose, the stack table (§2), the `Item` model (§3), the design tokens (§6), and the build phases (§8). This keeps Claude Code anchored across sessions.
- Two-terminal workflow: Claude Code in one, `npm run dev` (Vite) in the other for hot reload; open the local URL on your phone (same Wi-Fi) to test on-device.
- Add `pcb-scouting-list-backup.json` and `dist/` to `.gitignore`.

---

## Open questions / easy to change later

- Replace data on import, or merge? (v1: replace.)
- Heading font: Fraunces+Nunito Sans, or fully rounded Quicksand?
- Any extra category you want (e.g. *Shops/Markets*, *Sunset spots*)?
