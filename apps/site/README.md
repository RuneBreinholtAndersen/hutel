# lobbi.dk – hjemmesiden

Statisk Astro-side, der lægges på Simply (`public_html/`). Forsiden viser den rigtige lobby og
en figur-bygger med spillets egen 3D-kode (`@game` = `apps/client/src`).

```
pnpm --filter @hutel/site dev     # http://localhost:4321
pnpm --filter @hutel/site build   # → apps/site/dist
```

- **"Spil gratis"-knapper** går til `https://spil.lobbi.dk` (kan ændres med `PUBLIC_PLAY_URL`).
- **Nyheder** kommer fra `packages/shared/src/releases.ts` – samme noter som "Nyt i Lobbi" i spillet.
- **Deploy:** `.github/workflows/deploy-site.yml` bygger og uploader automatisk ved hvert push,
  når secret `SIMPLY_FTP_PASSWORD` (FTPS) eller `SIMPLY_SSH_KEY` (rsync over SSH) findes.
