import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  advanceFromReveal,
  endUndercoverSpeaking,
  sendUndercoverSpeech,
  submitUndercoverVote,
  type UndercoverGameState,
} from '@game-lobby/game-engine';

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

const speechSchema = z.object({ text: z.string().min(1).max(200) });
const voteSchema = z.object({ targetId: z.string().uuid() });

export function registerUndercoverSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function updateGame(
    roomId: string,
    state: UndercoverGameState,
    ended?: boolean,
  ) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    game.state = state;
    roomManager.touchGameRoom(roomId);
    const shouldEndRoom =
      ended ||
      roomManager.isGameStateEnded(game.gameType, state) ||
      (state.phase === 'reveal' && state.gameContinues === false);
    if (shouldEndRoom) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, state, { perPlayerState: true });
  }

  socket.on('game:undercover:speech', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = speechSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    const prev = game.state as UndercoverGameState;
    const next = sendUndercoverSpeech(prev, member.id, parsed.data.text);
    if (next === prev) {
      cb?.({ ok: false, message: next.message });
      return;
    }
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:undercover:end-speaking', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    const prev = game.state as UndercoverGameState;
    const next = endUndercoverSpeaking(prev, member.id);
    if (next === prev) {
      cb?.({ ok: false });
      return;
    }
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:undercover:vote', async (payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const parsed = voteSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    const prev = game.state as UndercoverGameState;
    const next = submitUndercoverVote(prev, member.id, parsed.data.targetId);
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });

  socket.on('game:undercover:continue-reveal', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;

    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'undercover') return;

    const prev = game.state as UndercoverGameState;
    if (prev.phase !== 'reveal') {
      cb?.({ ok: false });
      return;
    }

    const next = advanceFromReveal(prev);
    const ended = next.phase === 'ended';
    await updateGame(roomId, next, ended);
    cb?.({ ok: true });
  });
}
