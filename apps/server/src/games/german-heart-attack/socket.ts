import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  chooseWildFruit,
  flipHeartAttackCard,
  slapHeartAttack,
  type HeartAttackGameState,
} from '@game-lobby/game-engine';

const heartAttackChooseWildSchema = z.object({
  fruit: z.enum(['cherry', 'strawberry', 'lemon', 'peach', 'apple']),
});

export interface GameSocketDeps {
  roomManager: RoomManager;
  getRoomId: (socket: Socket) => string | null;
  findMember: (roomId: string, userId: string) => Promise<{ id: string } | undefined>;
  afterGameUpdate: (
    roomId: string,
    state: unknown,
    options?: { perPlayerState?: boolean },
  ) => Promise<void>;
}

export function registerHeartAttackSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function applyUpdate(
    roomId: string,
    game: { gameType: import('@game-lobby/shared').GameType; state: HeartAttackGameState },
  ) {
    roomManager.touchGameRoom(roomId);
    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
  }

  socket.on('game:heartattack:flip', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'german_heart_attack') return;

    game.state = flipHeartAttackCard(game.state as HeartAttackGameState, member.id);
    await applyUpdate(roomId, {
      gameType: 'german_heart_attack',
      state: game.state as HeartAttackGameState,
    });
    cb?.({ ok: true });
  });

  socket.on('game:heartattack:slap', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'german_heart_attack') return;

    game.state = slapHeartAttack(game.state as HeartAttackGameState, member.id, Date.now());
    await applyUpdate(roomId, {
      gameType: 'german_heart_attack',
      state: game.state as HeartAttackGameState,
    });
    cb?.({ ok: true });
  });

  socket.on('game:heartattack:choose_wild', async (payload, cb) => {
    const parsed = heartAttackChooseWildSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'german_heart_attack') return;

    game.state = chooseWildFruit(
      game.state as HeartAttackGameState,
      member.id,
      parsed.data.fruit,
    );
    await applyUpdate(roomId, {
      gameType: 'german_heart_attack',
      state: game.state as HeartAttackGameState,
    });
    cb?.({ ok: true });
  });
}
