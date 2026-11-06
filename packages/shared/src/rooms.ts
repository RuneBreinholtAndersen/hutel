import type { PlacedItem } from './placement';

export type RoomTheme = 'home' | 'lobby' | 'cafe';
export type RoomAccess = 'open' | 'locked' | 'password';

/** The door tile in every room (in front of the door on the back wall). */
export const DOOR_TILE = [6, 0] as const;

export interface PublicRoomDef {
  id: string;
  name: string;
  description: string;
  theme: RoomTheme;
  items: PlacedItem[];
}

export const PUBLIC_ROOMS: PublicRoomDef[] = [
  {
    id: 'lobby',
    name: 'Lobbyen',
    description: 'Hotellets hjerte. Mød Ida i receptionen.',
    theme: 'lobby',
    items: [
      { id: 1001, type: 'desk', x: 2, z: 2, rot: 0 },
      { id: 1002, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 1003, type: 'plant', x: 7, z: 0, rot: 0 },
      { id: 1004, type: 'plant', x: 0, z: 7, rot: 0 },
      { id: 1005, type: 'rug', x: 4, z: 4, rot: 0 },
      { id: 1006, type: 'table', x: 4, z: 4, rot: 0 },
      { id: 1007, type: 'armchair', x: 3, z: 4, rot: 1 },
      { id: 1008, type: 'armchair', x: 6, z: 4, rot: 3 },
      { id: 1009, type: 'sofa', x: 4, z: 6, rot: 2 },
      { id: 1010, type: 'aquarium', x: 0, z: 5, rot: 1 },
      { id: 1011, type: 'lamp', x: 1, z: 0, rot: 0 },
      { id: 1012, type: 'plant', x: 7, z: 7, rot: 0 },
    ],
  },
  {
    id: 'cafe',
    name: 'Caféen',
    description: 'Kaffe, kage og god snak. Luna står bag disken.',
    theme: 'cafe',
    items: [
      { id: 2001, type: 'counter', x: 1, z: 1, rot: 0 },
      { id: 2002, type: 'stool', x: 1, z: 2, rot: 2 },
      { id: 2003, type: 'stool', x: 3, z: 2, rot: 2 },
      { id: 2004, type: 'table', x: 5, z: 3, rot: 0 },
      { id: 2005, type: 'stool', x: 4, z: 3, rot: 1 },
      { id: 2006, type: 'stool', x: 6, z: 3, rot: 3 },
      { id: 2007, type: 'table', x: 2, z: 5, rot: 0 },
      { id: 2008, type: 'armchair', x: 1, z: 5, rot: 1 },
      { id: 2009, type: 'armchair', x: 3, z: 5, rot: 3 },
      { id: 2010, type: 'rug', x: 4, z: 5, rot: 0 },
      { id: 2011, type: 'sofa', x: 4, z: 7, rot: 2 },
      { id: 2012, type: 'plant', x: 0, z: 0, rot: 0 },
      { id: 2013, type: 'plant', x: 7, z: 7, rot: 0 },
      { id: 2014, type: 'lamp', x: 7, z: 1, rot: 0 },
      { id: 2015, type: 'shelf', x: 0, z: 3, rot: 1 },
    ],
  },
];

/** Starting furniture for every new guest room. */
export const DEFAULT_HOME_ITEMS: Omit<PlacedItem, 'id'>[] = [
  { type: 'rug', x: 2, z: 1, rot: 0 },
  { type: 'sofa', x: 2, z: 0, rot: 0 },
  { type: 'table', x: 2, z: 2, rot: 0 },
  { type: 'lamp', x: 1, z: 0, rot: 0 },
  { type: 'plant', x: 0, z: 0, rot: 0 },
  { type: 'shelf', x: 0, z: 4, rot: 1 },
  { type: 'armchair', x: 5, z: 2, rot: 3 },
];
