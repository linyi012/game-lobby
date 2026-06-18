import { getActiveSocket } from '../../lib/socket';

function emit(event: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit(event, payload, resolve);
  });
}

export function emitWolfVote(targetId: string) {
  return emit('game:werewolf:wolf_vote', { targetId });
}

export function emitWolfChat(text: string) {
  return emit('game:werewolf:wolf_chat', { text });
}

export function emitSeerPeek(targetId: string) {
  return emit('game:werewolf:seer_peek', { targetId });
}

export function emitWitchAct(action: 'heal' | 'poison' | 'skip', targetId?: string) {
  return emit('game:werewolf:witch_act', { action, targetId });
}

export function emitGuardProtect(targetId: string) {
  return emit('game:werewolf:guard_protect', { targetId });
}

export function emitWerewolfSpeech(text: string) {
  return emit('game:werewolf:speech', { text });
}

export function emitEndSpeaking() {
  return emit('game:werewolf:end_speaking', {});
}

export function emitDayVote(targetId: string) {
  return emit('game:werewolf:day_vote', { targetId });
}

export function emitHunterShoot(targetId: string) {
  return emit('game:werewolf:hunter_shoot', { targetId });
}

export function emitSkipHunter() {
  return emit('game:werewolf:skip_hunter', {});
}

export function emitContinue() {
  return emit('game:werewolf:continue', {});
}
