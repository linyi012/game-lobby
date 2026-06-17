import type { AuthResponse, GameType, RoomDetail, RoomSummary } from '@game-lobby/shared';

const API_URL = import.meta.env.VITE_API_URL ?? '';

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message ?? '请求失败');
  return data as T;
}

export function register(username: string, password: string, displayName?: string) {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, displayName }),
  });
}

export function login(username: string, password: string) {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchRandomGuestName() {
  return request<{ displayName: string }>('/api/auth/guest/random-name');
}

export function guestLogin(displayName?: string) {
  return request<AuthResponse>('/api/auth/guest', {
    method: 'POST',
    body: JSON.stringify({ displayName: displayName || undefined }),
  });
}

export function updateProfile(token: string, displayName: string) {
  return request<AuthResponse>('/api/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
  }, token);
}

export function fetchRooms(token: string, gameType?: GameType) {
  const query = gameType ? `?gameType=${gameType}` : '';
  return request<RoomSummary[]>(`/api/rooms${query}`, {}, token);
}

export function createRoom(token: string, name: string, gameType: GameType, maxPlayers?: number) {
  return request<RoomDetail>('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ name, gameType, maxPlayers }),
  }, token);
}

export function fetchRoom(token: string, roomId: string) {
  return request<RoomDetail>(`/api/rooms/${roomId}`, {}, token);
}

export interface WordPackCategory {
  id: string;
  name: string;
  wordCount: number;
}

export interface UserWordPack {
  id: string;
  name: string;
  words: string[];
  createdAt: string;
  updatedAt: string;
}

export interface WordPackSyncStatus {
  version: string | null;
  lastSyncedAt: string | null;
  success: boolean | null;
  addedCount: number;
  removedCount: number;
  error: string | null;
}

export function fetchWordPackCategories(token: string) {
  return request<WordPackCategory[]>('/api/word-packs/categories', {}, token);
}

export function fetchMyWordPacks(token: string) {
  return request<UserWordPack[]>('/api/word-packs/mine', {}, token);
}

export function createWordPack(token: string, name: string, words: string[]) {
  return request<UserWordPack>(
    '/api/word-packs',
    { method: 'POST', body: JSON.stringify({ name, words }) },
    token,
  );
}

export function updateWordPack(token: string, id: string, name: string, words: string[]) {
  return request<UserWordPack>(
    `/api/word-packs/${id}`,
    { method: 'PATCH', body: JSON.stringify({ name, words }) },
    token,
  );
}

export function deleteWordPack(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/word-packs/${id}`, { method: 'DELETE' }, token);
}

export function fetchWordPackSyncStatus(token: string) {
  return request<WordPackSyncStatus>('/api/word-packs/sync-status', {}, token);
}

export function triggerWordPackSync(token: string) {
  return request<WordPackSyncStatus>('/api/word-packs/sync', { method: 'POST' }, token);
}

export interface PairPackCategory {
  id: string;
  name: string;
  pairCount: number;
}

export interface UserPairPack {
  id: string;
  name: string;
  pairs: [string, string][];
  createdAt: string;
  updatedAt: string;
}

export interface PairPackSyncStatus {
  version: string | null;
  lastSyncedAt: string | null;
  success: boolean | null;
  addedCount: number;
  removedCount: number;
  error: string | null;
}

export function fetchPairPackCategories(token: string) {
  return request<PairPackCategory[]>('/api/word-pairs/categories', {}, token);
}

export function fetchMyPairPacks(token: string) {
  return request<UserPairPack[]>('/api/word-pairs/mine', {}, token);
}

export function createPairPack(token: string, name: string, pairs: [string, string][]) {
  return request<UserPairPack>(
    '/api/word-pairs',
    { method: 'POST', body: JSON.stringify({ name, pairs }) },
    token,
  );
}

export function updatePairPack(token: string, id: string, name: string, pairs: [string, string][]) {
  return request<UserPairPack>(
    `/api/word-pairs/${id}`,
    { method: 'PATCH', body: JSON.stringify({ name, pairs }) },
    token,
  );
}

export function deletePairPack(token: string, id: string) {
  return request<{ ok: boolean }>(`/api/word-pairs/${id}`, { method: 'DELETE' }, token);
}

export function fetchPairPackSyncStatus(token: string) {
  return request<PairPackSyncStatus>('/api/word-pairs/sync-status', {}, token);
}

export function triggerPairPackSync(token: string) {
  return request<PairPackSyncStatus>('/api/word-pairs/sync', { method: 'POST' }, token);
}

export function parsePairLines(text: string): [string, string][] {
  const pairs: [string, string][] = [];
  for (const line of text.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      pairs.push([parts[0]!, parts[1]!]);
    }
  }
  return pairs;
}
