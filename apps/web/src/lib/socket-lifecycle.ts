import type { Socket } from 'socket.io-client';

export type ConnectionStatus = 'idle' | 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

type StatusListener = (status: ConnectionStatus) => void;
type ResyncListener = () => void;

let connectionStatus: ConnectionStatus = 'idle';
const statusListeners = new Set<StatusListener>();
const resyncListeners = new Set<ResyncListener>();
let lifecycleBound = false;
let visibilityBound = false;

function setConnectionStatus(status: ConnectionStatus) {
  if (connectionStatus === status) return;
  connectionStatus = status;
  for (const listener of statusListeners) listener(status);
}

export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

export function subscribeConnectionStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(connectionStatus);
  return () => statusListeners.delete(listener);
}

export function onResync(listener: ResyncListener): () => void {
  resyncListeners.add(listener);
  return () => resyncListeners.delete(listener);
}

function notifyResync() {
  for (const listener of resyncListeners) listener();
}

export function bindSocketLifecycle(socket: Socket) {
  if (lifecycleBound) return;
  lifecycleBound = true;

  setConnectionStatus(socket.connected ? 'connected' : 'connecting');

  socket.on('connect', () => {
    setConnectionStatus('connected');
  });

  socket.io.on('reconnect_attempt', () => {
    setConnectionStatus('reconnecting');
  });

  socket.io.on('reconnect', () => {
    setConnectionStatus('connected');
    notifyResync();
  });

  socket.on('disconnect', () => {
    setConnectionStatus('disconnected');
  });

  socket.on('connect_error', () => {
    if (!socket.connected) {
      setConnectionStatus(socket.active ? 'reconnecting' : 'disconnected');
    }
  });

  if (!visibilityBound && typeof document !== 'undefined') {
    visibilityBound = true;

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && !socket.connected) {
        socket.connect();
      }
    });

    window.addEventListener('online', () => {
      if (!socket.connected) socket.connect();
    });
  }
}

export function resetSocketLifecycle() {
  lifecycleBound = false;
  setConnectionStatus('idle');
}
