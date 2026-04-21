# Genbu - TTHOL Game Database Website

## Project Overview

A game information website for "武林同萌傳" (TTHOL), providing item queries, equipment comparison tools, and dungeon puzzle solvers. Data comes from a SQLite database (`tthol.sqlite`).

Reference project: `../tthol-line-bot` — the LINE bot version with similar features.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** SQLite via better-sqlite3 (server-side, read-only)
- **Deployment:** Docker image, deployed to VPS via Portainer

## Project Structure

```
genbu/
├── src/
│   ├── app/          # Next.js App Router pages
│   ├── components/   # React components
│   ├── lib/          # Utilities, DB access, types
│   └── configs/      # Weighted formulas, constants
├── public/           # Static assets
├── tthol.sqlite      # Game database (read-only)
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
- Use shadcn/ui components as base building blocks

## Phase Plan

1. **Phase 1** — Foundation + Item Query (project init, homepage, item list/detail)
2. **Phase 2** — Equipment Comparison (mount/back ranking, weighted comparison tool)
3. **Phase 3** — Skills & Monsters (skill browser, monster query with drops)
4. **Phase 4** — Dungeon Puzzle Tools (160/175/180 interactive solvers)
