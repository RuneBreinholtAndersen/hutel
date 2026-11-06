# Hutel.dk

Socialt chat-spil i browseren: byg din figur, gå rundt i et hyggeligt hotel, chat i talebobler og indret dit eget værelse.

## Kom i gang

Kræver Node 22 og pnpm (`npm i -g pnpm`).

```bash
pnpm install
cp .env.example .env
pnpm dev
```

- Klient: http://localhost:5173
- Server: http://localhost:2567/health

## Kommandoer

| Kommando         | Hvad den gør                      |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Starter klient og server samtidig |
| `pnpm test`      | Kører alle tests                  |
| `pnpm lint`      | Tjekker koden med ESLint          |
| `pnpm typecheck` | Tjekker TypeScript-typer          |
| `pnpm build`     | Bygger klienten til produktion    |

## Struktur

```
apps/client      Spillet i browseren (Vite + TypeScript, Three.js fra Milepæl 1)
apps/server      Realtidsserver (Node, Colyseus fra Milepæl 1)
packages/shared  Fælles logik: grid, pathfinding, konstanter
prototype/       Den oprindelige enkeltspiller-prototype (facitliste for stilen)
docs/PLAN.md     Milepæle og tjekliste
```

Se `CLAUDE.md` for regler og arkitektur.
