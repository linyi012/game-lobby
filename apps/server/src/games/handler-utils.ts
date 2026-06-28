import type { Socket } from 'socket.io';
import type { GameSocketDeps } from './undercover/socket.js';

export type GameAck = { ok: boolean; message?: string };

export function wrapSocketForGameHandlers(socket: Socket, deps: GameSocketDeps): Socket {
  const originalOn = socket.on.bind(socket);

  const patchedOn = function patchedOn(
    this: Socket,
    event: string,
    listener: (...args: unknown[]) => void | Promise<void>,
  ) {
    if (!event.startsWith('game:')) {
      return originalOn(event, listener);
    }

    return originalOn(event, async (...args: unknown[]) => {
      const maybeCb = args[args.length - 1];
      const hasCb = typeof maybeCb === 'function';
      let acked = false;

      const ack = (res: GameAck) => {
        if (!acked && hasCb) {
          acked = true;
          (maybeCb as (response: GameAck) => void)(res);
        }
      };

      if (hasCb) {
        args[args.length - 1] = ack;
      }

      try {
        const roomId = deps.getRoomId(socket);
        if (!roomId) {
          ack({ ok: false, message: '未在房间中' });
          return;
        }

        await deps.roomManager.withGameLock(roomId, async () => {
          await listener(...args);
        });

        if (hasCb && !acked) {
          ack({ ok: false, message: '操作未完成' });
        }
      } catch {
        ack({ ok: false, message: '操作失败' });
      }
    });
  };

  return Object.assign(socket, { on: patchedOn });
}
