# Hutel vs. Habbo – det der mangler, og hvad der giver mening

Listen sammenligner Hutel med de klassiske funktioner fra Habbo Hotel. Navne, grafik og møbler kopieres ikke: vi laver vores egen version af idéen.

**Sådan læses den**
- **Værdi**: hvor meget det betyder for spillerne (★–★★★)
- **Indsats**: hvor stor opgaven er med vores teknik i dag (S = en aften, M = 1–3 dage, L = en uge+)
- 🤖 = noget AI gør nemmere end i 2004 (AI-beboere, moderation, generering)

---

## 🔜 Anbefalet rækkefølge (åbne punkter)

Det her mener jeg giver mest spil for pengene, i den rækkefølge:

- [ ] **1. Større og flere rum til brugere** – vælg gulvplan og størrelse (6×6 til 12×12, L-form, trapper/niveauer). Vi har lige gjort rumstørrelse variabel, så det er nu en M-opgave. ★★★ · M
- [ ] **2. Rum-kategorier og søgning i navigatoren** – "Fest", "Chill", "Spil", "Handel", favoritter og "mest populære lige nu". ★★★ · S
- [ ] **3. Profil-side ("hjem-side")** – motto, badges, venner, værelser, et gæstebog-felt. ★★ · M
- [ ] **4. Rum-spil som møbler** – frysekamp/snebold-arena, farvefelter man løber på (som "Battle Banzai"), stoleleg, kapløb. Serveren styrer reglerne. ★★★ · L
- [ ] **5. Wired light: møbler der reagerer** – trykplader, "når nogen går her → tænd lampe / teleportér / sig noget". Giver brugerne mulighed for at bygge deres egne spil. ★★★ · L
- [ ] **6. Teleportere mellem rum** – to møbler der hænger sammen, også mellem forskellige brugeres værelser. ★★ · M
- [ ] **7. Kæledyr** – hund/kat/drage der følger dig, kan fodres, lærer tricks og får level. 🤖 kan svare med lyde og små replikker. ★★★ · L
- [ ] **8. Grupper/klubber** – navn, logo-generator (vores egen), medlemsliste, gruppe-rum, gruppe-badge ved navnet. ★★ · M
- [ ] **9. Sjældne møbler ("rares")** – begrænsede møbler, der kun sælges en uge eller i et bestemt antal, med serienummer. Driver byttehandel. ★★★ · S (vi har allerede bytte + inventar)
- [ ] **10. Marked** – sæt ting til salg for mønter; andre kan købe, mens du er offline. Kræver transaktioner og log (findes allerede for bytte). ★★ · M
- [ ] **11. Lyd og musik** – jukebox med egne korte melodier, lyde ved klik, dør, mønter. Generér selv musik/lyde, så intet kopieres. ★★ · M
- [ ] **12. Mobil-kontroller** – tryk-for-at-gå er der, men knapper og paneler skal tilpasses små skærme. ★★★ · M
- [ ] **13. Hutel Junior** – menu-chat, forældrekonto, vennekoder, egen server/database (se PLAN.md). ★★★ · L

## 💡 Habbo-funktioner vi mangler (fuld liste)

### Chat og socialt
- [ ] **Råbe** (`:shout`) – fed tekst alle kan se, med længere rate-limit. S
- [ ] **Chatbobler i stilarter** – vælg boblefarve/-form (låses op med badges). S
- [ ] **Emotes over hovedet** – ❤️ 😂 💤 ⚡ ikoner, der svæver op. S
- [ ] **Flere handlinger** – kram, high-five, sove (zzz), "tænke", sidde på gulvet (`:sit`). S
- [ ] **Gå hen til en ven ("follow")** – fra venne-listen direkte ind i deres rum. ✓ findes som "Gå til" – mangler privatlivsindstilling "må ikke følges". S
- [ ] **Relationer** – marker venner som ❤️ / 😊 / 💀 på profilen. S
- [ ] **Gæstebog / vægbeskeder i rum** – post-it-sedler ejeren kan godkende. M
- [ ] **Offline-meddelelser til grupper**. M

### Rum og byggeri
- [ ] **Gulvplan-editor** – tegn selv gulvets form, højde, dørens placering. L
- [ ] **Stable møbler** (højde/z-akse) – sætte ting oven på hinanden, hylder på væggen. M–L
- [ ] **Vægmøbler** – billeder, vinduer, hylder, plakater på væggen. M
- [ ] **Tapet og gulv som varer** – køb tapeter/gulve i butikken (vi har temaer, men ikke frit valg). S
- [ ] **Rum-indstillinger** – maks. antal gæster, hvem må tale, "kun venner", forbudt-liste. S
- [ ] **Rum-vurdering** – 👍 til rum, "top-rum" i navigatoren. S
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
- [ ] **Flere tøjdele** – jakker, kjoler, sko, accessories, hatte i flere farver. S pr. del
- [ ] **Gemte outfits** – 3–5 pladser til at skifte hurtigt. S
- [ ] **Effekter** – gløde, skygge-farve, lille "aura" ved events. S
- [ ] **Bære ting i hånden** – kaffe, is, blomst (fra dispensere eller gaver). S

### Spil og aktiviteter
- [ ] **Snebold/arena-spil** med hold og point. L
- [ ] **Farve-felt-spil** – løb og farv flest felter på 2 minutter. M
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

- ✅ Egen figur med hud, hår, øjne, trøje, bukser, briller, skæg, tøj og hatte
- ✅ Isometrisk hotel med lobby, café, tagterrasse, spillehal og pool
- ✅ Store offentlige rum (lobby og café 12×12) og loft på 25 gæster pr. rum
- ✅ Eget værelse + lejlighed med soveværelse, badeværelse, køkken og altan
- ✅ Byg-tilstand: flyt, rotér, gem væk og placér møbler; farvevarianter
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
- ✅ AI-beboere (🤖 tydeligt markeret) og guiden Magnus for nye gæster
- ✅ Blokér, rapportér, moderator-panel med advarsel, pause, smid ud og ban
- ✅ Login med e-mail og Google, 18+-bekræftelse og vilkår
