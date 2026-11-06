import {
  CLOTHES,
  furniture,
  type InvItem,
  type TradeOfferView,
  type TradeView,
} from '@hutel/shared';
import type { UserRecord } from './store';

export interface Offer {
  coins: number;
  /** Indices into the user's inventory. */
  inv: number[];
  clothes: string[];
}

/** A trade between two players. Both must accept the same offers; any change resets the accepts. */
export class Trade {
  readonly offers = new Map<string, Offer>();
  readonly ok = new Set<string>();
  /** The second player has not answered the invitation yet. */
  pending = true;

  constructor(
    readonly a: string,
    readonly b: string,
  ) {
    this.offers.set(a, { coins: 0, inv: [], clothes: [] });
    this.offers.set(b, { coins: 0, inv: [], clothes: [] });
  }

  other(id: string) {
    return id === this.a ? this.b : this.a;
  }
}

/** Clothes that can be traded: bought (paid) pieces the user owns. */
export const tradeableClothes = (u: UserRecord) =>
  (u.wardrobe ?? []).filter((k) => (CLOTHES[k]?.price ?? 0) > 0);

/** Returns an error message if the offer isn't valid for this user, else null. */
export function checkOffer(u: UserRecord, o: Offer): string | null {
  if (o.coins > u.coins) return 'Du har ikke så mange mønter.';
  const inv = u.inventory ?? [];
  if (new Set(o.inv).size !== o.inv.length || o.inv.some((i) => i >= inv.length))
    return 'Det møbel har du ikke i dit inventar.';
  const owned = tradeableClothes(u);
  if (new Set(o.clothes).size !== o.clothes.length || o.clothes.some((k) => !owned.includes(k)))
    return 'Det tøj har du ikke.';
  return null;
}

export function offerView(u: UserRecord, o: Offer): TradeOfferView {
  const inv = u.inventory ?? [];
  return { coins: o.coins, items: o.inv.map((i) => inv[i]!).filter(Boolean), clothes: o.clothes };
}

export function tradeView(t: Trade, me: UserRecord, them: UserRecord): TradeView {
  const mine = t.offers.get(me.id)!;
  return {
    partner: { id: them.id, name: them.name },
    mine: { ...offerView(me, mine), inv: mine.inv },
    theirs: offerView(them, t.offers.get(them.id)!),
    myOk: t.ok.has(me.id),
    theirOk: t.ok.has(them.id),
  };
}

/** Moves everything; call only after both offers are re-checked. Returns a log summary. */
export function executeTrade(a: UserRecord, b: UserRecord, t: Trade) {
  const oa = t.offers.get(a.id)!;
  const ob = t.offers.get(b.id)!;
  const take = (u: UserRecord, o: Offer): InvItem[] => {
    const inv = u.inventory ?? [];
    const items = o.inv.map((i) => inv[i]!);
    u.inventory = inv.filter((_, i) => !o.inv.includes(i));
    u.wardrobe = (u.wardrobe ?? []).filter((k) => !o.clothes.includes(k));
    u.coins -= o.coins;
    return items;
  };
  const give = (u: UserRecord, items: InvItem[], o: Offer) => {
    u.inventory = [...(u.inventory ?? []), ...items];
    u.wardrobe = [...new Set([...(u.wardrobe ?? []), ...o.clothes])];
    u.coins += o.coins;
  };
  const fromA = take(a, oa);
  const fromB = take(b, ob);
  give(b, fromA, oa);
  give(a, fromB, ob);
  const sum = (items: InvItem[], o: Offer) => ({
    coins: o.coins,
    items: items.map((i) => furniture(i.type).name),
    clothes: o.clothes,
  });
  return { [a.id]: sum(fromA, oa), [b.id]: sum(fromB, ob) };
}
