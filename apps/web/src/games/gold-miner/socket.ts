import { emitWithAck } from '../../lib/emit-with-ack';
import type { ShopItemType } from '@game-lobby/game-engine';

type Ack = { ok: boolean };

export function emitGoldMinerLaunch() {
  return emitWithAck<Ack>('game:gold-miner:launch', {});
}

export function emitGoldMinerUseDynamite() {
  return emitWithAck<Ack>('game:gold-miner:use-dynamite', {});
}

export function emitGoldMinerShopBuy(item: ShopItemType) {
  return emitWithAck<Ack>('game:gold-miner:shop-buy', { item });
}

export function emitGoldMinerShopDone() {
  return emitWithAck<Ack>('game:gold-miner:shop-done', {});
}
