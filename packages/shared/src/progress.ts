export const QUESTS = [
  { id: 'walk', text: 'Gå hen til vinduet på dit værelse', reward: 5 },
  { id: 'hello', text: 'Sig hej i chatten', reward: 5 },
  { id: 'sit', text: 'Sæt dig i en sofa eller stol', reward: 5 },
  { id: 'look', text: 'Skift udseende under Min figur', reward: 5 },
  { id: 'move', text: 'Flyt et møbel med Byg', reward: 10 },
  { id: 'buy', text: 'Køb og placér noget fra butikken', reward: 10 },
] as const;

/** Second chain, unlocked when the start quests are done: explore the hotel and meet people. */
export const HOTEL_QUESTS = [
  { id: 'lobby', text: 'Find vej til lobbyen via Rum', reward: 5 },
  { id: 'ida', text: 'Skriv til Ida i receptionen', reward: 5 },
  { id: 'aquarium', text: 'Gå hen og kig på akvariet i lobbyen', reward: 5 },
  { id: 'coffee', text: 'Bestil en kaffe hos Luna i caféen (skriv "kaffe")', reward: 5 },
  { id: 'cafeSit', text: 'Sæt dig i caféen', reward: 5 },
  { id: 'greetHuman', text: 'Sig hej til en rigtig gæst (ikke en AI-beboer)', reward: 15 },
] as const;
export const HOTEL_BONUS = 25;

export type QuestId = (typeof QUESTS)[number]['id'] | (typeof HOTEL_QUESTS)[number]['id'];

export const BADGES = {
  welcome: { name: 'Ny gæst', icon: '🔑', text: 'Tjekkede ind på Hutel' },
  onboarded: { name: 'Klar til hotellet', icon: '🎉', text: 'Klarede alle startopgaver' },
  hotelkender: { name: 'Hotelkender', icon: '🗝️', text: 'Klarede alle hotel-opgaver' },
  online1h: { name: 'Stamgæst', icon: '⏱️', text: '1 time online' },
  online10h: { name: 'Fast inventar', icon: '🏆', text: '10 timer online' },
  social: { name: 'Social sommerfugl', icon: '🦋', text: '5 venner' },
  shopper: { name: 'Shoppinglysten', icon: '🛍️', text: 'Købte 5 møbler' },
  decorator: { name: 'Indretningsarkitekt', icon: '🎨', text: 'Flyttede møbler 25 gange' },
  chatty: { name: 'Snakkesalig', icon: '💬', text: 'Skrev 100 beskeder' },
} as const;
export type BadgeId = keyof typeof BADGES;
