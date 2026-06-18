import type { GameModule } from '@game-lobby/game-core';
import {
  advanceFromDayAnnounce,
  advanceWerewolfFromReveal,
  advancePhaseOnTimeout,
  createWerewolfGame,
  endWerewolfSpeaking,
  pickRandomGuardTarget,
  pickRandomPeekTarget,
  pickRandomVoteTarget,
  pickRandomWolfTarget,
  redactWerewolfState,
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
  type WerewolfStartOptions,
} from './logic.js';

export type { WerewolfStartOptions } from './logic.js';

export const werewolfModule: GameModule<WerewolfGameState, WerewolfStartOptions> = {
  gameType: 'werewolf',

  create(participants, options = {}) {
    return createWerewolfGame(participants, options);
  },

  isEnded(state) {
    return state.phase === 'ended';
  },

  projectState(state, viewerId) {
    return redactWerewolfState(state, viewerId);
  },

  runBotTurn(state, ctx) {
    if (state.phase === 'ended') return null;

    const timed = advancePhaseOnTimeout(state, Date.now());
    if (timed !== state) return timed;

    const player = state.players.find((p) => p.id === ctx.playerId);
    if (!player?.isBot || !player.isAlive) return null;

    switch (state.phase) {
      case 'night_wolf': {
        if (player.role !== 'werewolf') return null;
        if (state.nightState.wolfVotes[ctx.playerId]) return null;
        const targetId = pickRandomWolfTarget(state, ctx.playerId);
        return targetId ? submitWolfVote(state, ctx.playerId, targetId) : null;
      }
      case 'night_seer': {
        if (player.role !== 'seer') return null;
        const targetId = pickRandomPeekTarget(state, ctx.playerId);
        return targetId ? submitSeerPeek(state, ctx.playerId, targetId) : null;
      }
      case 'night_witch': {
        if (player.role !== 'witch') return null;
        return submitWitchAction(state, ctx.playerId, 'skip');
      }
      case 'night_guard': {
        if (player.role !== 'guard') return null;
        const targetId = pickRandomGuardTarget(state, ctx.playerId);
        return targetId ? submitGuardProtect(state, ctx.playerId, targetId) : null;
      }
      case 'day_announce':
        return advanceFromDayAnnounce(state);
      case 'day_discuss': {
        if (state.discussionMode === 'sequential') {
          const speaker = state.players.filter((p) => p.isAlive)[state.currentSpeakerIndex];
          if (speaker?.id !== ctx.playerId) return null;
          const spoken = sendWerewolfSpeech(state, ctx.playerId, '我是好人。');
          return endWerewolfSpeaking(spoken, ctx.playerId);
        }
        return null;
      }
      case 'day_vote': {
        if (!player.canVote || state.dayVotes[ctx.playerId]) return null;
        const targetId = pickRandomVoteTarget(state, ctx.playerId);
        return targetId ? submitDayVote(state, ctx.playerId, targetId) : null;
      }
      case 'reveal':
        return advanceWerewolfFromReveal(state);
      case 'hunter_shoot': {
        if (state.pendingHunterId !== ctx.playerId) return null;
        const targetId = pickRandomVoteTarget(state, ctx.playerId);
        return targetId
          ? submitHunterShoot(state, ctx.playerId, targetId)
          : skipHunterShoot(state, ctx.playerId);
      }
      default:
        return null;
    }
  },
};
