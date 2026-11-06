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

## Backup af data (indtil Supabase)

```bash
fly ssh sftp get /data/hutel-db.json ./backup-$(date +%F).json
```

Tag en backup før hver større opdatering.
