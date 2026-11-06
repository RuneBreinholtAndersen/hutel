# Hutel.dk – plan for multiplayer-udgaven

Status opdateres løbende. Åbne punkter står øverst, færdige punkter (✅) står nederst.

---

## Det skal Rune gøre selv (før/under Milepæl 0)

- [ ] Registrér domænet **hutel.dk** (ledigt hos Simply pr. 6. nov. 2026)
- [ ] Opret et privat GitHub-repo `hutel` og læg denne startpakke i det
- [ ] Opret et Supabase-projekt i EU-region og giv Claude Code URL + anon key + service role key via `.env`
- [ ] Opret konto hos Fly.io (eller Hetzner) til realtidsserveren
- [ ] Forbind repoet til Vercel til klienten
- [ ] Opret en Anthropic API-nøgle til AI-beboerne (bruges først i Milepæl 3)

---

## Milepæl 0 – Opsætning ✅

Færdig: `pnpm dev` starter klient og server, og klienten viser, at serveren svarer på `/health`. Se punkterne under "Færdigt" nederst.

---

## Milepæl 1 – Fundament: to mennesker i samme lobby

- [ ] Port prototypen til moduler i `apps/client`: renderer, lys, rum, møbler, figurer, input, UI
- [ ] Flyt møbelkatalog og placeringsregler til `packages/shared` (med tests). Pathfinding er allerede flyttet
- [ ] Login med Supabase (magic link + Google), 18+-bekræftelse, vilkår og privatlivspolitik (kladder)
- [ ] Tabeller: `profiles` (navn, look, mønter, online-tid), med RLS
- [ ] Figur-editor gemmer look i `profiles`
- [ ] Colyseus-rummet `lobby`: join med JWT, liste over spillere med position og look
- [ ] Bevægelse: klik og piletaster sender intention, serveren validerer og synkroniserer. Shift = løb
- [ ] Siddepladser synkroniseret (sofa, lænestol)
- [ ] Chat med talebobler: maks. 120 tegn, rate limit, ordfilter
- [ ] Online-tid giver 1 mønt pr. minut, beregnet på serveren
- [ ] Genforbindelse ved netværksudfald

**Færdig når:** Rune og Tina kan logge ind fra hver deres computer, se hinandens figurer gå rundt i lobbyen og chatte.

---

## Milepæl 2 – Egne værelser og navigator

- [ ] Tabeller: `rooms` (ejer, navn, beskrivelse, adgang), `room_items` (møbler og placering), `inventory`
- [ ] Hver ny bruger får et værelse med startmøbler
- [ ] Startopgaverne (de 6 fra prototypen) på serveren, med konfetti og oplåsning af døren
- [ ] Byggetilstand synkroniseret: flyt, rotér, sælg. Serveren tjekker rettigheder og placering
- [ ] Butik: køb møbler for mønter (serveren trækker mønterne)
- [ ] Adgang til værelser: åbent, ringeklokke (ejeren lukker ind) eller adgangskode
- [ ] Rettigheder: ejeren kan give venner lov til at flytte møbler
- [ ] **Navigatoren**: offentlige rum (Lobby, Café, Tagterrasse) og brugernes værelser, sorteret efter antal besøgende, plus søgning
- [ ] Døre og elevator flytter én mellem rum

**Færdig når:** man kan besøge hinandens værelser via navigatoren, og indretning bliver gemt.

---

## Milepæl 3 – AI-beboere

- [ ] Bot-spillere på serveren, der joiner rum som almindelige spillere
- [ ] 4–6 faste personligheder (fx receptionisten Ida i lobbyen, Magnus der hilser på nye, en caféejer)
- [ ] Svar via Anthropic API med kort systemprompt, dansk, venlig tone, inden for Hutels univers
- [ ] Tydelig 🤖-markering ved navn og i profil
- [ ] Rate limit pr. bot, dagligt loft over API-forbrug, fallback til faste replikker
- [ ] Bots byder nye spillere velkommen og hjælper med startopgaverne

**Færdig når:** hotellet føles levende, også når der kun er én rigtig spiller online.

---

## Milepæl 4 – Det sociale

- [ ] Venneliste med anmodninger og online-status
- [ ] Private beskeder mellem venner
- [ ] Profilkort: figur, motto, badges, hvornår man startede
- [ ] Badges og præstationer (fx "100 timer online", "Første værelse", "Social sommerfugl")
- [ ] Følg en ven ind i det rum, vedkommende er i
- [ ] Handlinger: vink, dans, sid, smil

---

## Milepæl 5 – Økonomi og byttehandel

- [ ] Daglig login-bonus og stigende bonus for flere dage i træk
- [ ] Byttehandel mellem spillere med dobbelt bekræftelse (begge skal godkende)
- [ ] Sjældne, tidsbegrænsede møbler i begrænset antal
- [ ] Log over alle handler (mod snyd)

---

## Milepæl 6 – Events og minispil

- [ ] Café og tagterrasse som offentlige rum
- [ ] Planlagte events med nedtælling i navigatoren (chataftener, temaaftener)
- [ ] Første minispil (fx snebold-kamp eller quiz-aften med en AI-vært)
- [ ] Sæsonting: julehue, påskeæg osv.

---

## Milepæl 7 – Moderation og lukket beta

- [ ] Rapportér, blokér og gør tavs
- [ ] Moderator-rolle: advar, smid ud af rum, udeluk midlertidigt eller permanent
- [ ] Automatisk filter + AI-hjælp til at markere problematiske beskeder til en moderator
- [ ] Sletning af chatlog efter 30 dage
- [ ] Endelige vilkår og privatlivspolitik
- [ ] Lukket beta for venner og familie
- [ ] Simpel statistik: antal online, aktive pr. dag

---

## Sikkerhed før offentlig lancering

- [ ] Gennemgå alle servermeddelelser: skema-validering og rate limits
- [ ] Test af snyd: forsøg at teleportere, give sig selv mønter, dublere møbler og placere møbler i andres værelser
- [ ] Gennemgå RLS-politikker i Supabase
- [ ] Cloudflare foran klient og server (beskyttelse mod overbelastningsangreb)
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

## Færdigt: Milepæl 0 ✅

- ✅ Monorepo med pnpm workspaces: `apps/client`, `apps/server`, `packages/shared`
- ✅ TypeScript strict, ESLint, Prettier, Vitest
- ✅ `.env.example` og `.gitignore`
- ✅ `pnpm dev` starter klient og server samtidig
- ✅ GitHub Actions: lint, typecheck, test, build og sikkerhedstjek af afhængigheder
- ✅ README med kom-i-gang
- ✅ Pathfinding flyttet til `packages/shared` med tests (forskud på Milepæl 1)

---

## Allerede lavet i prototypen ✅

- ✅ Isometrisk 3D-værelse med varmt lys, bloom og afrundede møbler
- ✅ Figurer i animationsfilm-stil med frisurer, briller, skæg og farver
- ✅ Gå med klik og piletaster/WASD, løb med Shift
- ✅ Sid i sofa og lænestol
- ✅ Chat med talebobler og chatlog
- ✅ Byggetilstand: flyt, rotér og sælg møbler
- ✅ Møbelbutik med mønter
- ✅ 6 startopgaver med mønter, konfetti og oplåsning af døren
- ✅ 1 mønt pr. minut online
- ✅ Dør til lobbyen med reception, elevator ("snart") og receptionisten Ida
