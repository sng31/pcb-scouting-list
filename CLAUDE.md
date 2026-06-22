# PCB Scouting List

A personal, phone-first PWA for settling into and exploring Panama City Beach, Panama City,
and the surrounding Gulf coast. Track places and tasks, mark them *want to try → been there*,
rate them, take notes (incl. standout dishes), and favorite the best.

**Local-only, no backend, no accounts.** All data lives in `localStorage`. JSON export/import is
the durability mechanism. Soft coastal aesthetic. Seeded with ~156 real area places on first run.

Full spec: `PCB-Scouting-List-Tech-Spec.md`. Seed data: `seed.json` (conforms to the Item schema).

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build/dev | Vite |
| Routing | React Router |
| State + persistence | Zustand + `persist` middleware → `localStorage` |
| Styling | Tailwind CSS v4 + CSS-variable design tokens |
| Icons | lucide-react |
| IDs | `crypto.randomUUID()` |
| PWA | vite-plugin-pwa (manifest, service worker, offline, add-to-home-screen) |
| Hosting | Vercel or Netlify (free, HTTPS) |

Deliberately lean: no charts, analytics, or notification libraries.

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

Bottom tab bar: **Home · Browse · Favorites · Checklist · Settings**

## Build Phases

**Phase 1 — Foundation** *(current)*
Scaffold Vite + React + TS + Tailwind + PWA. Design tokens, `Item` model, Zustand store with
`localStorage` persistence + first-run seed load. Home, Browse (one category), Item detail/edit
with add / status toggle / star rating / notes / favorite.

**Phase 2 — Full breadth**
All categories, Favorites view, search/filter/sort, Settling-in checklist, tags,
restaurant dish lists, map links.

**Phase 3 — Polish & data safety**
Export/import JSON, empty states, animations, offline verification, deploy + verify install.

## Conventions

- Build one screen at a time; pause so the user can check it in the browser before moving on.
- Ask before installing new dependencies.
- Two-terminal workflow: Claude Code in one, `npm run dev` in the other for hot reload.
- `.gitignore`: `node_modules/`, `dist/`, `pcb-scouting-list-backup.json`.
