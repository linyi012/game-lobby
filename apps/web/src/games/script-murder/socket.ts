import { getActiveSocket } from '../../lib/socket';

function emit(event: string, payload: unknown): Promise<{ ok: boolean; message?: string }> {
  return new Promise((resolve) => {
    getActiveSocket()?.emit(event, payload, resolve);
  });
}

export function emitScriptMurderSpeech(text: string) {
  return emit('game:script_murder:speech', { text });
}

export function emitScriptMurderVote(targetId: string) {
  return emit('game:script_murder:vote', { targetId });
}

export function emitScriptMurderSearchClue(clueId: string) {
  return emit('game:script_murder:search_clue', { clueId });
}

export function emitScriptMurderHostAdvance() {
  return emit('game:script_murder:host_advance', {});
}

export function emitScriptMurderHostRevealClue(clueId: string) {
  return emit('game:script_murder:host_reveal_clue', { clueId });
}

export function emitScriptMurderHostPause(paused: boolean) {
  return emit('game:script_murder:host_pause', { paused });
}

export function emitScriptMurderHostJumpAct(actIndex: number) {
  return emit('game:script_murder:host_jump_act', { actIndex });
}

export function emitScriptMurderContinue() {
  return emit('game:script_murder:continue', {});
}
