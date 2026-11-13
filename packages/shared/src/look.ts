import { z } from 'zod';

export const PALETTE = {
  skin: [0xf6d2b5, 0xf2c9a8, 0xe8b896, 0xc98e66, 0x9a6343, 0x6b4430],
  hair: [0x3b2416, 0x6b3e22, 0xd9a35b, 0xb33a2a, 0x2a2a35, 0xe8e2d6, 0x7a5cc0],
  eyes: [0x5a3a22, 0x2f6b8f, 0x3d7a3a, 0x7a7a85, 0x2a1a12],
  shirt: [0x2f4a7a, 0x3f7f86, 0xc94f3d, 0xe0a93b, 0x5b8f4a, 0x6f4a8f, 0xf0efe8, 0x2a2a35],
  pants: [0x2b3550, 0x4a4a55, 0x6b4a33, 0x3a5a40, 0x8a3b2a],
  /** Colour of hats, shoes and accessories that come in colours. */
  extra: [0xc94f3d, 0x2f6b8f, 0xe0a93b, 0x5b8f4a, 0x6f4a8f, 0xf0efe8, 0x2a2a35, 0xff8fb0],
} as const;

export const HAIR_STYLES = ['kort', 'krøller', 'hestehale', 'langt', 'kasket', 'skaldet'] as const;
export const GLASSES = ['ingen', 'runde', 'sol'] as const;
/** Body type of the figure. 'andet' is the neutral figure. */
export const GENDERS = ['kvinde', 'mand', 'andet'] as const;
export const BEARDS = ['ingen', 'stubbe', 'fuld'] as const;
export const TOPS = [
  'tshirt',
  'stribet',
  'hoodie',
  'skjorte',
  'kjole',
  'dunjakke',
  'jakke',
  'smoking',
] as const;
export const HATS = ['ingen', 'hue', 'baret', 'solhat', 'cowboy', 'hoejhat', 'krone'] as const;
export const SHOES = ['standard', 'sneakers', 'stoevler', 'sandaler'] as const;
export const ACCESSORIES = ['ingen', 'halstoerklaede', 'sloejfe', 'rygsaek', 'halskaede'] as const;
export type Shoes = (typeof SHOES)[number];
export type Accessory = (typeof ACCESSORIES)[number];
export type Top = (typeof TOPS)[number];
export type Hat = (typeof HATS)[number];

/** Clothes in the shop. Keys are "slot:value"; items without a price are free for everyone. */
export const CLOTHES: Record<string, { name: string; price: number; unlock?: string }> = {
  'top:tshirt': { name: 'T-shirt', price: 0 },
  'top:stribet': { name: 'Stribet trøje', price: 12 },
  'top:hoodie': { name: 'Hættetrøje', price: 15 },
  'top:skjorte': { name: 'Skjorte og slips', price: 20 },
  'top:kjole': { name: 'Kjole', price: 18 },
  'top:dunjakke': { name: 'Dunjakke', price: 25 },
  'top:jakke': { name: 'Læderjakke', price: 30, unlock: 'onboarded' },
  'top:smoking': { name: 'Smoking', price: 50, unlock: 'hotelkender' },
  'hat:ingen': { name: 'Ingen hat', price: 0 },
  'hat:hue': { name: 'Hue', price: 10 },
  'hat:baret': { name: 'Baret', price: 14 },
  'hat:solhat': { name: 'Solhat', price: 16 },
  'hat:cowboy': { name: 'Cowboyhat', price: 20 },
  'hat:hoejhat': { name: 'Høj hat', price: 35, unlock: 'hotelkender' },
  'hat:krone': { name: 'Krone', price: 60, unlock: 'streak7' },
  'shoes:standard': { name: 'Sko', price: 0 },
  'shoes:sneakers': { name: 'Sneakers', price: 12 },
  'shoes:stoevler': { name: 'Støvler', price: 15 },
  'shoes:sandaler': { name: 'Sandaler', price: 8 },
  'acc:ingen': { name: 'Intet', price: 0 },
  'acc:halstoerklaede': { name: 'Halstørklæde', price: 10 },
  'acc:sloejfe': { name: 'Butterfly', price: 9 },
  'acc:rygsaek': { name: 'Rygsæk', price: 18 },
  'acc:halskaede': { name: 'Guldkæde', price: 25, unlock: 'social' },
};

/** True if this look only uses clothes that are free or owned. */
export function lookAllowed(look: Look, owned: readonly string[]): boolean {
  return [
    `top:${look.top ?? 'tshirt'}`,
    `hat:${look.hat ?? 'ingen'}`,
    `shoes:${look.shoes ?? 'standard'}`,
    `acc:${look.acc ?? 'ingen'}`,
  ].every((k) => CLOTHES[k] && (CLOTHES[k]!.price === 0 || owned.includes(k)));
}

const color = (list: readonly number[]) =>
  z
    .number()
    .int()
    .refine((c) => list.includes(c), 'Ukendt farve');

export const LookSchema = z.object({
  skin: color(PALETTE.skin),
  hair: color(PALETTE.hair),
  eyes: color(PALETTE.eyes),
  shirt: color(PALETTE.shirt),
  pants: color(PALETTE.pants),
  hairStyle: z.enum(HAIR_STYLES),
  glasses: z.enum(GLASSES),
  beard: z.enum(BEARDS),
  top: z.enum(TOPS).optional(),
  hat: z.enum(HATS).optional(),
  shoes: z.enum(SHOES).optional(),
  acc: z.enum(ACCESSORIES).optional(),
  extra: color(PALETTE.extra).optional(),
  gender: z.enum(GENDERS).optional(),
});
export type Look = z.infer<typeof LookSchema>;

export const DEFAULT_LOOK: Look = {
  skin: 0xf2c9a8,
  hair: 0x6b3e22,
  eyes: 0x5a3a22,
  shirt: 0x2f4a7a,
  pants: 0x2b3550,
  hairStyle: 'kort',
  glasses: 'ingen',
  beard: 'ingen',
};

/**
 * Makes a stored look valid again: every field the schema rejects (an old colour, a removed
 * hair style …) falls back to the default, or is dropped if it is optional. Without this a single
 * bad field makes every later "look" message from that player fail validation.
 */
export function repairLook(look: unknown): Look {
  const src = (look && typeof look === 'object' ? look : {}) as Record<string, unknown>;
  const shape = LookSchema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(shape)) {
    if (src[key] !== undefined && schema.safeParse(src[key]).success) out[key] = src[key];
    else if (key in DEFAULT_LOOK) out[key] = DEFAULT_LOOK[key as keyof Look];
  }
  return out as Look;
}

