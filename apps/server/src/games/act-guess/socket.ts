import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import {
  selectActGuessWord,
  submitActGuess,
  actGuessPerformerPass,
  actGuessPerformerConfirmCorrect,
  tickActGuess,
  type ActGuessGameState,
} from '@game-lobby/game-engine';
import type { RoomManager } from '../../services/room-manager.js';
import { registerGameTick } from '../../services/game-ticker.js';
import type { GameSocketDeps } from '../undercover/socket.js';

const selectWordSchema = z.object({ word: z.string().min(1).max(32) });
const guessSchema = z.object({ text: z.string().min(1).max(64) });
const confirmCorrectSchema = z.object({ playerId: z.string().uuid() });

let timerRegistered = false;

export function registerActGuessSockets(
  socket: Socket,
  deps: GameSocketDeps & { io?: Server },
) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  socket.on('game:act-guess:select-word', async (payload, cb) => {
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
    if (!game || game.gameType !== 'act_guess') return;

    const before = JSON.stringify(game.state);
    game.state = selectActGuessWord(
      game.state as ActGuessGameState,
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

  socket.on('game:act-guess:guess', async (payload, cb) => {
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
    if (!game || game.gameType !== 'act_guess') return;

    const before = JSON.stringify(game.state);
    game.state = submitActGuess(
      game.state as ActGuessGameState,
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

  socket.on('game:act-guess:pass', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'act_guess') return;

    const before = JSON.stringify(game.state);
    game.state = actGuessPerformerPass(
      game.state as ActGuessGameState,
      member.id,
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

  socket.on('game:act-guess:confirm-correct', async (payload, cb) => {
    const parsed = confirmCorrectSchema.safeParse(payload);
    const roomId = getRoomId(socket);
    if (!parsed.success || !roomId) {
      cb?.({ ok: false });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'act_guess') return;

    const before = JSON.stringify(game.state);
    game.state = actGuessPerformerConfirmCorrect(
      game.state as ActGuessGameState,
      member.id,
      parsed.data.playerId,
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

export function startActGuessTimer(
  io: Server,
  roomManager: RoomManager,
  emitGameState: (roomId: string) => Promise<void>,
  emitRoomIfGameEnded: (roomId: string, state: unknown) => Promise<void>,
) {
  if (timerRegistered) return;
  timerRegistered = true;

  registerGameTick(async () => {
    const now = Date.now();
    for (const [roomId, game] of roomManager.getActiveGameEntries()) {
      if (game.gameType !== 'act_guess') continue;
      const before = JSON.stringify(game.state);
      game.state = tickActGuess(game.state as ActGuessGameState, now);
      if (JSON.stringify(game.state) === before) continue;

      roomManager.touchGameRoom(roomId);
      if (roomManager.isGameStateEnded(game.gameType, game.state)) {
        await roomManager.markGameEnded(roomId);
      }
      await emitGameState(roomId);
      await emitRoomIfGameEnded(roomId, game.state);
    }
  });
}
