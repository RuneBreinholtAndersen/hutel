# Lobbi.dk (tidligere Hutel) – plan

Status opdateres løbende. Åbne punkter står øverst, færdige punkter (✅) står nederst.

Sidst opdateret: 6. november 2026. Rækkefølge: voksen-Hutel i lukket beta først, derefter Hutel Junior.

---

## Det skal Rune gøre selv

- [ ] Opret et privat, tomt GitHub-repo `hutel` (ingen README, .gitignore eller licens), så koden kan skubbes op
- [ ] Hjemmesiden på lobbi.dk: upload `apps/site/dist` til `public_html/` hos Simply (FTPS) – eller lav en SSH-nøgle, læg den offentlige del i Simply → SSH Keys og den private som GitHub-secret `SIMPLY_SSH_KEY`, så deployer den selv
- [ ] DNS: peg `spil.lobbi.dk` på Fly (`fly certs add spil.lobbi.dk` og en CNAME til hutel.fly.dev), og sæt GitHub-variablen `PUBLIC_PLAY_URL=https://spil.lobbi.dk`
- [ ] Få vilkår og privatlivspolitik på lobbi.dk gennemlæst før lancering
- [ ] Opret et Supabase-projekt i EU-region og slå login med e-mail, Google og Facebook til (se `docs/DEPLOY.md` → "Login med e-mail, Google og Facebook")
- [ ] Sæt `SUPABASE_URL` og `SUPABASE_ANON_KEY` som Fly-secrets og deploy igen
- [ ] Facebook-login (sat på pause): opret Meta-app, indsæt App ID/Secret i Supabase, og sæt `AUTH_PROVIDERS=google,facebook`
- [ ] Sæt dig selv som admin: `fly secrets set ADMIN_NAMES=rune` (log ind med Google med totrinsbekræftelse)
- [ ] Før lancering: slå "Start forfra" fra med `fly secrets set ALLOW_RESET=false`
- [ ] Udgiv Google-login for alle (kræver hutel.dk og en side med privatlivspolitik) – indtil da: tilføj beta-testere som testbrugere i Google Cloud → Audience
- ✅ Supabase-projekt `hutel` oprettet (gratis org "Hutel", EU/Irland), redirect-URL'er sat
- ✅ Google-login sat op (Google Cloud-projekt `hutel-513915`) og slået til i Supabase
- [ ] Opret konto hos Fly.io og følg `docs/DEPLOY.md` (Vercel er ikke nødvendigt – serveren leverer også spillet)
- [ ] Opret en Anthropic API-nøgle til AI-beboerne og læg den i serverens secrets som `ANTHROPIC_API_KEY`

---

## Færdigt 6. november (eftermiddag)

- ✅ Butikken er delt i kategorier (siddepladser, borde, seng og bad, køkken, lys og lyd, pynt, væg, spil, tapet og gulv, inventar) med søgefelt
- ✅ Rum-spil med møbler: Spilkonsol + Farvekamp (to hold farver felter, 60 sek) og Kapløb (fra startfelt til målfelt); serveren styrer reglerne, mønter kun når mindst to spiller med
- ✅ Navigator åbner altid på Populære; kategorier viser alle åbne rum i kategorien
- ✅ Døre i lejligheden: stuen har en dør til hvert af dine andre rum, de andre rum en dør tilbage; gå ind ad døren (klik eller piletaster) for at komme ind
- ✅ Profil som hjemmeside: level, online, kæledyr, venner, værelser, motto og gæstebog (ejer, skribent og moderatorer kan slette)
- ✅ Teleportere: købes i par (lv 2); den ene placeres, tvillingen ryger i inventaret og kan stilles i et andet rum eller byttes til en ven
- ✅ Marked: sæt ting fra inventaret til salg, køb fra andre også når sælger er offline, 5 % gebyr, alle salg logges
- ✅ Trapper og platforme: hæv/sænk felter 0–3 trin i byggetilstand; man går ét trin ad gangen, møbler står vandret
- ✅ Navigator: søgning (rum og ejere), kategorier (fest, chill, spil, handel), favoritter ⭐ og "populære lige nu"
- ✅ Byg om: egne rum kan være 7×7 til 12×12 og have form som kvadrat, bred, L, spejlet L eller U; møbler der ikke passer lægges i inventaret
- ✅ Kæledyr: hund, kat og drage (lv 4) der følger dig, kan fodres, lærer tricks (sæt dig, hop, rul, tig, dans) og stiger i level; svarer når man siger deres navn
- ✅ Opdateringer uden afbrydelse: kort genforbindelse uden besked, tilbage i samme rum og på samme felt; ny version vises som knap med "Se nyt" (kun tvungen opdatering når PROTOCOL_VERSION ændres); "Nyt i Hutel" én gang efter opdatering (noter i packages/shared/src/releases.ts)
- ✅ Lyd (Web Audio, alt lavet i kode): lydeffekter, 🔊-panel med lydstyrke og til/fra (gemmes i browseren), jukebox med 6 melodier synkroniseret til serverens ur og afstandsafhængig lydstyrke
- ✅ Vejlednings-film på spilkonsollen ("Se hvordan det virker") tegnet live på canvas
- ✅ Døre bruges kun, når man klikker på dem eller går ind i væggen – ikke når man bare stopper foran
- ✅ Placering gemmes hvert 5. sekund, så man efter deploy/genstart står samme sted (op til 15 min); hurtigere genforbindelse (maks. 4 sek mellem forsøg)
- ✅ Socialt: råb (`:shout`, 20 sek cooldown på serveren), chatbobler (låses op via level/badges, tjekkes på serveren), emotes, nye handlinger (kram, high-five, sov, tænk, sid på gulvet), "må ikke følges", relationer på profilen, opslagstavle med post-its som ejeren godkender (filtreres som chat)
- ✅ Figur: nyt tøj (kjole, dunjakke, baret, solhat, sko, tilbehør) med farvevalg, 5 gemte outfits, effekter (skygge, skær, stjernestøv, festaura), bære ting fra diske/maskiner og give dem væk (forsvinder efter 10 min); badekar-stilling rettet
- ✅ Højttaler-knappen slår al lyd til/fra med ét klik (rød streg når slået fra); lydstyrke og effekter/musik under Figur → Lydindstillinger
- ✅ Biograf (YouTube via youtube-nocookie-indlejring, video-id valideres på serveren, start-tid synkroniseres; spærret når HUTEL_JUNIOR=true) og Sneboldkamp (server styrer rækkevidde, ammo, cooldown og frys)
- ✅ Navneskift i brugerfladen: Hutel → Lobbi (lobbi.dk købt). Tekniske navne (`@hutel/*`, Fly-app, localStorage) er uændrede
- ✅ Lyd: slå lyd fra i én fane slår den også fra i andre åbne Lobbi-faner
- ✅ Hjemmeside lobbi.dk i Astro (`apps/site`): levende lobby i hero, figur-bygger, hotel-oversigt, sikkerhed, nyheder fra RELEASE_NOTES, Sådan spiller du, Spørgsmål, Vilkår/Privatliv (kladder), 404, .htaccess; deploy-workflow til Simply via SSH-nøgle
- ✅ Tapet (8 slags) og gulve (8 slags): købes én gang og bruges i alle egne rum
- ✅ Vægmøbler: maleri, stort maleri, plakat, vindue, væghylde, vægur, spejl og neonskilt (hænges på bag- eller venstrevæg)
- ✅ Lobbyen og caféen er nu 12×12 med ny møblering; rumstørrelse kan variere pr. rum
- ✅ Højst 25 gæster pr. rum; navigatoren viser 3/25 og "Fyldt"
- ✅ Hvisken i rummet (/h navn eller 🤫 på profilen) og messenger til venner med beskeder, der venter til de logger ind, og ulæst-tæller
- ✅ /penge: snydekode for admins (+100 mønter, logges)
- ✅ Caféen: bordet midt i rummet er fjernet, så der er fri passage
- ✅ Min lejlighed: køb soveværelse (lv 3), badeværelse (lv 4), køkken (lv 5) og altan (lv 6) med egne temaer og møbler (badekar, håndvask, køkkenbord, køleskab, grill, natbord)
- ✅ Efter genforbindelse eller opdatering kommer man tilbage til det rum, man var i (inden for 15 min)
- ✅ Interaktive møbler: klik for at tænde/slukke lamper, pejs og jukebox; fjernsynet har 3 kanaler (Hutel Nyt, Fiskekanalen, Hutel FM); læg dig i sengen og på liggestole
- ✅ Level efter navnet (XP for tid, opgaver og badges) med XP-bjælke under Figur
- ✅ Byttehandel: inventar (📦 Gem i inventar under Byg), byt mønter, møbler og tøj med en anden i samme rum – begge skal godkende, alt logges
- ✅ Tre nye offentlige rum: Tagterrassen (Viggo), Spillehallen (Sofus) og Poolen (Freja)
- ✅ Små spil: /terning, /ssp sten|saks|papir, /quiz (højst 20 mønter om dagen fra spil), /hjælp
- ✅ Ugentlige events (fredagsfest, stjerneaften, poolparty, søndagsquiz): dobbelt mønter, banner og eget badge efter 5 min
- ✅ Moderation: admin-rolle (ADMIN_NAMES), sager med chatlog, advar/pause/send hjem/udeluk, start eget event, alt logges
- ✅ Tøjbutik under Figur: overdele (stribet, hættetrøje, skjorte+slips, læderjakke, smoking) og hatte (hue, cowboy, høj hat, krone) – nogle låst op af badges
- ✅ Møbler låst op af badges (sækkestol, fjernsyn, pejs, klaver, jukebox) + spisestol og kaktus; farvevalg på møbler (🎨 / F)
- ✅ Navigatoren hænger ikke længere på "Henter rum…" (egen grænse, husker sidste liste, prøver igen)
- ✅ Dagens opgaver: "kig forbi" + 2 skiftende hver dag (dansk midnat), +10 bonus, 🔥 stime og badge "Trofast gæst" ved 7 dage
- ✅ Hotel-opgaver efter startopgaverne: lobby, Ida, akvariet, kaffe hos Luna, sæt dig i caféen, hils på en rigtig gæst – badge "Hotelkender" + 25 mønter; Ida/Luna giver tips
- ✅ Testknap "Start forfra" under Figur: nulstiller mønter, opgaver, badges og værelse
- ✅ Magnus 🤖 står på nye gæsters værelse og guider gennem startopgaverne, siger farvel og går, når de er klaret
- ✅ Piletaster går frit og flydende som i prototypen (ikke felt for felt); serveren tjekker fart, vægge og møbler
- ✅ Egen figur går med det samme (klienten forudser stien, serveren bekræfter bagefter) – også med piletaster
- ✅ Login med e-mail-link, Google og Facebook via Supabase (`/api/config`, `/api/session`), slås til med to secrets
- ✅ Første login med Google/Facebook/e-mail beder om navn, figur, 18+ og vilkår
- ✅ Navn + adgangskode virker stadig for eksisterende beta-konti

---

## Hutel Junior (børneudgave, 8–12 år)

Samme kodebase og grafik som Hutel, men en helt separat verden for børn. Børn og voksne mødes aldrig.

**Adskillelse**

- [ ] `EDITION=adult|junior` styrer regler, tekster og funktioner i både klient og server
- [ ] Junior kører på egen server og egen database (fx `junior.hutel.dk`), så ingen data eller rum deles med voksen-Hutel

**Sikker chat**

- [ ] Menu-chat: kategorier med færdige sætninger (hilsner, spørgsmål, ros, leg, følelser) og emojis – standard for alle børn
- [ ] Ordliste-chat: kun godkendte ord, tal og specialtegn spærret – kan slås til af en forælder (fx fra 10 år)
- [ ] Ingen fri chat og ingen private beskeder med fremmede
- [ ] Serveren afviser al tekst, der ikke er en godkendt sætning eller består af godkendte ord

**Forældre**

- [ ] Forældrekonto med e-mail-bekræftelse og samtykke (krav for børn under 13 år i Danmark)
- [ ] Forælderen opretter barnets figur og vælger chatniveau
- [ ] Forældreoverblik: venner, tid online, rapporter, og mulighed for at slette barnets data
- [ ] Barnet logger ind med en kode/QR fra forælderens konto – intet barns e-mail eller fulde navn

**Venner og leg**

- [ ] Venner kun via vennekode, som børn giver hinanden i virkeligheden, eller godkendt af forælderen
- [ ] Navne vælges fra en liste med sjove kombinationer (fx "Glad Odder 12"), så ingen skriver deres rigtige navn
- [ ] Opgaver, mønter, værelser og butik som i Hutel – men ingen rigtige penge uden forælderens godkendelse
- [ ] AI-beboere svarer kun med faste, godkendte replikker (ingen fri AI-chat med børn)

**Tryghed og regler**

- [ ] Rapportér-knap overalt og moderatorer med hurtig reaktion
- [ ] Spilletid: forælderen kan sætte en daglig grænse og et sengetidspunkt
- [ ] Privatlivspolitik skrevet til både forældre og børn
- [ ] Gennemgå regler for børneapps i App Store (Kids-kategorien) og Google Play (Families) før iOS/Android
- [ ] Ingen reklamer og ingen sporing af børn

---

## Næste: Login, database og deploy

- [ ] `SupabaseStore` der implementerer `Store` (tabeller: users, rooms, room_items, friends, reports, chatlog) med RLS
- [ ] Glemt adgangskode (kræver e-mail – kommer med Supabase-login)
- [ ] Supabase-login (magic link + Google) i stedet for det nuværende navn + adgangskode. Behold 18+ og vilkår ved oprettelse
- [ ] Automatisk sletning af chatlog efter 30 dage i databasen (cron)
- [ ] Første deploy til Fly.io og domænet hutel.dk peget på den (se `docs/DEPLOY.md`)
- [ ] Cloudflare foran klient og server

---

## Mobil og iOS-app

- [x] Spillet virker i mobilens browser: tryk for at gå, træk for at panorere, knib for at zoome, chat i fuld bredde
- [ ] iOS-app med Capacitor (samme kode pakket som app)
- [ ] App Store-krav til chat-apps med brugerindhold: filter, rapportér, blokér og kontaktoplysninger er på plads – mangler moderatorværktøj og hurtig reaktion på rapporter
- [ ] Aldersgrænse i App Store sat til 17+ (chat med fremmede)

---

## Milepæl 4 – Det sociale (resten)

- [ ] Følg en ven direkte via profilen (findes via vennelisten)
- [ ] Ringeklokke på låste værelser: ejeren kan lukke en gæst ind
- [ ] Notifikationer når en ven kommer online

---

## Milepæl 5 – Økonomi og byttehandel

- [ ] Daglig login-bonus og stigende bonus for flere dage i træk
- [ ] Byttehandel mellem spillere med dobbelt bekræftelse
- [ ] Sjældne, tidsbegrænsede møbler i begrænset antal
- [ ] Log over alle handler (mod snyd)

---

## Milepæl 6 – Events, minispil og flere rum

- [ ] Tagterrassen som offentligt rum
- [ ] Elevatoren i lobbyen fører til etagerne
- [ ] Planlagte events med nedtælling i navigatoren
- [ ] Første minispil (fx quiz-aften med en AI-vært)
- [ ] Sæsonting: julehue, påskeæg osv.
- [ ] Flere frisurer, tøj og tilbehør til figurerne

---

## Milepæl 7 – Moderation og lukket beta

- [ ] Moderator-side: se rapporter med chat-kontekst, advar, smid ud, udeluk (felterne `role` og `bannedUntil` findes allerede)
- [ ] AI-hjælp til at markere problematiske beskeder til en moderator
- [ ] Endelige vilkår og privatlivspolitik (der er en kladde i tilmeldingen)
- [ ] Lukket beta for venner og familie
- [ ] Simpel statistik: antal online, aktive pr. dag

---

## Sikkerhed før offentlig lancering

- [ ] Gennemgå RLS-politikker i Supabase
- [ ] Cloudflare foran klient og server
- [ ] Sentry og alarmer sat op
- [ ] Gendannelse fra backup afprøvet
- [ ] Ekstern sikkerhedstest (pentest) eller gennemgang af en sikkerhedskyndig
- [ ] `security.txt` med kontakt til at indberette sikkerhedshuller

---

## Milepæl 8 – Betaling (senere)

- [ ] VIP-medlemskab pr. måned med eksklusive møbler, tøj og flere værelser
- [ ] Køb af mønter med Stripe
- [ ] Moms, kvitteringer og forbrugerregler (fortrydelsesret ved digitale varer)

---

## Færdigt ✅

### Multiplayer-fundament

- ✅ Realtidsserver (WebSocket) med rum: Lobbyen, Caféen og et eget værelse til hver gæst
- ✅ Gæstelogin med navn, figur, 18+-bekræftelse og vilkår (kladde)
- ✅ Serveren bestemmer al bevægelse (pathfinding på serveren), klient og server regner positioner ens
- ✅ Gå med klik og piletaster/WASD, løb med Shift, sid i sofaer og stole
- ✅ Chat med talebobler og chatlog, ordfilter og rate limit
- ✅ Vink og dans
- ✅ Automatisk genforbindelse ved netværksudfald, og kun én aktiv session pr. bruger
- ✅ Testet med to browsere samtidig (desktop og mobil) i samme lobby

### Værelser og navigator

- ✅ Startmøbler på eget værelse, gemt på serveren
- ✅ Byg: flyt, rotér og sælg møbler – serveren tjekker rettigheder og placering
- ✅ Butik med mønter (trækkes på serveren)
- ✅ Adgang: åbent, låst eller adgangskode
- ✅ Byggerettigheder til andre gæster
- ✅ Navigator med offentlige rum, værelser med gæster og venners værelser
- ✅ Døren åbner navigatoren, når startopgaverne er klaret

### Opgaver, mønter og badges

- ✅ 6 startopgaver på serveren med mønter, konfetti og oplåsning af døren
- ✅ 1 mønt pr. minut online (beregnet på serveren)
- ✅ Badges: Ny gæst, Klar til hotellet, Stamgæst, Fast inventar, Social sommerfugl, Shoppinglysten, Indretningsarkitekt, Snakkesalig

### Det sociale

- ✅ Venneliste med anmodninger og online-status samt hvilket rum vennen er i
- ✅ Private beskeder til venner (`/w navn besked`)
- ✅ Profilkort med motto, badges og knapper (tilføj ven, skriv, rettigheder, blokér, rapportér)
- ✅ Blokér (man ser ikke længere personens beskeder) og rapportér (gemmes med de seneste 20 chatlinjer)

### AI-beboere

- ✅ Ida (reception) og Magnus i lobbyen, Luna (café) og Oskar i caféen
- ✅ Tydelig 🤖-markering og egen profil, der siger at de er AI
- ✅ Byder nye gæster velkommen, svarer når de bliver nævnt, småsnakker en gang imellem
- ✅ Bruger Anthropic API når `ANTHROPIC_API_KEY` er sat, ellers faste replikker. Dagligt loft og rate limit

### Sikkerhed indbygget

- ✅ Alle klientbeskeder valideres med zod, ukendte beskeder afvises, gentagne forsøg lukker forbindelsen
- ✅ Rate limits på bevægelse, chat, byg og sociale handlinger, samt på tilmeldinger pr. IP
- ✅ Chattekst vises altid som ren tekst (ingen HTML)
- ✅ Tokens og adgangskoder gemmes kun som hash
- ✅ WebSocket-forbindelser kun fra tilladte domæner, maks. beskedstørrelse 4 KB
- ✅ Chatlog slettes efter 30 dage

### Login og lukket beta

- ✅ Konto med navn og adgangskode (scrypt-hash), så man kan logge ind på alle enheder
- ✅ Login med rate limit (10 forsøg pr. kvarter pr. IP og navn); nyt login logger andre enheder ud
- ✅ Invitationskoder (`BETA_INVITE_CODES`) – uden gyldig kode kan man ikke oprette sig

### Klar til deploy

- ✅ Dockerfile: én container der kører serveren og leverer den byggede klient
- ✅ `fly.toml` med volume til data, health check og HTTPS
- ✅ Trin-for-trin guide i `docs/DEPLOY.md`
- ✅ PWA: manifest og ikoner, så Hutel kan lægges på hjemmeskærmen
- ✅ Testet i produktionstilstand (server leverer klienten, tilmelding og rum virker)

### Milepæl 0

- ✅ Monorepo med pnpm workspaces: `apps/client`, `apps/server`, `packages/shared`
- ✅ TypeScript strict, ESLint, Prettier, Vitest (23 tests)
- ✅ GitHub Actions: lint, typecheck, test, build og sikkerhedstjek af afhængigheder
- ✅ README og `.env.example`

### Prototypen

- ✅ Isometrisk 3D-rum med varmt lys, bloom og afrundede møbler
- ✅ Figurer i animationsfilm-stil med frisurer, briller, skæg og farver
