export interface FurnitureDef {
  name: string;
  icon: string;
  price: number;
  /** Footprint along local x (width) and z (depth) at rotation 0. */
  w: number;
  d: number;
  /** Avatars can sit on every tile of this item. */
  seat?: boolean;
  /** Flat items (rugs) that can be walked on and placed under other items. */
  walk?: boolean;
  /** Not sold in the shop (fixtures in public rooms). */
  noShop?: boolean;
}

export const FURNITURE = {
  plant: { name: 'Plante', icon: '🪴', price: 6, w: 1, d: 1 },
  lamp: { name: 'Gulvlampe', icon: '💡', price: 8, w: 1, d: 1 },
  rug: { name: 'Tæppe', icon: '🟥', price: 8, w: 2, d: 2, walk: true },
  table: { name: 'Sofabord', icon: '☕', price: 10, w: 1, d: 1 },
  stool: { name: 'Taburet', icon: '🪑', price: 7, w: 1, d: 1, seat: true },
  armchair: { name: 'Lænestol', icon: '🪑', price: 12, w: 1, d: 1, seat: true },
  shelf: { name: 'Bogreol', icon: '📚', price: 15, w: 2, d: 1 },
  aquarium: { name: 'Akvarie', icon: '🐠', price: 18, w: 1, d: 1 },
  sofa: { name: 'Sofa', icon: '🛋️', price: 20, w: 2, d: 1, seat: true },
  bed: { name: 'Seng', icon: '🛏️', price: 25, w: 2, d: 2 },
  desk: { name: 'Reception', icon: '🛎️', price: 0, w: 3, d: 1, noShop: true },
  counter: { name: 'Cafédisk', icon: '🧁', price: 0, w: 3, d: 1, noShop: true },
} as const satisfies Record<string, FurnitureDef>;

export type FurnitureType = keyof typeof FURNITURE;
export const FURNITURE_TYPES = Object.keys(FURNITURE) as FurnitureType[];

export function furniture(type: FurnitureType): FurnitureDef {
  return FURNITURE[type];
}

export function sellPrice(type: FurnitureType): number {
  return Math.floor(furniture(type).price / 2);
}
