import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  applyChessMove,
  resignChessGame,
  tickChessGame,
  type ChessGameState,
  type ChessPromotion,
} from '@game-lobby/game-engine';

const squareSchema = z.string().regex(/^[a-h][1-8]$/);
const promotionSchema = z.enum(['q', 'r', 'b', 'n']);

const chessMoveSchema = z.object({
  from: squareSchema,
  to: squareSchema,
  promotion: promotionSchema.optional(),
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

export function registerChessSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:chess:move', async (payload, cb) => {
    const parsed = chessMoveSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chess') return;

    game.state = applyChessMove(
      game.state as ChessGameState,
      member.id,
      parsed.data.from,
      parsed.data.to,
      parsed.data.promotion as ChessPromotion | undefined,
    );
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });

  socket.on('game:chess:resign', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'chess') return;

    game.state = resignChessGame(game.state as ChessGameState, member.id);
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }

    await afterGameUpdate(roomId, game.state);
    cb?.({ ok: true });
  });
}

let timerStarted = false;

export function startChessTimer(
  io: import('socket.io').Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
) {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'chess') continue;
      const before = JSON.stringify(game.state);
      game.state = tickChessGame(game.state as ChessGameState, now);
      if (JSON.stringify(game.state) === before) continue;

      roomManager.touchGameRoom(roomId);
      if (roomManager.isGameStateEnded(game.gameType, game.state)) {
        await roomManager.markGameEnded(roomId);
      }
      await emitGameState(roomId);
      await emitRoomIfGameEnded(roomId, game.state);
    }
  }, 1000);
}
