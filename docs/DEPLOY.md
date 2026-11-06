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
