import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  advanceFromDayAnnounce,
  advanceWerewolfFromReveal,
  advancePhaseOnTimeout,
  endWerewolfSpeaking,
  sendWerewolfSpeech,
  sendWolfChat,
  skipHunterShoot,
  submitDayVote,
  submitGuardProtect,
  submitHunterShoot,
  submitSeerPeek,
  submitWitchAction,
  submitWolfVote,
  type WerewolfGameState,
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
const targetSchema = z.object({ targetId: z.string().uuid() });
const witchSchema = z.object({
  action: z.enum(['heal', 'poison', 'skip']),
  targetId: z.string().uuid().optional(),
});

export function registerWerewolfSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function updateGame(roomId: string, state: WerewolfGameState) {
    const game = roomManager.getGame(roomId);
    if (!game) return;

    let next = advancePhaseOnTimeout(state, Date.now());
    game.state = next;
    roomManager.touchGameRoom(roomId);

    const shouldEndRoom =
      roomManager.isGameStateEnded(game.gameType, next) ||
      (next.phase === 'reveal' && next.gameContinues === false && next.winner != null);
    if (shouldEndRoom) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, next, { perPlayerState: true });
  }

  async function withMember(
    cb: (roomId: string, memberId: string) => Promise<void>,
  ) {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'werewolf') return;
    await cb(roomId, member.id);
  }

  function applyReducer(
    roomId: string,
    reducer: (prev: WerewolfGameState, memberId: string) => WerewolfGameState,
    memberId: string,
  ) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    const prev = game.state as WerewolfGameState;
    const next = reducer(prev, memberId);
    if (next === prev) return;
    return updateGame(roomId, next);
  }

  socket.on('game:werewolf:wolf_vote', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(roomId, (prev, id) => submitWolfVote(prev, id, parsed.data.targetId), memberId);
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:wolf_chat', async (payload, cb) => {
    const parsed = speechSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => sendWolfChat(prev, id, parsed.data.text),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:seer_peek', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(roomId, (prev, id) => submitSeerPeek(prev, id, parsed.data.targetId), memberId);
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:witch_act', async (payload, cb) => {
    const parsed = witchSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) =>
          submitWitchAction(prev, id, parsed.data.action, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:guard_protect', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitGuardProtect(prev, id, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:speech', async (payload, cb) => {
    const parsed = speechSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => sendWerewolfSpeech(prev, id, parsed.data.text),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:end_speaking', async (_payload, cb) => {
    await withMember(async (roomId, memberId) => {
      await applyReducer(roomId, (prev, id) => endWerewolfSpeaking(prev, id), memberId);
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:day_vote', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(roomId, (prev, id) => submitDayVote(prev, id, parsed.data.targetId), memberId);
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:hunter_shoot', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitHunterShoot(prev, id, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:skip_hunter', async (_payload, cb) => {
    await withMember(async (roomId, memberId) => {
      await applyReducer(roomId, (prev, id) => skipHunterShoot(prev, id), memberId);
      cb?.({ ok: true });
    });
  });

  socket.on('game:werewolf:continue', async (_payload, cb) => {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'werewolf') return;
    const prev = game.state as WerewolfGameState;
    let next = prev;
    if (prev.phase === 'day_announce') {
      next = advanceFromDayAnnounce(prev);
    } else if (prev.phase === 'reveal') {
      next = advanceWerewolfFromReveal(prev);
    } else {
      cb?.({ ok: false });
      return;
    }
    await updateGame(roomId, next);
    cb?.({ ok: true });
  });
}
