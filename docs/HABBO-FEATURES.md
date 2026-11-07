# Lobbi vs. Habbo – det der mangler, og hvad der giver mening

Listen sammenligner Lobbi (tidligere Hutel) med de klassiske funktioner fra Habbo Hotel. Navne, grafik og møbler kopieres ikke: vi laver vores egen version af idéen.

_Senest opdateret: 7. november 2026 (slet egen konto og admin-brugerliste)._

**Sådan læses den**
- **Værdi**: hvor meget det betyder for spillerne (★–★★★)
- **Indsats**: hvor stor opgaven er med vores teknik i dag (S = en aften, M = 1–3 dage, L = en uge+)
- 🤖 = noget AI gør nemmere end i 2004 (AI-beboere, moderation, generering)

---

## 🔜 Anbefalet rækkefølge (åbne punkter)

Det her mener jeg giver mest spil for pengene, i den rækkefølge:

- [ ] **1. Flere rum-spil** – stoleleg (Farvekamp, Kapløb og Sneboldkamp findes). ★★ · M
- [ ] **2. Wired light: møbler der reagerer** – trykplader, "når nogen går her → tænd lampe / teleportér / sig noget". Giver brugerne mulighed for at bygge deres egne spil. ★★★ · L
- [ ] **3. Grupper/klubber** – navn, logo-generator (vores egen), medlemsliste, gruppe-rum, gruppe-badge ved navnet. ★★ · M
- [ ] **4. Sjældne møbler ("rares")** – begrænsede møbler, der kun sælges en uge eller i et bestemt antal, med serienummer. Driver byttehandel. ★★★ · S (vi har allerede bytte + inventar)
- [ ] **5. Mobil-kontroller** – tryk-for-at-gå er der, men knapper og paneler skal tilpasses små skærme. ★★★ · M
- [ ] **6. Lobbi Junior, resten** – forældreoverblik, ordliste-chat og spilletid; vælg mail-tjeneste og få vilkårene læst juridisk igennem (se PLAN.md). ★★★ · M

## 💡 Habbo-funktioner vi mangler (fuld liste)

### Chat og socialt
- [ ] **Offline-meddelelser til grupper** – venter på punkt 3 (Grupper/klubber), så der er nogen at sende til. M

### Rum og byggeri
- [ ] **Gulvplan-editor** – tegn selv gulvets form, højde, dørens placering. L
- [ ] **Stable møbler** (højde/z-akse) – sætte ting oven på hinanden, hylder på væggen. M–L
- [ ] **Rum-indstillinger** – maks. antal gæster, hvem må tale, "kun venner", forbudt-liste. S
- [ ] **Rum-vurdering** – 👍 til rum, "top-rum" i navigatoren (kategorier og søgning findes). S
- [ ] **Rotér/flyt flere ting på én gang**, "fortryd". M
- [ ] **Byggeklodser** – fleksible blokke man kan farve og stable (vores egen variant). M

### Økonomi og ting
- [ ] **Gave-indpakning** – køb en ting som gave til en ven med en lille besked. S
- [ ] **Lykkehjul / gratis gave dagligt** – daglig belønning ud over opgaver. S
- [ ] **Møbel-sæt** – køb et helt tema samlet (fx "Strandsæt"). S
- [ ] **Ting med funktion** – dispenser (giver en drink i hånden), terning-møbel, ur, lyskæder. M
- [ ] **Indløs mønter i ting ("crackables")** – se ting man kan "knække" for en overraskelse. Pas på det ikke bliver gambling for børn. M
- [ ] **Betalt medlemskab (HC-agtigt)** – ekstra tøj, farver, ekstra rum. Kun via Stripe Checkout + webhook. L

### Figur

### Spil og aktiviteter
- [ ] **Stoleleg** – musik, stop, sæt dig; én stol færre hver runde. M
- [ ] **Quiz-shows / "Hvem vil være millionær"-agtigt** med en 🤖-vært. M
- [ ] **Bingo og lotteri med mønter**. S
- [ ] **Skattejagt** på tværs af rum. M
- [ ] **Konkurrencer** – "flotteste værelse" med afstemning og præmie-badge. M

### Moderation og sikkerhed
- [ ] **Hjælpere/guides** – erfarne spillere med en lille rolle, der hjælper nye. M
- [ ] **Ambassadører/moderatorer i rum** – synlig rolle, kan dæmpe én i et rum. S (backend findes)
- [ ] **🤖 AI-forfilter** – AI vurderer rapporter og markerer de vigtigste først (ingen automatiske bans). M
- [ ] **Ord-filter pr. sprog og "safety mode" pr. rum**. S
- [ ] **Sikkerhedsquiz ved oprettelse** (som Habbos "Safety Tips"). S

## 🤖 Ting vi kan gøre bedre end Habbo med AI i dag

- [ ] **AI-beboere med hukommelse** – Ida husker, hvad du sagde i går (gemmes kort tid og kun i spillet). M
- [ ] **AI-vært til events** – starter quiz, kommenterer, uddeler præmier (serveren bestemmer præmierne, ikke AI'en). M
- [ ] **🤖 Rum-generator** – "lav et japansk tehus": AI foreslår møblering ud fra *vores* katalog, ejeren godkender. M
- [ ] **🤖 Møbel-designer** – nye farvevarianter og mønstre genereret i kode, ikke billeder. M
- [ ] **Oversættelse af chat** for internationale versioner senere. S
- [ ] **AI-hjælper til nye** – Magnus findes; han kan blive klogere og forklare alle funktioner. S

## ⚠️ Det jeg ikke anbefaler nu

- **Fri tekst i Junior** – må aldrig slås til (regel i CLAUDE.md).
- **Køb af mønter for rigtige penge før moderation og backup er på plads** – kræver forældre-regler, Stripe, kvitteringer, refusion.
- **Lootboxe/tilfældige betalte præmier** – juridisk gråzone i EU, især for børn.
- **3D-kamera der kan drejes frit** – bryder den klassiske isometriske stil og gør klik-gang sværere.
- **Kopi af Habbos navne, møbler, lyde eller layout** – altid vores egen udgave.

---

## ✅ Det har vi allerede (Habbo-lignende)

- ✅ Egen figur med køn (kvinde, mand, vil ikke sige), hud, hår, øjne, trøje, bukser, briller, skæg, tøj og hatte
- ✅ Isometrisk hotel med lobby, café, tagterrasse, spillehal og pool
- ✅ Store offentlige rum (lobby og café 12×12) og loft på 25 gæster pr. rum
- ✅ Eget værelse + lejlighed med soveværelse, badeværelse, køkken og altan
- ✅ Døre mellem rummene i lejligheden – man går bare ind ad døren
- ✅ Byg-tilstand: flyt, rotér, gem væk og placér møbler; farvevarianter
- ✅ Profil som hjemmeside med venner, værelser, kæledyr og gæstebog
- ✅ Teleportere i par – også mellem forskellige brugeres værelser
- ✅ Marked: sælg og køb møbler, også når sælgeren er offline (5 % gebyr, alt logges)
- ✅ Trapper og platforme: felter i 0–3 trin, man går ét trin ad gangen
- ✅ Navigator med søgning, kategorier (fest, chill, spil, handel), favoritter og populære rum
- ✅ Byg om: egne rum fra 7×7 til 12×12 i fem former (kvadrat, bred, L, spejlet L, U)
- ✅ Kæledyr (hund, kat, drage) med mad, tricks og level
- ✅ Tapet og gulve man køber og skifter selv
- ✅ Vægmøbler: malerier, plakater, vinduer, hylder, ur, spejl, neonskilt
- ✅ Opdateringer uden afbrydelse: knap med "Ny version" og "Se hvad der er nyt" – og man står samme sted efter en genstart
- ✅ Butik med kategorier og søgefelt (møbler, væg, spil, tapet og gulv, inventar)
- ✅ Lydeffekter lavet i kode (klik, døre, teleport, mønter, chat, badges, spil, kæledyr); højttaleren øverst til højre slår al lyd til/fra (rød streg når slået fra), indstillinger under Figur
- ✅ Jukebox med 6 egne melodier, synkroniseret for alle i rummet og svagere jo længere væk man står
- ✅ Animerede vejlednings-film til rum-spillene på spilkonsollen
- ✅ Råbe med `:shout` / `/råb` – stor fed boble, højst én gang hvert 20. sekund
- ✅ Chatbobler i 8 stilarter (farve og form), låses op med level og badges
- ✅ Emotes der svæver op over hovedet (❤️ 😂 💤 ⚡ 😮 👍 😢 🎵) via 😊-knappen eller `:heart`, `:haha` …
- ✅ Flere handlinger: kram, high-five, sove (💤), tænke (💭), sidde på gulvet (`:sit`)
- ✅ "Må ikke følges": venner ser, at du er online, men ikke hvor
- ✅ Relationer: marker venner som ❤️ / 😊 / 💀 – vises på profilen
- ✅ Opslagstavle (vægmøbel) med post-it-sedler, som ejeren godkender
- ✅ Nyt tøj: kjole, dunjakke, baret, solhat, sneakers, støvler, sandaler, halstørklæde, butterfly, rygsæk og guldkæde – hat, sko og tilbehør i 8 farver
- ✅ 5 gemte outfits man kan skifte mellem med ét klik
- ✅ Effekter: farvet skygge, gyldent skær, stjernestøv og festaura (gratis under events)
- ✅ Bære ting i hånden: kaffe, is, sodavand, blomst og cupcake fra cafédisken, kaffemaskine, isboks, køleskab og blomstervase – og give dem til andre
- ✅ Badekar: man sidder nu nede i vandet i stedet for at ligge oven på
- ✅ Biograf: offentligt rum "Biografen" + lærred (stort, 16:9) og biografstole til eget værelse; YouTube-video (officiel indlejring) ligger skråt på lærredet og er synkroniseret for alle; kø med op til 10 videoer, højst 10 min pr. video, skip ved flertal; i Biografen koster en video 5 mønter (refunderes hvis fjernet før visning), i eget rum gratis for ejer og dem med rettigheder; ejer/moderator kan stoppe og fjerne; titlen hentes fra YouTube og ikke-indlejrbare videoer afvises; slået fra i Junior
- ✅ Lobbi Junior (første del): egen udgave med menu-chat (færdige sætninger i 6 kategorier), sjove navne valgt med terning, venner kun via vennekode, ingen fri tekst nogen steder, AI-beboere med faste replikker – alt tjekkes på serveren. Kører på egen server (lobbi-junior.fly.dev)
- ✅ Hjemmesiden viser rigtige rum fra spillet med figurer, der går rundt og snakker: Caféen og Spillehallen på forsiden (vokser frem, når man scroller), poolen nederst, et rum øverst på hver underside (spillehal, biograf, café) og børn i poolen på Junior-siden – rummene starter først, når man scroller hen til dem
- ✅ Slet egen konto: under Figur i spillet eller via lobbi.dk/slet-konto (skriv dit navn for at bekræfte) – figur, værelser, møbler, markedsvarer og venskaber slettes med det samme
- ✅ Admin-knap (🛡️ øverst til venstre, kun for administratorer): antal brugere, nye i dag og på 7 dage, online nu, og de 100 nyeste brugere med oprettelse, sidst set og login-type
- ✅ Spillet på mobil: intet glider længere ud over kanten, knapperne fylder bredden pænt, plads til iPhones bundlinje, dagens opgaver foldet sammen til en lille knap, rummet zoomet så det passer
- ✅ Mobil: forsiden starter med den levende lobby øverst (tættere på, så figurerne er store), og Junior-siden starter med figuren og chat-menuen
- ✅ Google-login på mobil: besked når man er i en apps indbyggede browser (Messenger, Facebook, Instagram …), hvor Google blokerer login; fejl fra Google vises i stedet for en tom side; login fra den gamle adresse går ikke tabt
- ✅ Hjemmesiden lobbi.dk: forsiden lader dig vælge dør – Lobbi (18+) eller Lobbi Junior (8–12); egen Junior-side med selvkørende chat-menu og en side med vilkår og privatliv for forældre; animationer på alle sider (ting glider ind, talebobler der popper op, lysende etage-skilt, døre der åbner sig)
- ✅ Oprettelse: figuren vises i 3D og drejer, mens man vælger tøj, hår og farver (står fast ved siden af/øverst, når man scroller); invitationskode vises kun, hvis den kræves; Junior siger "Pige/Dreng" og har intet skæg (serveren fjerner det også)
- ✅ Lobbi Junior: forælderen får en mail og siger ja eller nej, før barnet kan spille (nej sletter kontoen, ubesvarede slettes efter 7 dage) + udkast til vilkår og privatlivspolitik for børn og forældre
- ✅ Sneboldkamp: to hold, klik for at kaste (højst 5 felter), 5 snebolde der fyldes op ved snedriven, ramte fryses 1,5 sek, flest træffere vinder
- ✅ Butik med møbler og tøj, låst op med level og badges
- ✅ Mønter (online-tid, opgaver, events, spil) – beregnet på serveren
- ✅ Byttehandel med inventar, begge parter skal godkende, alt logges
- ✅ Venner, venneanmodninger, "Gå til" en ven
- ✅ Hvisken i rummet (`/h navn`) og messenger til venner med offline-beskeder
- ✅ Talebobler, `/dans`, `/vink`, sidde, ligge i sengen
- ✅ Interaktive møbler: lamper tændt/slukket, tv-kanaler, pejs, jukebox, grill
- ✅ Navigator med offentlige rum, gæsterum, events og antal gæster
- ✅ Låste rum, rum med adgangskode, byggerettigheder til andre
- ✅ Badges, level ved navnet, hotel-opgaver, daglige opgaver og streaks
- ✅ Events (fx fredagsfest med dobbelt mønter) og event-badge
- ✅ Mini-spil: `/terning`, `/ssp`, `/quiz`
- ✅ Rum-spil med møbler: Spilkonsol, Farvekamp (to hold farver felter) og Kapløb (start- og målfelter)
- ✅ AI-beboere (🤖 tydeligt markeret) og guiden Magnus for nye gæster
- ✅ Blokér, rapportér, moderator-panel med advarsel, pause, smid ud og ban
- ✅ Login med e-mail og Google, 18+-bekræftelse og vilkår
