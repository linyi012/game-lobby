import type { Socket } from 'socket.io';
import { z } from 'zod';
import {
  advanceScriptMurderFromReveal,
  advanceScriptMurderPhaseOnTimeout,
  discoverClue,
  hostAdvancePhase,
  hostJumpAct,
  hostPause,
  hostRevealClue,
  sendScriptMurderSpeech,
  submitScriptMurderVote,
  type ScriptMurderGameState,
} from '@game-lobby/game-engine';
import type { GameSocketDeps } from '../undercover/socket.js';

const speechSchema = z.object({ text: z.string().min(1).max(500) });
const clueSchema = z.object({ clueId: z.string().min(1).max(64) });
const targetSchema = z.object({ targetId: z.string().uuid() });
const pauseSchema = z.object({ paused: z.boolean() });
const jumpActSchema = z.object({ actIndex: z.number().int().min(0) });

export function registerScriptMurderSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function updateGame(roomId: string, state: ScriptMurderGameState) {
    const game = roomManager.getGame(roomId);
    if (!game) return;

    let next = advanceScriptMurderPhaseOnTimeout(state, Date.now());
    game.state = next;
    roomManager.touchGameRoom(roomId);

    if (roomManager.isGameStateEnded(game.gameType, next)) {
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
    if (!game || game.gameType !== 'script_murder') return;
    await cb(roomId, member.id);
  }

  function applyReducer(
    roomId: string,
    reducer: (prev: ScriptMurderGameState, memberId: string) => ScriptMurderGameState,
    memberId: string,
  ) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    const prev = game.state as ScriptMurderGameState;
    const next = reducer(prev, memberId);
    if (next === prev) return;
    return updateGame(roomId, next);
  }

  function applyReducerNoMember(
    roomId: string,
    reducer: (prev: ScriptMurderGameState) => ScriptMurderGameState,
  ) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    const prev = game.state as ScriptMurderGameState;
    const next = reducer(prev);
    if (next === prev) return;
    return updateGame(roomId, next);
  }

  socket.on('game:script_murder:speech', async (payload, cb) => {
    const parsed = speechSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => sendScriptMurderSpeech(prev, id, parsed.data.text),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:vote', async (payload, cb) => {
    const parsed = targetSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => submitScriptMurderVote(prev, id, parsed.data.targetId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:search_clue', async (payload, cb) => {
    const parsed = clueSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      await applyReducer(
        roomId,
        (prev, id) => discoverClue(prev, id, parsed.data.clueId),
        memberId,
      );
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:host_advance', async (_payload, cb) => {
    await withMember(async (roomId, memberId) => {
      const game = roomManager.getGame(roomId);
      if (!game) return;
      const prev = game.state as ScriptMurderGameState;
      if (memberId !== prev.hostMemberId) {
        cb?.({ ok: false, message: '仅主持人可操作' });
        return;
      }
      const next = hostAdvancePhase(prev, memberId, Date.now());
      if (next === prev) {
        cb?.({ ok: false, message: '无法推进' });
        return;
      }
      await updateGame(roomId, next);
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:host_reveal_clue', async (payload, cb) => {
    const parsed = clueSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      const game = roomManager.getGame(roomId);
      if (!game) return;
      const prev = game.state as ScriptMurderGameState;
      if (memberId !== prev.hostMemberId) {
        cb?.({ ok: false, message: '仅主持人可操作' });
        return;
      }
      const next = hostRevealClue(prev, memberId, parsed.data.clueId);
      await updateGame(roomId, next);
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:host_pause', async (payload, cb) => {
    const parsed = pauseSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      const game = roomManager.getGame(roomId);
      if (!game) return;
      const prev = game.state as ScriptMurderGameState;
      if (memberId !== prev.hostMemberId) {
        cb?.({ ok: false, message: '仅主持人可操作' });
        return;
      }
      const next = hostPause(prev, memberId, parsed.data.paused);
      await updateGame(roomId, next);
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:host_jump_act', async (payload, cb) => {
    const parsed = jumpActSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false, message: '参数无效' });
      return;
    }
    await withMember(async (roomId, memberId) => {
      const game = roomManager.getGame(roomId);
      if (!game) return;
      const prev = game.state as ScriptMurderGameState;
      if (memberId !== prev.hostMemberId) {
        cb?.({ ok: false, message: '仅主持人可操作' });
        return;
      }
      const next = hostJumpAct(prev, memberId, parsed.data.actIndex, Date.now());
      await updateGame(roomId, next);
      cb?.({ ok: true });
    });
  });

  socket.on('game:script_murder:continue', async (_payload, cb) => {
    await withMember(async (roomId) => {
      await applyReducerNoMember(roomId, (prev) =>
        advanceScriptMurderFromReveal(prev, Date.now()),
      );
      cb?.({ ok: true });
    });
  });
}
