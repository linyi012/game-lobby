import { getActiveSocket } from './socket';

const DEFAULT_TIMEOUT_MS = 8000;

export function emitWithAck<T>(
  event: string,
  payload: unknown = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const socket = getActiveSocket();
  if (!socket?.connected) {
    return Promise.reject(new Error('未连接服务器'));
  }

  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('请求超时'));
    }, timeoutMs);

    socket.emit(event, payload, (response: T) => {
      window.clearTimeout(timer);
      resolve(response);
    });
  });
}
