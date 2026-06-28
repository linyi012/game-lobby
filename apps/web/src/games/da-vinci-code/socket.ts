import { emitWithAck } from '../../lib/emit-with-ack';
import type { DaVinciColor } from '@game-lobby/game-engine';

export function emitDaVinciGuess(targetPlayerId: string, tileIndex: number, value: number) {
  return emitWithAck<{ ok: boolean }>('game:davinci:guess', { targetPlayerId, tileIndex, value });
}

export function emitDaVinciDecision(shouldContinue: boolean) {
  return emitWithAck<{ ok: boolean }>('game:davinci:decision', { continue: shouldContinue });
}

export function emitDaVinciPlace(index: number) {
  return emitWithAck<{ ok: boolean }>('game:davinci:place', { index });
}

export function emitDaVinciSetup(
  tiles: { color: DaVinciColor; value: number; isJoker: boolean }[],
) {
  return emitWithAck<{ ok: boolean }>('game:davinci:setup', { tiles });
}
