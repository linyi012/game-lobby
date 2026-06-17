import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  selectWord,
  appendStrokes,
  clearCanvas,
  submitGuess,
  tickDrawGuess,
  type DrawGuessGameState,
  type DrawStroke,
} from '@game-lobby/game-engine';
import type { RoomManager } from '../../services/room-manager.js';
import type { GameSocketDeps } from '../undercover/socket.js';

const selectWordSchema = z.object({ word: z.string().min(1).max(32) });
const strokeSchema = z.object({
  strokes: z.array(
    z.object({
      id: z.string(),
      points: z.array(z.number()),
      color: z.string(),
      width: z.number(),
      tool: z.enum(['pen', 'eraser']),
    }),
  ),
});
const guessSchema = z.object({ text: z.string().min(1).max(64) });

let timerStarted = false;

export function registerDrawGuessSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: Server },
) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:draw-guess:select-word', async (payload, cb) => {
    const parsed = selectWordSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'draw_guess') return;

    const before = JSON.stringify(game.state);
    game.state = selectWord(
      game.state as DrawGuessGameState,
      member.id,
      parsed.data.word,
      Date.now(),
    );
    if (JSON.stringify(game.state) === before) {
      cb?.({ ok: false });
      return;
    }

    roomManager.touchGameRoom(roomId);
    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });

  socket.on('game:draw-guess:stroke', async (payload, cb) => {
    const parsed = strokeSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'draw_guess') return;

    const beforeLen = (game.state as DrawGuessGameState).strokes.length;
    game.state = appendStrokes(
      game.state as DrawGuessGameState,
      member.id,
      parsed.data.strokes as DrawStroke[],
    );
    const afterLen = (game.state as DrawGuessGameState).strokes.length;
    if (afterLen === beforeLen) {
      cb?.({ ok: false });
      return;
    }

    roomManager.touchGameRoom(roomId);
    const io = deps.io;
    if (io) {
      socket.to(roomId).emit('game:draw-guess:stroke-delta', {
        strokes: parsed.data.strokes,
      });
    }
    cb?.({ ok: true });
  });

  socket.on('game:draw-guess:clear', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'draw_guess') return;

    game.state = clearCanvas(game.state as DrawGuessGameState, member.id);
    roomManager.touchGameRoom(roomId);
    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });

  socket.on('game:draw-guess:guess', async (payload, cb) => {
    const parsed = guessSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'draw_guess') return;

    const before = JSON.stringify(game.state);
    game.state = submitGuess(
      game.state as DrawGuessGameState,
      member.id,
      parsed.data.text,
      Date.now(),
    );
    if (JSON.stringify(game.state) === before) {
      cb?.({ ok: false });
      return;
    }

    roomManager.touchGameRoom(roomId);
    if (roomManager.isGameStateEnded(game.gameType, game.state)) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, game.state, { perPlayerState: true });
    cb?.({ ok: true });
  });
}

export function startDrawGuessTimer(
  io: Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
) {
  if (timerStarted) return;
  timerStarted = true;

  setInterval(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'draw_guess') continue;
      const before = JSON.stringify(game.state);
      game.state = tickDrawGuess(game.state as DrawGuessGameState, now);
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
