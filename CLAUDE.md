# CLAUDE.md – Hutel.dk

Hutel er et socialt chat-spil i browseren: man laver sin egen figur, går rundt i et hotel i varm 3D-stil, chatter i talebobler, indretter sit eget værelse, tjener mønter og møder andre – både rigtige mennesker og tydeligt markerede AI-beboere.

Ejer: Rune Breinholt Andersen (Breinholt Digital). Al kommunikation med Rune foregår på **dansk**. Kode, variabelnavne og commit-beskeder skrives på engelsk. Al tekst i brugerfladen er på dansk.

Målgruppe: voksne (18+), der kan lide hyggelige, sociale onlineverdener.

## Læs først

- `docs/PLAN.md` – milepæle og tjekliste. Opdatér den, når en opgave er færdig (✅), og hold åbne punkter øverst.
- `prototype/index.html` – den fungerende enkeltspiller-prototype. Den er facitlisten for udseende, figurer, møbler, lys og stemning. Port koden herfra i stedet for at opfinde en ny stil.

## Arkitektur

Monorepo med pnpm workspaces:

```
apps/
  client/     Vite + TypeScript + Three.js  (spillet i browseren)
  server/     Node + TypeScript + Colyseus  (realtid, rum, spillogik, AI-beboere)
packages/
  shared/     Fælles typer, møbelkatalog, konstanter, pathfinding, chat-filter
supabase/
  migrations/ SQL-migrationer (tabeller, RLS-politikker)
docs/
```

- **Login og database:** Supabase (EU-region af hensyn til GDPR). Login med e-mail (magic link) og Google.
- **Realtid:** Colyseus. Hvert hotelrum (lobby, café, brugerværelse) er ét Colyseus-rum. Klienten forbinder med Supabase-JWT, som serveren verificerer, før man kan joine.
- **Hosting:** klient på Vercel (`hutel.dk`), server i Docker på Fly.io eller Hetzner (`wss://play.hutel.dk`), database på Supabase.
- **AI-beboere:** kører på serveren som "bot-spillere" og bruger Anthropic API (en billig, hurtig model). Se afsnittet om AI-beboere.

## Gyldne regler

1. **Serveren bestemmer.** Klienten sender kun intentioner ("gå til felt 4,2", "sig hej", "sæt dig", "flyt møbel"). Serveren validerer (pathfinding, rettigheder, mønter) og sender den sande tilstand ud. Mønter, køb, opgaver og online-tid beregnes kun på serveren.
2. **Fælles logik i `packages/shared`.** Grid, pathfinding, møbelkatalog (størrelse, pris, siddeplads) og chat-regler deles mellem klient og server, så de aldrig er uenige.
3. **Små skridt.** Byg én milepæl ad gangen. Hver milepæl skal kunne køres og testes, før den næste startes. Lav små commits.
4. **Ingen hemmeligheder i git.** Nøgler ligger i `.env` (som er i `.gitignore`) og i hostingens secrets. Lav en `.env.example` med tomme felter.
5. **Spørg Rune** før du opretter eksterne konti, tilføjer betalte tjenester, ændrer domæner/DNS eller sletter data.

## Visuel stil (fra prototypen)

- Isometrisk, fast ortografisk kamera, varmt solnedgangslys, bløde skygger, glød (bloom) fra lamper og vinduer, svagt blåligt baglys.
- Figurer bygges i kode: stort hoved, store øjne med iris, pupil og glimt, blinken, runde former, squash-and-stretch når de går. Valg: hud, hår (frisurer), øjne, trøje, bukser, briller og skæg. Nye valg tilføjes som nye dele, ikke som billeder.
- Møbler bygges i kode med afrundede kanter (`rbox`).
- **Farverum:** alle hex-farver skal konverteres med `convertSRGBToLinear()` (se `lin()` i prototypen), ellers bliver alt vasket ud. Renderer bruger sRGB-output, ACES tone mapping og bloom med gamma-korrektion til sidst.
- Brugerfladen: mørkebrune, halvgennemsigtige paneler, cremehvid tekst, orange accent (`#ffb347`), skrifttypen Fredoka.

## Sikkerhed (gælder i alle milepæle)

- **Stol aldrig på klienten.** Alle beskeder fra klienten valideres på serveren med et skema (zod): type, længde og gyldige værdier. Ukendte beskeder afvises.
- **Rate limits** pr. forbindelse og pr. bruger på bevægelse, chat, køb og byttehandel. Store eller hyppige beskeder lukker forbindelsen.
- **Chattekst vises altid med `textContent`**, aldrig som HTML, så ingen kan indsprøjte kode (XSS).
- **Supabase:** Row Level Security på alle tabeller. Service role-nøglen bruges kun på serveren og må aldrig ligge i klienten.
- **Økonomi og byttehandel** kører i databasetransaktioner, så mønter og møbler ikke kan dubleres eller forsvinde. Alle handler og køb logges.
- **AI-beboere** har ingen rettigheder ud over at gå og chatte. Brugere kan forsøge at manipulere dem med beskeder (prompt injection), så deres svar sendes gennem samme filter som menneskers, og de kan aldrig give mønter, møbler eller rettigheder.
- **Betaling** (senere): kun via Stripe Checkout, og køb godkendes kun via Stripe-webhooks med verificeret signatur.
- **Afhængigheder:** Dependabot og `pnpm audit` i CI.
- **Logging og overvågning:** fejl til Sentry, alarm ved usædvanlig aktivitet (mange mønter på kort tid, mange forbindelser fra samme IP).
- **Admin og moderatorer** logger ind med to-faktor-godkendelse.
- **Backup:** daglig backup af databasen, og gendannelse er afprøvet mindst én gang før lancering.

## Juridisk og etisk

- Hutel er inspireret af klassiske hotel-chatspil, men **må ikke kopiere** andre spils navne, logoer, grafik, møbeldesign, figurer eller lyde. Alt skal være Hutels eget.
- Ingen henvisninger til andre spil eller chats i AI-beboernes replikker.
- AI-beboere skal altid være tydeligt markeret som AI (🤖 ved navnet og i profilen). De må aldrig påstå at være mennesker.
- Brugere skal bekræfte, at de er 18+, og acceptere vilkår og privatlivspolitik ved oprettelse.
- Chatbeskeder gemmes kun så længe, det er nødvendigt for moderation (standard: 30 dage) og slettes derefter automatisk.

## AI-beboere

- Defineres i `apps/server/src/bots/personas.ts`: navn, udseende, personlighed, hvilke rum de bor i, døgnrytme.
- De går rundt, sætter sig og skriver af og til i chatten. De svarer, når nogen skriver til dem, eller når der er stille i rummet.
- Begrænsninger: maks. antal beskeder pr. minut pr. bot, et dagligt loft over API-forbruget (konfigurerbart), korte svar (maks. ca. 120 tegn), samme chat-filter som mennesker, og et systemprompt der holder dem venlige, på dansk og inden for Hutels univers.
- Hvis API'et fejler eller loftet er nået, falder de tilbage på faste replikker.

## Kommandoer

```
pnpm install
pnpm dev            # klient (5173) + server (2567) lokalt
pnpm test           # vitest
pnpm lint           # eslint
pnpm typecheck
pnpm build
```

## Test

- Fælles logik (pathfinding, placering af møbler, økonomi) har unit tests i `packages/shared`.
- Serverens rum-logik testes med Colyseus' testværktøjer.
- Før en milepæl meldes færdig: start klient og server lokalt, åbn to browservinduer med to forskellige brugere, og tjek at de ser hinanden.
