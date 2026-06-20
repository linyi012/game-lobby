import type { Socket } from 'socket.io';
import { z } from 'zod';
import type { RoomManager } from '../../services/room-manager.js';
import {
  pickSupply,
  playSupplyForThirst,
  pickNavigation,
  respondToRequest,
  skipThirst,
  submitAction,
  submitCombatSupport,
  type LifeboatGameState,
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

const supplyPickSchema = z.object({ cardIndex: z.number().int().min(0) });

const actionSchema = z.object({
  type: z.enum(['row', 'swap', 'steal', 'special', 'pass']),
  targetPlayerId: z.string().uuid().optional(),
  supplyCardId: z.string().optional(),
  specialCardId: z.string().optional(),
});

const respondSchema = z.object({ accept: z.boolean() });

const combatSupportSchema = z.object({
  side: z.enum(['attacker', 'defender', 'none']),
});

const navigationPickSchema = z.object({ cardIndex: z.number().int().min(0) });

const playSupplySchema = z.object({
  cardId: z.string(),
  context: z.enum(['thirst', 'combat', 'special']).optional(),
});

export function registerLifeboatSockets(socket: Socket, deps: GameSocketDeps) {
  const { roomManager, getRoomId, findMember, afterGameUpdate } = deps;

  async function applyUpdate(roomId: string, state: LifeboatGameState) {
    const game = roomManager.getGame(roomId);
    if (!game) return;
    game.state = state;
    roomManager.touchGameRoom(roomId);
    if (roomManager.isGameStateEnded(game.gameType, state)) {
      await roomManager.markGameEnded(roomId);
    }
    await afterGameUpdate(roomId, state, { perPlayerState: true });
  }

  async function withLifeboatGame(
    cb: (roomId: string, memberId: string, state: LifeboatGameState) => LifeboatGameState | Promise<LifeboatGameState>,
  ) {
    const roomId = getRoomId(socket);
    if (!roomId) return;
    const user = socket.data.user as { id: string };
    const member = await findMember(roomId, user.id);
    if (!member) return;
    const game = roomManager.getGame(roomId);
    if (!game || game.gameType !== 'lifeboat') return;
    const next = await cb(roomId, member.id, game.state as LifeboatGameState);
    if (next !== game.state) {
      await applyUpdate(roomId, next);
    }
  }

  socket.on('game:lifeboat:supply_pick', async (payload, cb) => {
    const parsed = supplyPickSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) =>
      pickSupply(state, memberId, parsed.data.cardIndex),
    );
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:action', async (payload, cb) => {
    const parsed = actionSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) =>
      submitAction(state, memberId, parsed.data),
    );
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:respond', async (payload, cb) => {
    const parsed = respondSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) =>
      respondToRequest(state, memberId, parsed.data.accept),
    );
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:combat_support', async (payload, cb) => {
    const parsed = combatSupportSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) =>
      submitCombatSupport(state, memberId, parsed.data.side),
    );
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:navigation_pick', async (payload, cb) => {
    const parsed = navigationPickSchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) =>
      pickNavigation(state, memberId, parsed.data.cardIndex),
    );
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:play_supply', async (payload, cb) => {
    const parsed = playSupplySchema.safeParse(payload);
    if (!parsed.success) {
      cb?.({ ok: false });
      return;
    }
    await withLifeboatGame((_roomId, memberId, state) => {
      if (parsed.data.context === 'thirst' || state.phase === 'thirst_resolve') {
        return playSupplyForThirst(state, memberId, parsed.data.cardId);
      }
      return state;
    });
    cb?.({ ok: true });
  });

  socket.on('game:lifeboat:skip_thirst', async (_payload, cb) => {
    await withLifeboatGame((_roomId, memberId, state) => skipThirst(state, memberId));
    cb?.({ ok: true });
  });
}
