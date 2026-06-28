import { emitWithAck } from '../../lib/emit-with-ack';

export function emitUndercoverSpeech(text: string) {
  return emitWithAck<{ ok: boolean }>('game:undercover:speech', { text });
}

export function emitUndercoverEndSpeaking() {
  return emitWithAck<{ ok: boolean }>('game:undercover:end-speaking', {});
}

export function emitUndercoverVote(targetId: string) {
  return emitWithAck<{ ok: boolean }>('game:undercover:vote', { targetId });
}

export function emitUndercoverContinueReveal() {
  return emitWithAck<{ ok: boolean }>('game:undercover:continue-reveal', {});
}
