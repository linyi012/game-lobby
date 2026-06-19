import { getActiveSocket } from '../../lib/socket';

export function emitSelectWord(word: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:act-guess:select-word', { word }, resolve);
  });
}

export function emitGuess(text: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:act-guess:guess', { text }, resolve);
  });
}

export function emitPass() {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:act-guess:pass', {}, resolve);
  });
}

export function emitConfirmCorrect(playerId: string) {
  return new Promise<{ ok: boolean }>((resolve) => {
    getActiveSocket()?.emit('game:act-guess:confirm-correct', { playerId }, resolve);
  });
}
