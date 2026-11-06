export const QUESTS = [
  { id: 'walk', text: 'Gå hen til vinduet på dit værelse', reward: 5 },
  { id: 'hello', text: 'Sig hej i chatten', reward: 5 },
  { id: 'sit', text: 'Sæt dig i en sofa eller stol', reward: 5 },
  { id: 'look', text: 'Skift udseende under Min figur', reward: 5 },
  { id: 'move', text: 'Flyt et møbel med Byg', reward: 10 },
  { id: 'buy', text: 'Køb og placér noget fra butikken', reward: 10 },
] as const;
export type QuestId = (typeof QUESTS)[number]['id'];

export const BADGES = {
  welcome: { name: 'Ny gæst', icon: '🔑', text: 'Tjekkede ind på Hutel' },
  onboarded: { name: 'Klar til hotellet', icon: '🎉', text: 'Klarede alle startopgaver' },
  online1h: { name: 'Stamgæst', icon: '⏱️', text: '1 time online' },
  online10h: { name: 'Fast inventar', icon: '🏆', text: '10 timer online' },
  social: { name: 'Social sommerfugl', icon: '🦋', text: '5 venner' },
  shopper: { name: 'Shoppinglysten', icon: '🛍️', text: 'Købte 5 møbler' },
  decorator: { name: 'Indretningsarkitekt', icon: '🎨', text: 'Flyttede møbler 25 gange' },
  chatty: { name: 'Snakkesalig', icon: '💬', text: 'Skrev 100 beskeder' },
} as const;
export type BadgeId = keyof typeof BADGES;
