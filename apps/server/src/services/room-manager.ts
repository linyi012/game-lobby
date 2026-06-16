import { eq, asc, and } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';
import {
  rooms,
  roomMembers,
  roomGameQueue,
  type Database,
} from '@game-lobby/db';
import type {
  AiDifficulty,
  GameQueueItem,
  GameQueueMode,
  GameType,
  RoomDetail,
  RoomPlayer,
  RoomSummary,
} from '@game-lobby/shared';
import { ALL_GAME_TYPES, GAME_META } from '@game-lobby/shared';
import {
  createGame,
  submitUndercoverDescription,
  submitUndercoverVote,
  generateBotDescription,
  generateBotVote,
  guessDaVinciTile,
  decideDaVinciContinue,
  placeDaVinciJoker,
  submitDaVinciSetup,
  generateBotDaVinciMove,
  generateBotDaVinciDecision,
  generateBotDaVinciPlacement,
  type GameOptions,
  type GameState,
  type UndercoverGameState,
  type DaVinciGameState,
} from '@game-lobby/game-engine';

interface InMemoryGame {
  sessionId: string;
  gameType: GameType;
  state: GameState;
  activePlayerIds: string[];
}

export type RoomCloseReason = 'empty' | 'idle' | 'stale';

export class RoomManager {
  private games = new Map<string, InMemoryGame>();
  private socketToMember = new Map<string, { roomId: string; memberId: string }>();
  // Per-key promise chain used to serialize membership mutations and avoid
  // race conditions (e.g. duplicate members when a client joins twice rapidly).
  private locks = new Map<string, Promise<unknown>>();
  // Empty rooms are closed after a grace period so brief disconnects / page
  // refreshes (incl. React StrictMode double-mount) don't destroy the room.
  private pendingClose = new Map<string, NodeJS.Timeout>();
  // Last time anything meaningful happened in a room (join/leave, settings
  // change, or a game move). Drives the idle-room and stale-game timeouts.
  private roomActivity = new Map<string, number>();
  private sweeper?: NodeJS.Timeout;
  private onRoomClosed?: (roomId: string, reason: RoomCloseReason) => void;
  private static readonly EMPTY_ROOM_GRACE_MS = 30_000;
  // A room that never starts a game is closed after this long without activity.
  private static readonly IDLE_ROOM_TIMEOUT_MS =
    Number(process.env.IDLE_ROOM_TIMEOUT_MS) || 15 * 60_000;
  // A running game that makes no progress (e.g. waiting on a player who left)
  // is closed after this long without activity.
  private static readonly STALE_GAME_TIMEOUT_MS =
    Number(process.env.STALE_GAME_TIMEOUT_MS) || 5 * 60_000;
  private static readonly SWEEP_INTERVAL_MS = 30_000;

  constructor(private db: Database) {}

  setRoomClosedListener(cb: (roomId: string, reason: RoomCloseReason) => void) {
    this.onRoomClosed = cb;
  }

  // Starts the periodic timeout sweeper. Returns a function that stops it.
  startSweeper(): () => void {
    if (!this.sweeper) {
      this.sweeper = setInterval(() => {
        void this.sweepTimeouts();
      }, RoomManager.SWEEP_INTERVAL_MS);
      if (typeof this.sweeper.unref === 'function') this.sweeper.unref();
    }
    return () => this.stopSweeper();
  }

  stopSweeper() {
    if (this.sweeper) {
      clearInterval(this.sweeper);
      this.sweeper = undefined;
    }
  }

  private touchRoom(roomId: string) {
    this.roomActivity.set(roomId, Date.now());
  }

  private isGameEnded(game: InMemoryGame): boolean {
    return (game.state as { phase?: string }).phase === 'ended';
  }

  // Returns whether a room has exceeded its timeout, and which kind. A room
  // with an active (not-yet-ended) game uses the stale-game timeout; any other
  // room (waiting, or holding a finished game) uses the idle-room timeout.
  private getTimeoutStatus(room: typeof rooms.$inferSelect): {
    timedOut: boolean;
    reason: Exclude<RoomCloseReason, 'empty'>;
  } {
    const game = this.games.get(room.id);
    const hasActiveGame = room.status === 'playing' && !!game && !this.isGameEnded(game);
    const reason = hasActiveGame ? 'stale' : 'idle';
    const limit = hasActiveGame
      ? RoomManager.STALE_GAME_TIMEOUT_MS
      : RoomManager.IDLE_ROOM_TIMEOUT_MS;
    const last = this.roomActivity.get(room.id) ?? room.createdAt.getTime();
    return { timedOut: Date.now() - last >= limit, reason };
  }

  private async sweepTimeouts() {
    const allRooms = await this.db.select().from(rooms);
    for (const room of allRooms) {
      if (this.getTimeoutStatus(room).timedOut) {
        await this.finalizeTimeoutClose(room.id);
      }
    }
  }

  private async finalizeTimeoutClose(roomId: string) {
    await this.runExclusive(`room:${roomId}`, async () => {
      const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room) return;

      // Re-check under the lock so we don't close a room that just saw activity.
      const { timedOut, reason } = this.getTimeoutStatus(room);
      if (!timedOut) return;

      this.cancelScheduledClose(roomId);
      await this.db.delete(rooms).where(eq(rooms.id, roomId));
      this.games.delete(roomId);
      this.roomActivity.delete(roomId);
      this.forgetRoomSockets(roomId);
      this.onRoomClosed?.(roomId, reason);
    });
  }

  private runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(key) ?? Promise.resolve();
    const run = prev.then(task, task);
    this.locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  async listRooms(): Promise<RoomSummary[]> {
    const allRooms = await this.db.select().from(rooms).orderBy(asc(rooms.createdAt));
    const summaries: RoomSummary[] = [];

    for (const room of allRooms) {
      const members = await this.getMembers(room.id);
      summaries.push(this.toSummary(room, members));
    }
    return summaries;
  }

  async createRoom(input: {
    name: string;
    hostUserId: string;
    hostUsername: string;
    hostDisplayName: string;
    maxPlayers: number;
  }): Promise<RoomDetail> {
    const [room] = await this.db
      .insert(rooms)
      .values({
        name: input.name,
        hostUserId: input.hostUserId,
        maxPlayers: input.maxPlayers,
        queueMode: 'ordered',
      })
      .returning();

    const [hostMember] = await this.db
      .insert(roomMembers)
      .values({
        roomId: room!.id,
        userId: input.hostUserId,
        username: input.hostUsername,
        displayName: input.hostDisplayName,
        role: 'host',
        isOnline: true,
        isReady: true,
      })
      .returning();

    const queueItems = ALL_GAME_TYPES.map((gameType, i) => ({
      roomId: room!.id,
      gameType,
      sortOrder: i,
    }));
    await this.db.insert(roomGameQueue).values(queueItems);

    this.touchRoom(room!.id);
    const members = [this.mapMember(hostMember!)];
    return this.toDetail(room!, members, queueItems.map((q, i) => ({ gameType: q.gameType as GameType, order: i })));
  }

  async getRoomDetail(roomId: string): Promise<RoomDetail | null> {
    const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
    if (!room) return null;

    const members = await this.getMembers(roomId);
    const queue = await this.db
      .select()
      .from(roomGameQueue)
      .where(eq(roomGameQueue.roomId, roomId))
      .orderBy(asc(roomGameQueue.sortOrder));

    return this.toDetail(
      room,
      members,
      queue.map((q) => ({ gameType: q.gameType as GameType, order: q.sortOrder })),
    );
  }

  async joinRoom(
    roomId: string,
    user: { id: string; username: string; displayName: string },
    socketId: string,
  ): Promise<{
    detail: RoomDetail;
    leftRooms: { roomId: string; deleted: boolean }[];
    kickedSockets: { socketId: string; roomId: string }[];
  } | null> {
    return this.runExclusive(`room:${roomId}`, async () => {
      const [room] = await this.db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!room) return null;

      // Someone is (re)joining, so cancel any pending auto-close for this room.
      this.cancelScheduledClose(roomId);
      this.touchRoom(roomId);

      // A player may only be in one room at a time: remove them from any others.
      const { leftRooms, kickedSockets } = await this.removeUserFromOtherRooms(user.id, roomId);

      // Look up existing membership directly so a duplicate is never created,
      // and clean up any pre-existing duplicates for safety.
      const existing = await this.db
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, user.id)));

      let memberId: string;
      if (existing.length > 0) {
        memberId = existing[0]!.id;
        for (const dup of existing.slice(1)) {
          await this.db.delete(roomMembers).where(eq(roomMembers.id, dup.id));
        }
        await this.db
          .update(roomMembers)
          .set({ isOnline: true, displayName: user.displayName })
          .where(eq(roomMembers.id, memberId));
      } else {
        const [created] = await this.db
          .insert(roomMembers)
          .values({
            roomId,
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            role: 'player',
            isOnline: true,
          })
          .returning();
        memberId = created!.id;
      }

      this.socketToMember.set(socketId, { roomId, memberId });
      const detail = await this.getRoomDetail(roomId);
      return detail ? { detail, leftRooms, kickedSockets } : null;
    });
  }

  async leaveRoom(socketId: string): Promise<{ roomId: string; deleted: boolean } | null> {
    const mapping = this.socketToMember.get(socketId);
    if (!mapping) return null;
    this.socketToMember.delete(socketId);

    return this.runExclusive(`room:${mapping.roomId}`, async () => {
      await this.db
        .update(roomMembers)
        .set({ isOnline: false })
        .where(eq(roomMembers.id, mapping.memberId));

      this.touchRoom(mapping.roomId);
      const deleted = await this.cleanupRoom(mapping.roomId);
      return { roomId: mapping.roomId, deleted };
    });
  }

  async closeRoom(roomId: string, requesterId: string): Promise<boolean> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return false;

    this.cancelScheduledClose(roomId);
    await this.db.delete(rooms).where(eq(rooms.id, roomId));
    this.games.delete(roomId);
    this.roomActivity.delete(roomId);
    this.forgetRoomSockets(roomId);
    return true;
  }

  // Removes the user from every room except `exceptRoomId`, cleaning up empty
  // rooms and reassigning the host when needed. Returns the affected rooms and
  // the still-connected sockets that were viewing those rooms (so they can be
  // redirected out).
  private async removeUserFromOtherRooms(
    userId: string,
    exceptRoomId: string,
  ): Promise<{
    leftRooms: { roomId: string; deleted: boolean }[];
    kickedSockets: { socketId: string; roomId: string }[];
  }> {
    const memberships = await this.db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.userId, userId));

    const leftRooms: { roomId: string; deleted: boolean }[] = [];
    const kickedSockets: { socketId: string; roomId: string }[] = [];
    const otherRoomIds = new Set(
      memberships.map((m) => m.roomId).filter((id) => id !== exceptRoomId),
    );

    for (const m of memberships) {
      if (m.roomId === exceptRoomId) continue;
      await this.db.delete(roomMembers).where(eq(roomMembers.id, m.id));
      for (const [sid, map] of this.socketToMember) {
        if (map.memberId === m.id) {
          kickedSockets.push({ socketId: sid, roomId: m.roomId });
          this.socketToMember.delete(sid);
        }
      }
    }

    for (const otherRoomId of otherRoomIds) {
      const deleted = await this.cleanupRoom(otherRoomId);
      leftRooms.push({ roomId: otherRoomId, deleted });
    }

    return { leftRooms, kickedSockets };
  }

  // Schedules an empty room for deletion (after a grace period) and otherwise
  // ensures a host still exists. Returns true only on immediate deletion (none
  // here, since closing is deferred); callers treat the room as still present.
  private async cleanupRoom(roomId: string): Promise<boolean> {
    const members = await this.getMembers(roomId);
    const onlineHumans = members.filter((m) => !m.isBot && m.isOnline);

    if (members.length === 0 || onlineHumans.length === 0) {
      this.scheduleRoomClose(roomId);
      return false;
    }

    // A human is present, so cancel any pending auto-close.
    this.cancelScheduledClose(roomId);

    // Reassign the host only when the host membership is actually gone (e.g.
    // kicked or moved to another room) — not for a host that is merely offline.
    const hasHost = members.some((m) => m.role === 'host');
    if (!hasHost) {
      const newHost = onlineHumans[0]!;
      if (newHost.userId) {
        await this.db
          .update(roomMembers)
          .set({ role: 'host' })
          .where(eq(roomMembers.id, newHost.id));
        await this.db
          .update(rooms)
          .set({ hostUserId: newHost.userId })
          .where(eq(rooms.id, roomId));
      }
    }

    return false;
  }

  private scheduleRoomClose(roomId: string) {
    if (this.pendingClose.has(roomId)) return;
    const timer = setTimeout(() => {
      this.pendingClose.delete(roomId);
      void this.finalizeRoomClose(roomId);
    }, RoomManager.EMPTY_ROOM_GRACE_MS);
    if (typeof timer.unref === 'function') timer.unref();
    this.pendingClose.set(roomId, timer);
  }

  private cancelScheduledClose(roomId: string) {
    const timer = this.pendingClose.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.pendingClose.delete(roomId);
    }
  }

  private async finalizeRoomClose(roomId: string) {
    await this.runExclusive(`room:${roomId}`, async () => {
      const members = await this.getMembers(roomId);
      const onlineHumans = members.filter((m) => !m.isBot && m.isOnline);
      if (onlineHumans.length > 0) return; // someone came back during the grace period

      await this.db.delete(rooms).where(eq(rooms.id, roomId));
      this.games.delete(roomId);
      this.roomActivity.delete(roomId);
      this.forgetRoomSockets(roomId);
      this.onRoomClosed?.(roomId, 'empty');
    });
  }

  private forgetRoomSockets(roomId: string) {
    for (const [sid, map] of this.socketToMember) {
      if (map.roomId === roomId) this.socketToMember.delete(sid);
    }
  }

  async addBot(
    roomId: string,
    difficulty: AiDifficulty,
    requesterId: string,
  ): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const botName = `电脑-${difficulty}-${Math.floor(Math.random() * 1000)}`;
    await this.db.insert(roomMembers).values({
      roomId,
      userId: null,
      username: botName,
      displayName: botName,
      isBot: true,
      botDifficulty: difficulty,
      role: 'player',
      isOnline: true,
      isReady: true,
    });

    this.touchRoom(roomId);
    return this.getRoomDetail(roomId);
  }

  async removeMember(roomId: string, memberId: string, requesterId: string): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    await this.db.delete(roomMembers).where(eq(roomMembers.id, memberId));
    return this.getRoomDetail(roomId);
  }

  async updateQueue(
    roomId: string,
    queue: GameQueueItem[],
    mode: GameQueueMode,
    requesterId: string,
  ): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    await this.db.delete(roomGameQueue).where(eq(roomGameQueue.roomId, roomId));
    if (queue.length > 0) {
      await this.db.insert(roomGameQueue).values(
        queue.map((item, i) => ({
          roomId,
          gameType: item.gameType,
          sortOrder: item.order ?? i,
        })),
      );
    }

    await this.db.update(rooms).set({ queueMode: mode }).where(eq(rooms.id, roomId));
    this.touchRoom(roomId);
    return this.getRoomDetail(roomId);
  }

  async setParticipantRoles(
    roomId: string,
    activePlayerIds: string[],
    spectatorIds: string[],
    requesterId: string,
  ): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const members = await this.getMembers(roomId);
    for (const m of members) {
      let role = m.role;
      if (m.id === detail.hostId) {
        role = 'host';
      } else if (spectatorIds.includes(m.id)) {
        role = 'spectator';
      } else if (activePlayerIds.includes(m.id)) {
        role = 'player';
      }
      await this.db.update(roomMembers).set({ role }).where(eq(roomMembers.id, m.id));
    }

    this.touchRoom(roomId);
    return this.getRoomDetail(roomId);
  }

  async startNextGame(
    roomId: string,
    requesterId: string,
    options: GameOptions = {},
  ): Promise<
    | { ok: true; detail: RoomDetail; gameState: GameState; gameType: GameType }
    | { ok: false; message: string }
  > {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) {
      return { ok: false, message: '仅房主可开始游戏' };
    }

    const nextGame = this.pickNextGame(detail);
    if (!nextGame) {
      return { ok: false, message: '游戏队列为空，请先在右侧添加并保存游戏。' };
    }

    // Bots cannot meaningfully play 谁是卧底 (they rely on natural-language
    // descriptions), so automatically move them to spectators for this game.
    if (nextGame === 'undercover') {
      const activeBots = detail.players.filter((p) => p.isBot && p.role !== 'spectator');
      for (const bot of activeBots) {
        await this.db
          .update(roomMembers)
          .set({ role: 'spectator' })
          .where(eq(roomMembers.id, bot.id));
      }
    }

    const roster = nextGame === 'undercover' ? await this.getRoomDetail(roomId) : detail;
    if (!roster) return { ok: false, message: '房间不存在' };

    const meta = GAME_META[nextGame];
    const activePlayers = roster.players.filter(
      (p) => p.role === 'host' || p.role === 'player',
    );

    if (activePlayers.length < meta.minPlayers) {
      const hint =
        nextGame === 'undercover'
          ? '（电脑无法参与谁是卧底，已自动设为旁观）'
          : '';
      return {
        ok: false,
        message: `下一局是「${meta.name}」，需要至少 ${meta.minPlayers} 名玩家，当前仅 ${activePlayers.length} 名。${hint}`,
      };
    }

    const participants = activePlayers.slice(0, meta.maxPlayers).map((p) => ({
      id: p.id,
      name: p.displayName,
      isBot: p.isBot,
    }));

    const state = createGame(nextGame, participants, options);
    const sessionId = uuid();

    this.games.set(roomId, {
      sessionId,
      gameType: nextGame,
      state,
      activePlayerIds: participants.map((p) => p.id),
    });

    await this.db
      .update(rooms)
      .set({ status: 'playing', currentGame: nextGame })
      .where(eq(rooms.id, roomId));

    this.touchRoom(roomId);
    const updated = await this.getRoomDetail(roomId);
    return updated
      ? { ok: true, detail: updated, gameState: state, gameType: nextGame }
      : { ok: false, message: '房间不存在' };
  }

  getGame(roomId: string): InMemoryGame | undefined {
    return this.games.get(roomId);
  }

  async processUndercoverDescribe(roomId: string, playerId: string, description: string) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'undercover') return null;
    game.state = submitUndercoverDescription(game.state as UndercoverGameState, playerId, description);
    this.touchRoom(roomId);
    return game;
  }

  async processUndercoverVote(roomId: string, voterId: string, targetId: string) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'undercover') return null;
    game.state = submitUndercoverVote(game.state as UndercoverGameState, voterId, targetId);
    this.touchRoom(roomId);
    if ((game.state as UndercoverGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async processDaVinciGuess(
    roomId: string,
    playerId: string,
    targetPlayerId: string,
    tileIndex: number,
    value: number,
  ) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return null;
    game.state = guessDaVinciTile(
      game.state as DaVinciGameState,
      playerId,
      targetPlayerId,
      tileIndex,
      value,
    );
    this.touchRoom(roomId);
    if ((game.state as DaVinciGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async processDaVinciDecision(roomId: string, playerId: string, shouldContinue: boolean) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return null;
    game.state = decideDaVinciContinue(
      game.state as DaVinciGameState,
      playerId,
      shouldContinue,
    );
    this.touchRoom(roomId);
    if ((game.state as DaVinciGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async processDaVinciPlace(roomId: string, playerId: string, index: number) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return null;
    game.state = placeDaVinciJoker(game.state as DaVinciGameState, playerId, index);
    this.touchRoom(roomId);
    if ((game.state as DaVinciGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async processDaVinciSetup(
    roomId: string,
    playerId: string,
    tiles: { color: 'black' | 'white'; value: number; isJoker: boolean }[],
  ) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return null;
    game.state = submitDaVinciSetup(game.state as DaVinciGameState, playerId, tiles);
    this.touchRoom(roomId);
    return game;
  }

  async runBotTurns(roomId: string): Promise<InMemoryGame | null> {
    const game = this.games.get(roomId);
    if (!game) return null;

    const detail = await this.getRoomDetail(roomId);
    if (!detail) return game;

    // A bot move counts as activity; if nothing changes (e.g. it's a human's
    // turn), we leave the activity timestamp alone so the stale-game timeout
    // can eventually fire on an absent player.
    const before = JSON.stringify(game.state);

    if (game.gameType === 'undercover') {
      let state = game.state as UndercoverGameState;
      const alive = state.players.filter((p) => p.isAlive);

      if (state.phase === 'describe') {
        const speaker = alive[state.currentSpeakerIndex];
        const member = detail.players.find((p) => p.id === speaker?.id);
        if (speaker?.isBot && member?.botDifficulty) {
          const desc = generateBotDescription(speaker, member.botDifficulty);
          state = submitUndercoverDescription(state, speaker.id, desc);
          game.state = state;
        }
      } else if (state.phase === 'vote') {
        for (const p of alive) {
          if (!p.isBot || state.votes[p.id]) continue;
          const member = detail.players.find((m) => m.id === p.id);
          if (!member?.botDifficulty) continue;
          const target = generateBotVote(state, p.id, member.botDifficulty);
          state = submitUndercoverVote(state, p.id, target);
          game.state = state;
          if (state.phase !== 'vote') break;
        }
      }
    }

    if (game.gameType === 'da_vinci_code') {
      const state = game.state as DaVinciGameState;
      const current = state.players[state.currentPlayerIndex];
      const member = detail.players.find((p) => p.id === current?.id);
      if (current?.isBot && member?.botDifficulty && state.phase === 'playing') {
        // One atomic step per call (guess OR decide); processBots loops so each
        // bot action is broadcast separately and the turn animates naturally.
        if (state.stage === 'guessing') {
          const move = generateBotDaVinciMove(state, current.id, member.botDifficulty);
          game.state = guessDaVinciTile(
            state,
            current.id,
            move.targetPlayerId,
            move.tileIndex,
            move.value,
          );
        } else if (state.stage === 'placing') {
          const index = generateBotDaVinciPlacement(state, current.id);
          game.state = placeDaVinciJoker(state, current.id, index);
        } else {
          const keepGoing = generateBotDaVinciDecision(state, current.id, member.botDifficulty);
          game.state = decideDaVinciContinue(state, current.id, keepGoing);
        }
        if ((game.state as DaVinciGameState).phase === 'ended') {
          await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
        }
      }
    }

    if (JSON.stringify(game.state) !== before) this.touchRoom(roomId);
    return game;
  }

  private pickNextGame(detail: RoomDetail): GameType | null {
    if (detail.gameQueue.length === 0) return null;
    if (detail.queueMode === 'random') {
      const item = detail.gameQueue[Math.floor(Math.random() * detail.gameQueue.length)]!;
      return item.gameType;
    }
    return detail.gameQueue[0]!.gameType;
  }

  private async getMembers(roomId: string) {
    const rows = await this.db
      .select()
      .from(roomMembers)
      .where(eq(roomMembers.roomId, roomId));
    return rows.map((r) => this.mapMember(r));
  }

  private mapMember(row: typeof roomMembers.$inferSelect): RoomPlayer {
    return {
      id: row.id,
      userId: row.userId,
      username: row.username,
      displayName: row.displayName,
      isBot: row.isBot,
      botDifficulty: row.botDifficulty as AiDifficulty | null,
      role: row.role as RoomPlayer['role'],
      isOnline: row.isOnline,
      isReady: row.isReady,
    };
  }

  private toSummary(room: typeof rooms.$inferSelect, members: RoomPlayer[]): RoomSummary {
    const host = members.find((m) => m.role === 'host');
    return {
      id: room.id,
      name: room.name,
      hostId: host?.id ?? room.hostUserId,
      status: room.status as RoomSummary['status'],
      currentGame: room.currentGame as GameType | null,
      playerCount: members.filter((m) => m.role !== 'spectator').length,
      spectatorCount: members.filter((m) => m.role === 'spectator').length,
      maxPlayers: room.maxPlayers,
      players: members,
      createdAt: room.createdAt.toISOString(),
    };
  }

  private toDetail(
    room: typeof rooms.$inferSelect,
    members: RoomPlayer[],
    queue: GameQueueItem[],
  ): RoomDetail {
    const summary = this.toSummary(room, members);
    return {
      ...summary,
      gameQueue: queue,
      queueMode: room.queueMode as GameQueueMode,
      activePlayerIds: members.filter((m) => m.role !== 'spectator').map((m) => m.id),
      spectatorIds: members.filter((m) => m.role === 'spectator').map((m) => m.id),
    };
  }
}
