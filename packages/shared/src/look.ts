import { z } from 'zod';

export const PALETTE = {
  skin: [0xf6d2b5, 0xf2c9a8, 0xe8b896, 0xc98e66, 0x9a6343, 0x6b4430],
  hair: [0x3b2416, 0x6b3e22, 0xd9a35b, 0xb33a2a, 0x2a2a35, 0xe8e2d6, 0x7a5cc0],
  eyes: [0x5a3a22, 0x2f6b8f, 0x3d7a3a, 0x7a7a85, 0x2a1a12],
  shirt: [0x2f4a7a, 0x3f7f86, 0xc94f3d, 0xe0a93b, 0x5b8f4a, 0x6f4a8f, 0xf0efe8, 0x2a2a35],
  pants: [0x2b3550, 0x4a4a55, 0x6b4a33, 0x3a5a40, 0x8a3b2a],
} as const;

export const HAIR_STYLES = ['kort', 'krøller', 'hestehale', 'langt', 'kasket', 'skaldet'] as const;
export const GLASSES = ['ingen', 'runde', 'sol'] as const;
export const BEARDS = ['ingen', 'stubbe', 'fuld'] as const;

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
