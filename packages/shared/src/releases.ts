/**
 * Bump when old clients can no longer talk to the new server (they must reload).
 * Small changes keep the number, and players just see an "update available" button.
 */
export const PROTOCOL_VERSION = 2;

export interface ReleaseNote {
  date: string;
  title: string;
  items: string[];
}

/** What's new, newest first. Add an entry for every deploy players should hear about. */
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    date: '2026-11-07',
    title: 'Biograf og sneboldkamp',
    items: [
      '🏨 Hutel hedder nu Lobbi!',
      '🎬 Ny Biograf: se YouTube-videoer sammen på lærredet',
      '💺 Køb dit eget lærred og biografstole til værelset',
      '❄️ Sneboldkamp på spilkonsollen – kast, ram og hent nye snebolde ved snedriven',
    ],
  },
  {
    date: '2026-11-07',
    title: 'Nyt tøj, outfits og ting i hånden',
    items: [
      '👗 Kjole, dunjakke, baret, solhat, nye sko og tilbehør – i flere farver',
      '👕 Gem op til 5 outfits og skift med ét klik under Figur',
      '✨ Effekter: farvet skygge, gyldent skær, stjernestøv og festaura',
      '☕ Hent kaffe, is eller en blomst ved disken – og giv den til en ven',
      '🛁 Man sidder nu ordentligt i badekarret',
      '🔇 Klik på højttaleren øverst til højre for at slå lyden til og fra',
    ],
  },
  {
    date: '2026-11-07',
    title: 'Råb, emotes og nye handlinger',
    items: [
      '📢 Råb med :shout – stor, fed tekst til hele rummet',
      '😊 Ny knap med kram, high-five, sove, tænke, sid på gulvet og emotes',
      '💬 Vælg din chatboble under Figur – flere låses op med level og badges',
      '❤️ Marker venner som ❤️ 😊 💀 og vælg "må ikke følges" under Venner',
      '📌 Opslagstavle med post-its, som ejeren godkender',
    ],
  },
  {
    date: '2026-11-07',
    title: 'Lyd, jukebox og spil-videoer',
    items: [
      '🔊 Lydeffekter ved mønter, døre, chat, badges og spil – slå dem til og fra under 🔊',
      '📻 Jukeboxen spiller nu rigtige melodier, som alle i rummet hører samtidig',
      '▶︎ "Se hvordan det virker" på spilkonsollen viser en lille film om Farvekamp og Kapløb',
      '🚪 Du ryger ikke længere ind ad en dør, bare fordi du stopper foran den',
      '📍 Efter en opdatering står du samme sted som før – ikke ved døren',
    ],
  },
  {
    date: '2026-11-07',
    title: 'Rum-spil, ny butik og opdateringer uden afbrydelser',
    items: [
      '🕹️ Spilkonsol med Farvekamp og Kapløb',
      '🛒 Butikken er delt i kategorier og har søgning',
      '🚪 Døre mellem rummene i din lejlighed',
      '✨ Nye versioner viser en knap i stedet for at genindlæse siden',
    ],
  },
  {
    date: '2026-11-06',
    title: 'Kæledyr, marked og teleportere',
    items: [
      '🐾 Hund, kat og drage der følger dig',
      '🏪 Marked hvor du kan sælge og købe møbler',
      '🌀 Teleportere i par',
      '📖 Gæstebog på profilen',
    ],
  },
];
