import type { ReactNode } from 'react';
import { Suspense, useEffect, useState } from 'react';
import type { GameType } from '@game-lobby/shared';
import type { GameState } from '@game-lobby/game-engine';
import { isGameEnded } from '@game-lobby/game-engine/lite';
import { LAZY_GAME_COMPONENTS, loadRoomSettings } from './lazy-components';
import type { RoomSettingsProps, WebGameModule } from './types';

export type { GameComponentProps, RoomSettingsProps } from './types';

function buildRegistry(): Record<GameType, WebGameModule> {
  const types = Object.keys(LAZY_GAME_COMPONENTS) as GameType[];
  return Object.fromEntries(
    types.map((gameType) => [
      gameType,
      {
        Component: LAZY_GAME_COMPONENTS[gameType],
        isEnded: (state: unknown) => isGameEnded(gameType, state as GameState),
      },
    ]),
  ) as Record<GameType, WebGameModule>;
}

export const GAME_REGISTRY = buildRegistry();

function LazyRoomSettingsPanel({
  gameType,
  ...props
}: RoomSettingsProps & { gameType: GameType }) {
  const [Settings, setSettings] = useState<React.ComponentType<RoomSettingsProps> | null>(null);

  useEffect(() => {
    let mounted = true;
    void loadRoomSettings(gameType).then((component) => {
      if (mounted) setSettings(() => component);
    });
    return () => {
      mounted = false;
    };
  }, [gameType]);

  if (!Settings) return null;
  return <Settings {...props} />;
}

export function renderGameSettings(gameType: GameType, props: RoomSettingsProps): ReactNode {
  return (
    <Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载设置…</p>}>
      <LazyRoomSettingsPanel gameType={gameType} {...props} />
    </Suspense>
  );
}

export function GameComponentSuspense({
  gameType,
  ...props
}: import('./types').GameComponentProps & { gameType: GameType }) {
  const Component = GAME_REGISTRY[gameType]?.Component;
  if (!Component) return null;
  return (
    <Suspense fallback={<p style={{ color: 'var(--text-muted)' }}>加载游戏中…</p>}>
      <Component {...props} />
    </Suspense>
  );
}
