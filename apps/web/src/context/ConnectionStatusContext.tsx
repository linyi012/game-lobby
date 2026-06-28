import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getConnectionStatus,
  subscribeConnectionStatus,
  type ConnectionStatus,
} from '../lib/socket-lifecycle';

const ConnectionStatusContext = createContext<ConnectionStatus>('idle');

export function ConnectionStatusProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>(getConnectionStatus);

  useEffect(() => subscribeConnectionStatus(setStatus), []);

  const showBanner = status === 'disconnected' || status === 'reconnecting';

  return (
    <ConnectionStatusContext.Provider value={status}>
      {showBanner && (
        <div className="connection-banner" role="status">
          {status === 'reconnecting'
            ? '连接已断开，正在重连…'
            : '网络已断开，请检查连接'}
        </div>
      )}
      {children}
    </ConnectionStatusContext.Provider>
  );
}

export function useConnectionStatus(): ConnectionStatus {
  return useContext(ConnectionStatusContext);
}
