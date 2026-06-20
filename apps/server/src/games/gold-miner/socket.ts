import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  buyShopItem,
  launchHook,
  skipShop,
  tickGoldMiner,
  useDynamite,
  type GoldMinerGameState,
  type ShopItemType,
} from '@game-lobby/game-engine';
import type { RoomManager } from '../../services/room-manager.js';
import type { GameSocketDeps } from '../undercover/socket.js';

const shopBuySchema = z.object({
  item: z.enum(['dynamite', 'strength', 'lucky']),
});

let timerStarted = false;

export function registerGoldMinerSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: Server },
) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function applyUpdate(roomId: string, before: string) {
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gold_miner') return;
    if (JSON.stringify(game.state) === before) return;

    roomManager.touchGameRoom(roomId);
    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, game.state, { perPlayerState: false });
  }

  socket.on('game:gold-miner:launch', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gold_miner') return;

    const before = JSON.stringify(game.state);
    game.state = launchHook(game.state as GoldMinerGameState, member.id, Date.now());
    await applyUpdate(roomId, before);
    cb?.({ ok: JSON.stringify(game.state) !== before });
  });

  socket.on('game:gold-miner:use-dynamite', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gold_miner') return;

    const before = JSON.stringify(game.state);
    game.state = useDynamite(game.state as GoldMinerGameState, member.id);
    await applyUpdate(roomId, before);
    cb?.({ ok: JSON.stringify(game.state) !== before });
  });

  socket.on('game:gold-miner:shop-buy', async (payload, cb) => {
    const parsed = shopBuySchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gold_miner') return;

    const before = JSON.stringify(game.state);
    game.state = buyShopItem(
      game.state as GoldMinerGameState,
      member.id,
      parsed.data.item as ShopItemType,
    );
    await applyUpdate(roomId, before);
    cb?.({ ok: JSON.stringify(game.state) !== before });
  });

  socket.on('game:gold-miner:shop-done', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'gold_miner') return;

    const before = JSON.stringify(game.state);
    game.state = skipShop(game.state as GoldMinerGameState, member.id);
    await applyUpdate(roomId, before);
    cb?.({ ok: JSON.stringify(game.state) !== before });
  });
}

export function startGoldMinerTimer(
  io: Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
  processBots: (roomId: string) => Promise<void>,
) {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'gold_miner') continue;
      const before = JSON.stringify(game.state);
      game.state = tickGoldMiner(game.state as GoldMinerGameState, now);
      if (JSON.stringify(game.state) === before) continue;

      roomManager.touchGameRoom(roomId);
      if (roomManager.isGameStateEnded(game.gameType, game.state)) {
        await roomManager.markGameEnded(roomId);
      }
      await emitGameState(roomId);
      await emitRoomIfGameEnded(roomId, game.state);
      await processBots(roomId);
    }
  }, 50);
}
