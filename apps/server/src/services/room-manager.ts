import { eq, asc } from 'drizzle-orm';
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
  playDaVinciTile,
  generateBotDaVinciMove,
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

export class RoomManager {
  private games = new Map<string, InMemoryGame>();
  private socketToMember = new Map<string, { roomId: string; memberId: string }>();

  constructor(private db: Database) {}

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
  ): Promise<RoomDetail | null> {
    const detail = await this.getRoomDetail(roomId);
    if (!detail) return null;

    let member = detail.players.find((p) => p.userId === user.id);
    if (!member) {
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
      member = this.mapMember(created!);
    } else {
      await this.db
        .update(roomMembers)
        .set({ isOnline: true })
        .where(eq(roomMembers.id, member.id));
    }

    this.socketToMember.set(socketId, { roomId, memberId: member.id });
    return this.getRoomDetail(roomId);
  }

  async leaveRoom(socketId: string): Promise<string | null> {
    const mapping = this.socketToMember.get(socketId);
    if (!mapping) return null;
    this.socketToMember.delete(socketId);

    await this.db
      .update(roomMembers)
      .set({ isOnline: false })
      .where(eq(roomMembers.id, mapping.memberId));

    return mapping.roomId;
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
      if (m.userId === detail.hostId) {
        role = 'host';
      } else if (spectatorIds.includes(m.id)) {
        role = 'spectator';
      } else if (activePlayerIds.includes(m.id)) {
        role = 'player';
      }
      await this.db.update(roomMembers).set({ role }).where(eq(roomMembers.id, m.id));
    }

    return this.getRoomDetail(roomId);
  }

  async startNextGame(roomId: string, requesterId: string): Promise<{ detail: RoomDetail; gameState: GameState; gameType: GameType } | null> {
    const detail = await this.getRoomDetail(roomId);
    const hostMember = detail?.players.find((p) => p.role === 'host');
    if (!detail || hostMember?.id !== requesterId) return null;

    const nextGame = this.pickNextGame(detail);
    if (!nextGame) return null;

    const meta = GAME_META[nextGame];
    const activePlayers = detail.players.filter(
      (p) => p.role === 'host' || p.role === 'player',
    );

    if (activePlayers.length < meta.minPlayers) {
      return null;
    }

    const participants = activePlayers.slice(0, meta.maxPlayers).map((p) => ({
      id: p.id,
      name: p.displayName,
      isBot: p.isBot,
    }));

    const state = createGame(nextGame, participants);
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

    const updated = await this.getRoomDetail(roomId);
    return updated ? { detail: updated, gameState: state, gameType: nextGame } : null;
  }

  getGame(roomId: string): InMemoryGame | undefined {
    return this.games.get(roomId);
  }

  async processUndercoverDescribe(roomId: string, playerId: string, description: string) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'undercover') return null;
    game.state = submitUndercoverDescription(game.state as UndercoverGameState, playerId, description);
    return game;
  }

  async processUndercoverVote(roomId: string, voterId: string, targetId: string) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'undercover') return null;
    game.state = submitUndercoverVote(game.state as UndercoverGameState, voterId, targetId);
    if ((game.state as UndercoverGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async processDaVinciMove(
    roomId: string,
    playerId: string,
    targetPlayerId: string,
    tileIndex: number,
    position: number,
  ) {
    const game = this.games.get(roomId);
    if (!game || game.gameType !== 'da_vinci_code') return null;
    game.state = playDaVinciTile(
      game.state as DaVinciGameState,
      playerId,
      targetPlayerId,
      tileIndex,
      position,
    );
    if ((game.state as DaVinciGameState).phase === 'ended') {
      await this.db.update(rooms).set({ status: 'waiting' }).where(eq(rooms.id, roomId));
    }
    return game;
  }

  async runBotTurns(roomId: string): Promise<InMemoryGame | null> {
    const game = this.games.get(roomId);
    if (!game) return null;

    const detail = await this.getRoomDetail(roomId);
    if (!detail) return game;

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
      let state = game.state as DaVinciGameState;
      const current = state.players[state.currentPlayerIndex];
      const member = detail.players.find((p) => p.id === current?.id);
      if (current?.isBot && member?.botDifficulty && state.phase === 'playing') {
        const move = generateBotDaVinciMove(state, current.id, member.botDifficulty);
        state = playDaVinciTile(
          state,
          current.id,
          move.targetPlayerId,
          move.tileIndex,
          move.position,
        );
        game.state = state;
      }
    }

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
