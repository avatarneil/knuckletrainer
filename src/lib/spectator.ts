"use client";

export interface SpectatorMatchRecord {
  roomId: string;
  gameType: "multiplayer" | "ai";
  player1Name: string;
  player2Name: string;
  followed: boolean;
  lastSeenAt: number;
  successorRoomId?: string | null;
}

const SPECTATOR_TOKEN_KEY = "knuckletrainer_spectator_token";
const MATCH_RECORDS_KEY = "knuckletrainer_spectator_matches";
const MAX_MATCH_RECORDS = 12;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getSpectatorToken(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const stored = window.localStorage.getItem(SPECTATOR_TOKEN_KEY);
  if (stored) {
    return stored;
  }

  const token = `spectator_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(SPECTATOR_TOKEN_KEY, token);
  return token;
}

export function readSpectatorMatchRecords(): SpectatorMatchRecord[] {
  if (!isBrowser()) {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(MATCH_RECORDS_KEY);
    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored) as SpectatorMatchRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeSpectatorMatchRecords(records: SpectatorMatchRecord[]): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    MATCH_RECORDS_KEY,
    JSON.stringify(records.slice(0, MAX_MATCH_RECORDS))
  );
}

export function upsertSpectatorMatchRecord(
  record: Omit<SpectatorMatchRecord, "lastSeenAt"> & { lastSeenAt?: number }
): SpectatorMatchRecord[] {
  const records = readSpectatorMatchRecords();
  const nextRecord: SpectatorMatchRecord = {
    ...record,
    lastSeenAt: record.lastSeenAt ?? Date.now(),
  };

  const nextRecords = [
    nextRecord,
    ...records.filter((existing) => existing.roomId !== record.roomId),
  ].toSorted((a, b) => b.lastSeenAt - a.lastSeenAt);

  writeSpectatorMatchRecords(nextRecords);
  return nextRecords;
}

export function setSpectatorMatchFollowed(
  roomId: string,
  followed: boolean
): SpectatorMatchRecord[] {
  const records = readSpectatorMatchRecords();
  const nextRecords = records.map((record) =>
    record.roomId === roomId ? { ...record, followed, lastSeenAt: Date.now() } : record
  );

  writeSpectatorMatchRecords(nextRecords);
  return nextRecords;
}

export function getRecentRoomIds(records: SpectatorMatchRecord[]): Set<string> {
  return new Set(records.slice(0, 5).map((record) => record.roomId));
}

export function getFollowedRoomIds(records: SpectatorMatchRecord[]): Set<string> {
  const roomIds = new Set<string>();

  for (const record of records) {
    if (!record.followed) {
      continue;
    }

    roomIds.add(record.roomId);
    if (record.successorRoomId) {
      roomIds.add(record.successorRoomId);
    }
  }

  return roomIds;
}
