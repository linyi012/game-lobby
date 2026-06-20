import type { CharacterId } from './characters.js';

export type SupplyKind =
  | 'water'
  | 'food'
  | 'knife'
  | 'gun'
  | 'medkit'
  | 'jewelry'
  | 'life_preserver'
  | 'parasol'
  | 'flare';

export interface SupplyCard {
  id: string;
  kind: SupplyKind;
  points: number;
  combatBonus?: number;
  specialAction?: 'gun' | 'medkit' | 'flare';
}

export type NavigationEffect =
  | { type: 'seagull'; delta: number }
  | { type: 'overboard'; characterId: CharacterId }
  | { type: 'thirst_resolve' }
  | { type: 'extra_thirst' };

export interface NavigationCard {
  id: string;
  label: string;
  effects: NavigationEffect[];
}

export const SUPPLY_LABELS: Record<SupplyKind, string> = {
  water: '淡水',
  food: '食物',
  knife: '刀具',
  gun: '手枪',
  medkit: '医疗包',
  jewelry: '珠宝',
  life_preserver: '救生圈',
  parasol: '阳伞',
  flare: '信号枪',
};

export function buildSupplyDeck(): SupplyCard[] {
  let seq = 0;
  const nextId = (kind: SupplyKind) => `${kind}-${seq++}`;

  const specs: {
    kind: SupplyKind;
    count: number;
    points?: number;
    combatBonus?: number;
    specialAction?: SupplyCard['specialAction'];
  }[] = [
    { kind: 'water', count: 16, points: 0 },
    { kind: 'food', count: 8, points: 0 },
    { kind: 'knife', count: 6, points: 0, combatBonus: 2 },
    { kind: 'gun', count: 2, points: 0, specialAction: 'gun' },
    { kind: 'medkit', count: 2, points: 0, specialAction: 'medkit' },
    { kind: 'jewelry', count: 12, points: 1 },
    { kind: 'jewelry', count: 4, points: 2 },
    { kind: 'jewelry', count: 2, points: 3 },
    { kind: 'life_preserver', count: 2, points: 0 },
    { kind: 'parasol', count: 2, points: 0 },
    { kind: 'flare', count: 2, points: 0, specialAction: 'flare' },
  ];

  const cards: SupplyCard[] = [];
  for (const spec of specs) {
    for (let i = 0; i < spec.count; i++) {
      cards.push({
        id: nextId(spec.kind),
        kind: spec.kind,
        points: spec.points ?? 0,
        combatBonus: spec.combatBonus,
        specialAction: spec.specialAction,
      });
    }
  }
  return cards;
}

export function buildNavigationDeck(): NavigationCard[] {
  let seq = 0;
  const nextId = () => `nav-${seq++}`;

  const cards: NavigationCard[] = [];

  for (let i = 0; i < 8; i++) {
    cards.push({ id: nextId(), label: '海鸥', effects: [{ type: 'seagull', delta: 1 }] });
  }
  for (let i = 0; i < 3; i++) {
    cards.push({ id: nextId(), label: '海鸥飞走', effects: [{ type: 'seagull', delta: -1 }] });
  }

  const overboardChars: CharacterId[] = ['captain', 'gentleman', 'lady', 'french', 'rich', 'kid'];
  for (const characterId of overboardChars) {
    cards.push({
      id: nextId(),
      label: `${characterId} 落水`,
      effects: [{ type: 'overboard', characterId }],
    });
  }

  for (let i = 0; i < 6; i++) {
    cards.push({ id: nextId(), label: '口渴', effects: [{ type: 'thirst_resolve' }] });
  }
  for (let i = 0; i < 4; i++) {
    cards.push({ id: nextId(), label: '风暴', effects: [{ type: 'extra_thirst' }] });
  }

  return cards;
}

export function supplyCardLabel(card: SupplyCard): string {
  const base = SUPPLY_LABELS[card.kind];
  if (card.points > 0) return `${base} (${card.points}分)`;
  if (card.combatBonus) return `${base} (+${card.combatBonus}力)`;
  return base;
}
