# ChromaBrain Search UI — Design & Implementation Plan

## Skills Utilized
- **design-taste-frontend** — Design variance (8), motion intensity (6), visual density (4), anti-slop rules
- **ui-ux-pro-max** — Accessibility, touch targets, performance, layout standards
- **frontend-dev-guidelines** — TypeScript strict, component architecture, performance defaults
- **nextjs-best-practices** — App Router patterns, server/client split, metadata
- **redesign-existing-projects** — Audit checklist for generic AI patterns (avoided)

---

## 1. Sitemap

```
chromabrain/
├── / ──────────────── redirects to /search
└── /search ────────── Main search interface
    ├── Header         ChromaBrain branding + Reindex button
    ├── Search bar     Debounced input with loading indicator
    ├── Results list   Staggered-entry result items with expand
    ├── Empty state    Composed "no results" view
    ├── Error state    Inline banner with retry
    └── Toast region   Fixed bottom-right notifications
```

---

## 2. User Journey Maps

### Primary: Search Flow
```
[Land on /search] ─── User sees idle state with search prompt
        │
        ▼
[Type query] ──────── 400ms debounce starts, AbortController cancels prior
        │
        ▼
[Loading] ─────────── Skeleton shimmers appear (3 rows)
        │
        ▼
[Results appear] ──── Staggered fade-up animation, 80ms delay each
        │
        ▼
[Expand snippet] ──── Click toggles line-clamp, caret rotates 180deg
        │
        ▼
[Refine query] ────── Previous fetch aborted, new search begins
```

### Secondary: Reindex Flow
```
[Click "Reindex all"] ── Button disabled, spinner starts
        │
        ▼
[Indexing badge] ──────── Amber pulsing "Indexing..." badge appears
        │
        ├── Success ──── Green toast slides in, auto-dismiss 4s
        │
        └── Failure ──── Red toast with dismiss button
```

### Error Recovery Flow
```
[API unreachable] ──── Inline red banner replaces results area
        │
        ▼
[Click Retry] ──────── Same query re-executed via AbortController
        │
        ├── Success ──── Results appear normally
        │
        └── Still failing ── Banner persists with updated message
```

---

## 3. Wireframe — Desktop (1440px+)

```
┌──────────────────────────────────────────────────────────────────────┐
│  pl-[8vw]                                        max-w-[1400px]     │
│                                                                      │
│  ChromaBrain                                        ┌──────────────┐│
│  Unified knowledge search                           │ Reindex all  ││
│                                                     └──────────────┘│
│                                                                      │
│  Search your knowledge base                                          │
│  ┌──────────────────────────────────────────────┬───┐               │
│  │  [icon] Type to search across all files...   │ × │               │
│  └──────────────────────────────────────────────┴───┘               │
│  Searches across MEMORY.md, agent files, daily logs...               │
│                                                                      │
│  3 results                                                           │
│  ────────────────────────────────────────────────────                │
│  Client Info - UNT                              92.3%                │
│  ...memory/preferences.md                                            │
│  "Jason Astrowood, Union National Tax..."                            │
│  > Show more                                                         │
│  ────────────────────────────────────────────────────                │
│  Daily Standup Notes                            87.1%                │
│  ...memory/2026-03-05.md                                             │
│  "Discussed API integration timeline..."                             │
│  > Show more                                                         │
│  ────────────────────────────────────────────────────                │
│  Agent Memory Index                             74.8%                │
│  ...memory/agent-chroma.md                                           │
│  "Vector search configuration for Pinecone..."                       │
│  > Show more                                                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘

Toast (fixed bottom-right):
┌──────────────────────────────┐
│ [check] Reindexing complete  │
└──────────────────────────────┘
```

---

## 4. Wireframe — Mobile (375px)

```
┌────────────────────────┐
│ px-4 py-8              │
│                        │
│ ChromaBrain            │
│ Unified knowledge      │
│ search                 │
│                        │
│ ┌────────────────────┐ │
│ │ Reindex all   [ic] │ │
│ └────────────────────┘ │
│                        │
│ Search your knowledge  │
│ base                   │
│ ┌──────────────────┐   │
│ │ [ic] Search... × │   │
│ └──────────────────┘   │
│                        │
│ 3 results              │
│ ──────────────────────│
│ Client Info    92.3%   │
│ ...preferences.md      │
│ "Jason Astrowo..."     │
│ > Show more            │
│ ──────────────────────│
│ Daily Standup  87.1%   │
│ ...2026-03-05.md       │
│ "Discussed API..."     │
│ > Show more            │
│                        │
│ ┌────────────────────┐ │
│ │ Reindexing complete│ │
│ └────────────────────┘ │
└────────────────────────┘
```

Mobile overrides:
- Full-width layout (w-full px-4)
- Single-column stack
- Asymmetric padding removed
- Touch targets: min 44px on all buttons
- Toast spans full width at bottom

---

## 5. Service Blueprint

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1: USER ACTIONS                                               │
│ Land → Type query → View results → Expand → Refine → Reindex       │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 2: FRONTEND (Next.js "use client")                            │
│                                                                     │
│ SearchUI.tsx                                                        │
│ ├── useReducer state machine (idle/loading/success/empty/error)     │
│ ├── 400ms debounce timer via useRef                                 │
│ ├── AbortController cancels in-flight fetches                       │
│ └── Toast auto-dismiss via useEffect timer                          │
│                                                                     │
│ lib/chromabrain.ts                                                  │
│ ├── searchKnowledge(query, signal) → GET /api/search?q=             │
│ └── reindexAll(signal) → POST /api/index/all                        │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 3: NETWORK                                                    │
│ NEXT_PUBLIC_API_URL → Express backend (separate process)            │
├─────────────────────────────────────────────────────────────────────┤
│ LAYER 4: BACKEND (Express — not our scope)                          │
│ /api/search?q= → OpenAI embeddings → Pinecone → JSON response      │
│ /api/index/all → File scanner → Chunk → Embed → Upsert             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Touch Points

| # | Element | Type | Priority | Touch Target |
|---|---------|------|----------|--------------|
| 1 | Search input | Text input | Highest | Full width |
| 2 | Clear button (x) | Icon button | High | 44x44px |
| 3 | Result expand | Full-row button | High | 44px min-h |
| 4 | Reindex button | Action button | Medium | 44px min-h |
| 5 | Retry button | Action button | Medium | 44px min-h |
| 6 | Toast dismiss | Icon button | Low | 32x32px |

---

## 7. Attention Heat Map

```
INTENSITY: ████ = Highest  ▓▓▓ = High  ▒▒▒ = Medium  ░░░ = Low

┌──────────────────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ▒▒▒ │  Header / Reindex
│                                                  │
│ ████████████████████████████████████████████████ │  SEARCH INPUT
│                                                  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │  Result 1 (title + score)
│ ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ │  Result 2
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  Result 3+ (scroll)
│                                                  │
└──────────────────────────────────────────────────┘
```

Design implications:
- Search bar gets max visual weight + auto-focus
- First result has strongest typographic hierarchy
- Score badges use Geist Mono for instant readability
- Header is intentionally understated

---

## 8. Design System Applied

| Property | Value | Rationale |
|----------|-------|-----------|
| Font (sans) | Geist | Premium sans-serif, Inter banned |
| Font (mono) | Geist Mono | Scores + source paths |
| Background | zinc-50 (#fafafa) | Not pure white, breathable |
| Text primary | zinc-900 | Not pure black (#000 banned) |
| Text secondary | zinc-500/600 | Readable muted text |
| Accent | emerald-600 | Single accent (purple banned) |
| Borders | zinc-200 | Consistent cool gray family |
| Radius | rounded-xl | Modern, not pill-shaped |
| Transitions | cubic-bezier(0.16,1,0.3,1) | Premium easing curve |
| Active press | scale-[0.98] | Tactile button feedback |
| Full-height | min-h-[100dvh] | NOT h-screen (iOS bug) |
| Layout | Left-aligned, asymmetric | DESIGN_VARIANCE=8 |
| Result dividers | border-t zinc-100 | No card boxes (density=4) |

---

## 9. State Machine

```
                ┌─────────┐
                │  IDLE   │ ◄─── clear / mount
                └────┬────┘
                     │ type query (400ms debounce)
                     ▼
                ┌─────────┐
         ┌──────│ LOADING │──────┐
         │      └────┬────┘      │
         │           │           │
    (results=0)  (results>0)   (error)
         │           │           │
         ▼           ▼           ▼
    ┌────────┐ ┌─────────┐ ┌────────┐
    │ EMPTY  │ │ SUCCESS │ │ ERROR  │
    └────────┘ └─────────┘ └───┬────┘
                                │ retry
                                ▼
                           ┌─────────┐
                           │ LOADING │
                           └─────────┘
```

---

## 10. Accessibility Checklist

- [x] `<label htmlFor="search-input">` — visible, not sr-only
- [x] `aria-live="polite"` on results region
- [x] `aria-busy="true"` during loading state
- [x] `role="status"` on toast notifications
- [x] `role="alert"` on error banner
- [x] `aria-expanded` on expandable snippets
- [x] `aria-label` on icon-only buttons (clear, dismiss)
- [x] Focus ring via `focus-visible:outline` (emerald-500)
- [x] Auto-focus search input on mount
- [x] All touch targets >= 44px
- [x] No color-only indicators (text + icon for all states)
- [x] `sr-only` text on loading skeleton for screen readers

---

## 11. File Structure

```
chromabrain/
├── app/
│   ├── layout.tsx            Server: Geist fonts, metadata, globals
│   ├── globals.css           Tailwind v4, animations, custom properties
│   ├── page.tsx              Server: redirect to /search
│   └── search/
│       ├── page.tsx          Server: metadata wrapper
│       └── SearchUI.tsx      Client: all interactive logic
├── lib/
│   └── chromabrain.ts        API types + fetch helpers + AbortController
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── .env.local                NEXT_PUBLIC_API_URL
├── .env.local.example
├── .gitignore
├── PRD.md                    Original product requirements
└── PLAN.md                   This file
```

---

## 12. Pre-Flight Verification (design-taste-frontend)

- [x] Global state: useReducer only, no external libs
- [x] Mobile collapse: w-full, px-4, single-column below md
- [x] Full-height: min-h-[100dvh], not h-screen
- [x] useEffect cleanup: all timers and AbortControllers cleaned up
- [x] Empty, loading, error states: all implemented
- [x] Cards omitted: results use border-t dividers
- [x] No emojis anywhere in code or content
- [x] No Inter font
- [x] No purple/blue AI gradient
- [x] No pure black (#000000)
- [x] No 3-column card layout
- [x] Phosphor icons (not Lucide/Feather)
- [x] CSS Grid not flexbox math
- [x] Hardware-accelerated animations only (transform, opacity)
- [x] TypeScript strict: zero `any` types
