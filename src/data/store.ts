// A tiny in-browser "database". The whole DB is a single JSON object persisted
// to localStorage. Swap this file (and actions.ts) for API calls when a real
// backend exists; components only use useDB() and the action functions.

import { useSyncExternalStore } from 'react';
import { createSeed, DB_VERSION } from './seed';
import type { DB } from './types';

const KEY = 'phs-club-hub/db';

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === DB_VERSION) return parsed;
    }
  } catch {
    // storage unavailable or corrupt: fall through to fresh seed
  }
  return structuredClone(createSeed());
}

let db: DB = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    // ignore (private mode / quota); the app still works for this session
  }
}

export function getDB(): DB {
  return db;
}

/** Apply a change to a copy of the DB, then publish it. */
export function mutate(fn: (draft: DB) => void): void {
  const draft = structuredClone(db);
  fn(draft);
  db = draft;
  persist();
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: replace the whole DB. */
export function replaceDB(next: DB): void {
  db = next;
  listeners.forEach((l) => l());
}

export function resetDemoData(): void {
  const fresh = structuredClone(createSeed());
  fresh.sessionUserId = db.sessionUserId;
  db = fresh;
  persist();
  listeners.forEach((l) => l());
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getDB);
}

// Keep tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      db = load();
      listeners.forEach((l) => l());
    }
  });
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
