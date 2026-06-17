import { getActiveSocket } from '../../lib/socket';

export function emitUndercoverSpeech(text: string) {
  getActiveSocket()?.emit('game:undercover:speech', { text });
}

export function emitUndercoverEndSpeaking() {
  getActiveSocket()?.emit('game:undercover:end-speaking', {});
}

export function emitUndercoverVote(targetId: string) {
  getActiveSocket()?.emit('game:undercover:vote', { targetId });
}

export function emitUndercoverContinueReveal() {
  getActiveSocket()?.emit('game:undercover:continue-reveal', {});
}
