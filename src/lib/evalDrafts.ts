"use client";

/**
 * Browser-side draft cache for /eval feedback.
 *
 * Each draft is stored in localStorage under a stable key derived from
 * the Material/Signal/Reflection item_id. Drafts persist across page
 * reloads and browser sessions until either:
 *   1. User clicks "Submit drafts" → POST /api/eval/batch → on success,
 *      submitted drafts are removed from cache.
 *   2. User explicitly discards a draft.
 *
 * The cache uses a single localStorage key holding a JSON object mapping
 * item_id → { feedback, item_type, source?, savedAt }. We use one key
 * (not many) so we can scan for "how many drafts are there" without
 * iterating localStorage keys.
 */

import type { EvalLogEntry } from "./types";

const STORAGE_KEY = "signal-catcher-eval-drafts:v1";

export interface DraftEntry {
  item_id: string;
  item_type: EvalLogEntry["item_type"];
  feedback: string;
  source?: string;
  savedAt: string;
}

type DraftMap = Record<string, DraftEntry>;

function readMap(): DraftMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed as DraftMap;
    return {};
  } catch {
    return {};
  }
}

function writeMap(map: DraftMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

const STORAGE_EVENT = "signal-catcher-eval-drafts:change";

function notifyChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT));
}

export function getDraft(item_id: string): DraftEntry | null {
  return readMap()[item_id] ?? null;
}

export function setDraft(entry: Omit<DraftEntry, "savedAt">) {
  const map = readMap();
  if (!entry.feedback.trim()) {
    delete map[entry.item_id];
  } else {
    map[entry.item_id] = { ...entry, savedAt: new Date().toISOString() };
  }
  writeMap(map);
  notifyChange();
}

export function discardDraft(item_id: string) {
  const map = readMap();
  if (map[item_id]) {
    delete map[item_id];
    writeMap(map);
    notifyChange();
  }
}

export function clearDrafts(item_ids: string[]) {
  const map = readMap();
  let changed = false;
  for (const id of item_ids) {
    if (map[id]) {
      delete map[id];
      changed = true;
    }
  }
  if (changed) {
    writeMap(map);
    notifyChange();
  }
}

export function listDrafts(): DraftEntry[] {
  return Object.values(readMap());
}

/** Subscribe to draft cache changes (within this tab). */
export function subscribe(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const wrapped = () => handler();
  window.addEventListener(STORAGE_EVENT, wrapped);
  // Also listen to cross-tab storage event so two open tabs stay in sync.
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) handler();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(STORAGE_EVENT, wrapped);
    window.removeEventListener("storage", storageHandler);
  };
}
