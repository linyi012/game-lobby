export type CharacterId =
  | 'captain'
  | 'gentleman'
  | 'lady'
  | 'french'
  | 'rich'
  | 'kid';

export interface CharacterDef {
  id: CharacterId;
  name: string;
  maxHp: number;
  strength: number;
  stealImmune?: boolean;
  stealNoCombat?: boolean;
  overboardImmune?: boolean;
  survivalBonus?: number;
  ladyAdjacentBonus?: boolean;
  seesAllRowing?: boolean;
}

export const ALL_CHARACTERS: CharacterDef[] = [
  {
    id: 'captain',
    name: '船长',
    maxHp: 4,
    strength: 6,
    seesAllRowing: true,
  },
  {
    id: 'gentleman',
    name: '绅士',
    maxHp: 3,
    strength: 5,
    stealImmune: true,
  },
  {
    id: 'lady',
    name: '女士',
    maxHp: 3,
    strength: 5,
    ladyAdjacentBonus: true,
  },
  {
    id: 'french',
    name: '法国佬',
    maxHp: 3,
    strength: 4,
    overboardImmune: true,
  },
  {
    id: 'rich',
    name: '富豪',
    maxHp: 3,
    strength: 4,
    survivalBonus: 2,
  },
  {
    id: 'kid',
    name: '小孩',
    maxHp: 2,
    strength: 3,
    stealNoCombat: true,
  },
];

export const CHARACTER_BY_ID: Record<CharacterId, CharacterDef> = Object.fromEntries(
  ALL_CHARACTERS.map((c) => [c.id, c]),
) as Record<CharacterId, CharacterDef>;

export const CHARACTER_LABELS: Record<CharacterId, string> = Object.fromEntries(
  ALL_CHARACTERS.map((c) => [c.id, c.name]),
) as Record<CharacterId, string>;
