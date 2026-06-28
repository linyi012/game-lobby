import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameType, RoomDetail } from '@game-lobby/shared';
import * as api from '../lib/api';
import {
  getSocket,
  joinRoom,
  leaveRoom,
  onGameState,
  onResync,
  onRoomClosed,
  onRoomKicked,
  onRoomUpdated,
} from '../lib/socket';

export interface UseRoomSessionOptions {
  roomId: string | undefined;
  token: string | null;
  lobbyPath: string;
}

export interface UseRoomSessionResult {
  room: RoomDetail | null;
  error: string;
  setError: (msg: string) => void;
  kicked: boolean;
  kickedMessage: string;
  closed: boolean;
  closedMessage: string;
  gameType: GameType | null;
  gameState: unknown;
  resyncRoom: () => Promise<void>;
  resyncing: boolean;
  socketJoined: boolean;
}

export function useRoomSession({
  roomId,
  token,
  lobbyPath,
}: UseRoomSessionOptions): UseRoomSessionResult {
  const navigate = useNavigate();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [closed, setClosed] = useState(false);
  const [closedMessage, setClosedMessage] = useState('房间已关闭，正在返回大厅…');
  const [kicked, setKicked] = useState(false);
  const [kickedMessage, setKickedMessage] = useState('你已在其他位置加入了新房间，正在返回大厅…');
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [gameState, setGameState] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [resyncing, setResyncing] = useState(false);
  const [socketJoined, setSocketJoined] = useState(false);

  const resyncRoom = useCallback(async () => {
    if (!token || !roomId) return;
    setResyncing(true);
    try {
      getSocket(token);
      const res = await joinRoom(roomId);
      if (res.ok && res.room) {
        setRoom(res.room);
        setSocketJoined(true);
        setError('');
      } else {
        setSocketJoined(false);
        if (res.message) {
          setError(res.message);
        }
      }
    } catch (err) {
      setSocketJoined(false);
      setError(err instanceof Error ? err.message : '同步房间失败');
      try {
        const detail = await api.fetchRoom(token, roomId);
        setRoom((prev) => prev ?? detail);
      } catch {
        // ignore REST fallback failure
      }
    } finally {
      setResyncing(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    if (!token || !roomId) return;
    setSocketJoined(false);
    getSocket(token);

    let mounted = true;
    void resyncRoom();

    const unsubRoom = onRoomUpdated((r) => {
      if (r.id === roomId) setRoom(r);
    });
    const unsubGame = onGameState((payload) => {
      setGameType(payload.gameType as GameType);
      setGameState(payload.state);
    });
    const unsubClosed = onRoomClosed((payload) => {
      if (payload.roomId === roomId) {
        if (payload.message) setClosedMessage(`${payload.message}，正在返回大厅…`);
        setClosed(true);
        navigate(lobbyPath, { replace: true });
      }
    });
    const unsubKicked = onRoomKicked((payload) => {
      if (payload.roomId === roomId) {
        const message =
          payload.reason === 'removed_by_host'
            ? '你已被房主移出房间，正在返回大厅…'
            : '你已在其他位置加入了新房间，正在返回大厅…';
        setKickedMessage(message);
        setKicked(true);
        navigate(lobbyPath, { replace: true, state: { notice: message } });
      }
    });
    const unsubResync = onResync(() => {
      if (mounted) void resyncRoom();
    });

    return () => {
      mounted = false;
      leaveRoom();
      unsubRoom();
      unsubGame();
      unsubClosed();
      unsubKicked();
      unsubResync();
    };
  }, [token, roomId, lobbyPath, navigate, resyncRoom]);

  useEffect(() => {
    if (!token || !roomId) return;
    api
      .fetchRoom(token, roomId)
      .then((detail) => setRoom((prev) => prev ?? detail))
      .catch(() => {});
  }, [token, roomId]);

  return {
    room,
    error,
    setError,
    kicked,
    kickedMessage,
    closed,
    closedMessage,
    gameType,
    gameState,
    resyncRoom,
    resyncing,
    socketJoined,
  };
}
