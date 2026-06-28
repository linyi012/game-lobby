import { emitWithAck } from '../../lib/emit-with-ack';

type Ack = { ok: boolean };

export function emitSelectWord(word: string) {
  return emitWithAck<Ack>('game:act-guess:select-word', { word });
}

export function emitGuess(text: string) {
  return emitWithAck<Ack>('game:act-guess:guess', { text });
}

export function emitPass() {
  return emitWithAck<Ack>('game:act-guess:pass', {});
}

export function emitConfirmCorrect(playerId: string) {
  return emitWithAck<Ack>('game:act-guess:confirm-correct', { playerId });
}
