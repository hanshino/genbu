# Genbu - TTHOL Game Database Website

## Project Overview

A game information website for "武林同萌傳" (TTHOL), providing item queries, equipment comparison tools, and dungeon puzzle solvers. Data comes from a SQLite database (`tthol.sqlite`).

Reference project: `../tthol-line-bot` — the LINE bot version with similar features.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** SQLite via better-sqlite3 (server-side, read-only)
- **Deployment:** GitHub Actions publishes an ARM64 Docker image to GHCR; the EC2 host uses a pull-based deploy. The SQLite runtime mount is independent from the image.

## Project Structure

```
genbu/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   ├── lib/          # Utilities, DB access, types
│   └── configs/      # Weighted formulas, constants
├── public/           # Static assets
├── tthol.sqlite      # Game database (read-only; runtime mount, not image content)
├── Dockerfile
└── CLAUDE.md
```

## Development Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # ESLint
```

## Database

- `tthol.sqlite` is read-only game data, do NOT modify it
- Access via better-sqlite3 in Server Components / Route Handlers only
- Key tables: items (13k), magic (6k), item_rand (5k), npc (5k), strong_formula (4k), monsters (3k), hero (84), hero_connect (75)

## Conventions

- Use Traditional Chinese (zh-tw) for all user-facing text
- Follow Next.js App Router patterns (Server Components by default, 'use client' only when needed)
- Keep components small and focused

### UI Components: shadcn-first, hand-roll last resort

Before writing any custom markup for a UI element, go through this decision order:

1. **Check `src/components/ui/`** for an existing shadcn primitive. Current inventory:
   `Button`, `Badge`, `Card`, `Input`, `Select`, `Separator`, `Table` family, `Tabs`.
2. **Check `@base-ui/react`** (already installed via shadcn) for primitives not yet wrapped:
   `Popover`, `Menu`, `Dialog`, `Tooltip`, `Collapsible`, `Checkbox`, `Switch`, etc.
   Wrap them as shadcn components under `src/components/ui/` so they're reusable.
3. **Check `lucide-react`** for icons — never use Unicode glyphs (`×`, `▾`, `✓`) or emojis.
4. **Only hand-roll if** (a) no shadcn primitive fits AND (b) no base-ui primitive fits,
   OR forcing one would require overriding so much that the semantic becomes wrong.
5. **When hand-rolling**, match the visual vocabulary of nearby shadcn primitives:
   `rounded-md` / `rounded-lg`, `border-border/60`, `bg-card`, `text-muted-foreground`,
   `hover:bg-muted/50`, focus-visible ring via `ring-ring`.

Rule of thumb: if you catch yourself writing `<table>`, `<ul class="...dropdown...">`,
`<span class="...pill/chip...">`, or `<button>×</button>` by hand — stop and go back to
step 1. These have shadcn/base-ui equivalents.

## Phase Plan

1. **Phase 1** — Foundation + Item Query (project init, homepage, item list/detail)
2. **Phase 2** — Equipment Comparison (mount/back ranking, weighted comparison tool)
3. **Phase 3** — Skills & Monsters (skill browser, monster query with drops)
4. **Phase 4** — Dungeon Puzzle Tools (160/175/180 interactive solvers)
