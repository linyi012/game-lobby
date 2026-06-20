import { getActiveSocket } from '../../lib/socket';
import type { ShopItemType } from '@game-lobby/game-engine';

function emit<T>(event: string, payload?: unknown): Promise<T> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit(event, payload ?? {}, resolve);
  });
}

export function emitGoldMinerLaunch() {
  return emit<{ ok: boolean }>('game:gold-miner:launch');
}

export function emitGoldMinerUseDynamite() {
  return emit<{ ok: boolean }>('game:gold-miner:use-dynamite');
}

export function emitGoldMinerShopBuy(item: ShopItemType) {
  return emit<{ ok: boolean }>('game:gold-miner:shop-buy', { item });
}

export function emitGoldMinerShopDone() {
  return emit<{ ok: boolean }>('game:gold-miner:shop-done');
}
