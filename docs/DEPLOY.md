# Sådan kommer Hutel på nettet

Hutel kører som **én container**: serveren leverer både spillet (klienten) og realtidsforbindelsen. Det er nok til en lukket beta og de første mange hundrede gæster. Vercel er ikke nødvendigt.

Data (gæster, værelser, chatlog) gemmes indtil videre i en fil på et Fly-volume (`/data/hutel-db.json`). Det skiftes ud med Supabase senere – se `docs/PLAN.md`.

## Tjekliste

- [ ] Opret en konto på fly.io og tilføj et betalingskort (en lille maskine koster få dollars om måneden – tjek prisen på fly.io)
- [ ] Installér `flyctl` på din Mac: `brew install flyctl`
- [ ] Log ind: `fly auth login`
- [ ] Opret appen ud fra `fly.toml` (uden at deploye endnu): `fly launch --no-deploy --copy-config`
  - Vælg et ledigt app-navn, hvis `hutel` er taget, og ret `app = "..."` i `fly.toml`
- [ ] Opret et volume til data i Stockholm: `fly volumes create hutel_data --region arn --size 1`
- [ ] Lukket beta – kun dem med en kode kan oprette sig: `fly secrets set BETA_INVITE_CODES=DIN-KODE` (flere koder adskilles med komma)
- [ ] (Valgfrit) AI-beboere: `fly secrets set ANTHROPIC_API_KEY=sk-ant-...`
- [ ] Deploy: `fly deploy`
- [ ] Tjek at det kører: `https://<app-navn>.fly.dev/health` skal svare `{"ok":true,...}`
- [ ] Åbn `https://<app-navn>.fly.dev` og opret en gæst

## Domænet hutel.dk

- [ ] Registrér hutel.dk hos Simply
- [ ] `fly certs add hutel.dk` og `fly certs add www.hutel.dk`
- [ ] Find IP-adresserne: `fly ips list`
- [ ] Hos Simply: opret en A-record (IPv4) og en AAAA-record (IPv6) for `hutel.dk`, og en CNAME for `www` til `<app-navn>.fly.dev`
- [ ] Vent til `fly certs show hutel.dk` siger, at certifikatet er klar

## Login med e-mail, Google og Facebook

Spillet bruger Supabase Auth. Serveren tjekker selv hvert login hos Supabase, så ingen hemmelige nøgler ligger i browseren.

1. Opret et projekt på supabase.com (region: EU, fx Frankfurt eller Stockholm).
2. **Authentication → URL Configuration:** Site URL `https://hutel.fly.dev` (senere `https://hutel.dk`). Tilføj også `http://localhost:5173` under Redirect URLs til test.
3. **E-mail:** er slået til som standard (magic link). Senere bør mails sendes via egen SMTP, fx Simply.
4. **Google:** Opret en OAuth-klient i Google Cloud Console (type "Web application"). Indsæt callback-adressen, som Supabase viser under Authentication → Providers → Google. Kopiér Client ID og Secret tilbage i Supabase.
5. **Facebook:** Opret en app på developers.facebook.com med "Facebook Login". Indsæt Supabase' callback-adresse som "Valid OAuth Redirect URI". Kopiér App ID og Secret til Supabase → Providers → Facebook. Appen skal sættes i "Live"-tilstand, før andre end dig kan logge ind.
6. Kopiér Project URL og anon/public key fra Project Settings → API og kør:

```
fly secrets set SUPABASE_URL=https://xxxx.supabase.co SUPABASE_ANON_KEY=eyJ...
```

Når de to secrets er sat, viser loginsiden knapperne automatisk. Uden dem bruges navn + adgangskode.

## Nyttige kommandoer

```bash
fly logs                 # se hvad serveren skriver
fly status               # er maskinen oppe?
fly ssh console          # log ind på maskinen
fly deploy               # udgiv en ny version
```

## Backup og gendannelse

Serveren tager selv en backup hver dag af `/data/hutel-db.json` (pakket som `.json.gz` i `/data/backups/`) og gemmer de seneste 14 dage. Admin-panellet viser tidspunktet for den seneste. Er datafilen ødelagt, når serveren starter, starter den automatisk fra den nyeste backup og sender en alarm.

```bash
# Se backups
fly ssh console -a hutel -C "sh -c 'cd /app/apps/server && node_modules/.bin/tsx src/restore.ts --list'"
# Tag en backup lige nu (fx før en stor opdatering)
fly ssh console -a hutel -C "sh -c 'cd /app/apps/server && node_modules/.bin/tsx src/restore.ts --now'"
# Gendan: læg den klar og genstart – den nuværende fil gemmes som hutel-db.json.before-restore-…
fly ssh console -a hutel -C "sh -c 'cd /app/apps/server && node_modules/.bin/tsx src/restore.ts hutel-db-2026-11-08.json.gz'"
fly apps restart hutel
# Hent en kopi ned på din egen computer
fly ssh sftp get /data/backups/hutel-db-2026-11-08.json.gz -a hutel
```

Junior: samme kommandoer med `-a lobbi-junior`.

## Fejlrapporter (Sentry)

Slået fra, indtil der er en nøgle. Opret en gratis konto på sentry.io (vælg EU som region) og to projekter: "Node" til serveren og "Browser JavaScript" til spillet. Så:

```bash
fly secrets set SENTRY_DSN=<server-dsn> SENTRY_DSN_BROWSER=<browser-dsn> -a hutel
```

Der sendes en alarm, hvis nogen tjener over 3.000 mønter på en time, eller hvis datafilen var ødelagt.

## Lobbi Junior på junior.lobbi.dk

DNS er sat op hos Simply (`junior` → CNAME `lobbi-junior.fly.dev`). Gør det i denne rækkefølge:

```bash
fly certs add junior.lobbi.dk -a lobbi-junior
fly certs show junior.lobbi.dk -a lobbi-junior   # vent til der står "Issued"
git pull && fly deploy -c fly.junior.toml
```

Efter deployet sendes besøgende på lobbi-junior.fly.dev videre til junior.lobbi.dk, og links i forældre-mails bruger den nye adresse.
