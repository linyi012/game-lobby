import type { GameModule } from '@game-lobby/game-core';
import { defaultCanAddBot } from '@game-lobby/game-core';
import {
  createGoldMinerGame,
  generateBotDynamite,
  generateBotLaunch,
  generateBotShop,
  type GoldMinerGameState,
  type GoldMinerStartOptions,
} from './logic.js';

export type { GoldMinerStartOptions } from './logic.js';

export const goldMinerModule: GameModule<GoldMinerGameState, GoldMinerStartOptions> = {
  gameType: 'gold_miner',

  create(participants, options = {}) {
    return createGoldMinerGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  canAddBot(room) {
    return defaultCanAddBot(room);
  },

  insufficientPlayersHint() {
    return '可单人开始，或添加电脑一起竞技。';
  },

  runBotTurn(state, ctx) {
    if (state.phase === 'ended') return null;

    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player?.isBot) return null;

    if (state.phase === 'shop') {
      if (state.shopDoneIds.includes(ctx.playerId)) return null;
      return generateBotShop(state, ctx.playerId, ctx.difficulty);
    }

    if (state.phase !== 'playing') return null;
    if (state.currentPlayerId !== ctx.playerId) return null;

    const dynamite = generateBotDynamite(state, ctx.playerId);
    if (dynamite) return dynamite;

    if (state.hookStage === 'swinging') {
      return generateBotLaunch(state, ctx.difficulty);
    }

    return null;
  },
};

export {
  createGoldMinerGame,
  tickGoldMiner,
  launchHook,
  useDynamite,
  buyShopItem,
  skipShop,
  applyShopBuffsOnTurn,
  computeSwingAngle,
  hookTip,
  generateBotLaunch,
  generateBotShop,
  generateBotDynamite,
  scoreItemAtAngle,
  SHOP_PRICES,
  ITEM_LABELS,
  FIELD_WIDTH,
  FIELD_HEIGHT,
  MINER_X,
  MINER_Y,
  type GoldMinerGameState,
  type GoldMinerPlayerState,
  type GoldMinerPhase,
  type HookStage,
  type ItemType,
  type ShopItemType,
  type MineItem,
  type GoldMinerHookState,
  type GoldMinerLastGrab,
  type GoldMinerInventory,
} from './logic.js';
