import { useEffect } from 'react';
import type { DrawStroke } from '@game-lobby/game-engine';
import { onStrokeDelta } from './socket';

export function useStrokeDelta(onDelta: (strokes: DrawStroke[]) => void) {
  useEffect(() => {
    return onStrokeDelta((payload) => onDelta(payload.strokes));
  }, [onDelta]);
}
