/**
 * Asset Manager — Metadata Store
 *
 * IndexedDB-backed metadata store for file tags, recent files, and
 * context-aware folder memory. Syncs to a hidden Foundry world setting
 * for cross-browser persistence and automatic world backup.
 *
 * Architecture:
 *   IndexedDB  = fast runtime cache (files store + settings store)
 *   World Setting = durable backup (JSON snapshot, debounced 2s write-back)
 *   On cold start: load from world setting into IndexedDB if empty
 */

import { Log, MOD } from "../logger";
import { getGame } from "../types";

/* ── Types ────────────────────────────────────────────────── */

export interface FileTagData {
  path: string;
  tags: string[];
  lastUsed?: number;
}

export interface MetadataSnapshot {
  version: 1;
  timestamp: number;
  files: Record<string, { tags: string[]; lastUsed?: number }>;
  folderMemory: Record<string, string>;
  tagColors: Record<string, string>;
}

/* ── Constants ────────────────────────────────────────────── */

const DB_NAME = "fth-asset-meta";
const DB_VERSION = 1;
const STORE_FILES = "files";
const STORE_SETTINGS = "settings";
const SYNC_DEBOUNCE_MS = 2000;
const MAX_RECENT = 50;

/** Hidden setting key for metadata backup. */
export const AM_META_SETTING = "amMetadataBackup";

/* ── Default tag palette ─────────────────────────────────── */

const DEFAULT_TAG_COLORS: Record<string, string> = {
  npcs: "#42a5f5",
  bosses: "#ef5350",
  maps: "#66bb6a",
  tokens: "#ffa000",
  portraits: "#ab47bc",
  effects: "#26c6da",
  music: "#7e57c2",
  ambience: "#78909c",
};

/* ── MetadataStore Class ─────────────────────────────────── */

export class MetadataStore {
  #db: IDBDatabase | null = null;
  #ready: Promise<void>;
  #syncTimer: ReturnType<typeof setTimeout> | null = null;
  #tagColors: Map<string, string> = new Map(Object.entries(DEFAULT_TAG_COLORS));
  #folderMemory: Map<string, string> = new Map();
  #recentFiles: Map<string, number> = new Map();
  #fileTags: Map<string, string[]> = new Map();

  constructor() {
    this.#ready = this.#openDB();
  }

  /* ── Lifecycle ───────────────────────────────────────────── */

  async ready(): Promise<void> {
    return this.#ready;
  }

  destroy(): void {
    if (this.#syncTimer) {
      clearTimeout(this.#syncTimer);
      this.#syncTimer = null;
    }
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
  }

  /* ── Tags ────────────────────────────────────────────────── */

  async getTags(path: string): Promise<string[]> {
    await this.#ready;
    return this.#fileTags.get(path) ?? [];
  }

  async setTags(path: string, tags: string[]): Promise<void> {
    await this.#ready;
    if (tags.length === 0) {
      this.#fileTags.delete(path);
    } else {
      this.#fileTags.set(path, tags);
    }
    await this.#putFile(path, { tags, lastUsed: this.#recentFiles.get(path) });
    this.#scheduleSyncToSettings();
  }

  async addTag(path: string, tag: string): Promise<void> {
    const tags = await this.getTags(path);
    if (!tags.includes(tag)) {
      tags.push(tag);
      await this.setTags(path, tags);
    }
  }

  async removeTag(path: string, tag: string): Promise<void> {
    const tags = await this.getTags(path);
    const idx = tags.indexOf(tag);
    if (idx >= 0) {
      tags.splice(idx, 1);
      await this.setTags(path, tags);
    }
  }

  /** Get all unique tags across all files. */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    for (const tags of this.#fileTags.values()) {
      for (const t of tags) tagSet.add(t);
    }
    return [...tagSet].sort();
  }

  /** Get file paths matching a tag. */
  getFilesByTag(tag: string): string[] {
    const result: string[] = [];
    for (const [path, tags] of this.#fileTags) {
      if (tags.includes(tag)) result.push(path);
    }
    return result;
  }

  /** Get tag color (default gray for unknown tags). */
  getTagColor(tag: string): string {
    return this.#tagColors.get(tag) ?? "#9a9590";
  }

  async setTagColor(tag: string, color: string): Promise<void> {
    await this.#ready;
    this.#tagColors.set(tag, color);
    await this.#putSetting("tagColors", Object.fromEntries(this.#tagColors));
    this.#scheduleSyncToSettings();
  }

  /* ── Recent Files ────────────────────────────────────────── */

  async recordRecent(path: string): Promise<void> {
    await this.#ready;
    const now = Date.now();
    this.#recentFiles.set(path, now);

    // Trim to MAX_RECENT
    if (this.#recentFiles.size > MAX_RECENT) {
      const sorted = [...this.#recentFiles.entries()].sort((a, b) => b[1] - a[1]);
      this.#recentFiles = new Map(sorted.slice(0, MAX_RECENT));
    }

    const tags = this.#fileTags.get(path) ?? [];
    await this.#putFile(path, { tags, lastUsed: now });
    this.#scheduleSyncToSettings();
  }

  /** Get recently used file paths, newest first. */
  getRecentFiles(limit = 20): string[] {
    return [...this.#recentFiles.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path]) => path);
  }

  /* ── Folder Memory ───────────────────────────────────────── */

  getFolderMemory(pickerType: string): string | undefined {
    return this.#folderMemory.get(pickerType);
  }

  async setFolderMemory(pickerType: string, path: string): Promise<void> {
    await this.#ready;
    this.#folderMemory.set(pickerType, path);
    await this.#putSetting("folderMemory", Object.fromEntries(this.#folderMemory));
    this.#scheduleSyncToSettings();
  }

  /* ── Export / Import ─────────────────────────────────────── */

  async exportSnapshot(): Promise<MetadataSnapshot> {
    await this.#ready;
    const files: Record<string, { tags: string[]; lastUsed?: number }> = {};
    for (const [path, tags] of this.#fileTags) {
      files[path] = { tags, lastUsed: this.#recentFiles.get(path) };
    }
    for (const [path, ts] of this.#recentFiles) {
      if (!files[path]) files[path] = { tags: [], lastUsed: ts };
    }
    return {
      version: 1,
      timestamp: Date.now(),
      files,
      folderMemory: Object.fromEntries(this.#folderMemory),
      tagColors: Object.fromEntries(this.#tagColors),
    };
  }

  /** Additive merge: union tags, keep newest timestamps. */
  async importSnapshot(snapshot: MetadataSnapshot): Promise<{ added: number; updated: number }> {
    await this.#ready;
    let added = 0;
    let updated = 0;

    for (const [path, data] of Object.entries(snapshot.files)) {
      const existing = this.#fileTags.get(path);
      if (!existing) { added++; } else { updated++; }

      const mergedTags = [...new Set([...(existing ?? []), ...data.tags])];
      this.#fileTags.set(path, mergedTags.length ? mergedTags : []);

      if (data.lastUsed) {
        const existingTs = this.#recentFiles.get(path) ?? 0;
        if (data.lastUsed > existingTs) this.#recentFiles.set(path, data.lastUsed);
      }

      await this.#putFile(path, {
        tags: mergedTags,
        lastUsed: this.#recentFiles.get(path),
      });
    }

    for (const [key, val] of Object.entries(snapshot.folderMemory)) {
      this.#folderMemory.set(key, val);
    }
    await this.#putSetting("folderMemory", Object.fromEntries(this.#folderMemory));

    for (const [tag, color] of Object.entries(snapshot.tagColors ?? {})) {
      if (!this.#tagColors.has(tag)) this.#tagColors.set(tag, color);
    }
    await this.#putSetting("tagColors", Object.fromEntries(this.#tagColors));

    this.#scheduleSyncToSettings();
    return { added, updated };
  }

  /** Cold-start: load from Foundry world setting if IndexedDB is empty. */
  async loadFromSettings(): Promise<void> {
    try {
      const game = getGame();
      const raw = game?.settings?.get?.(MOD, AM_META_SETTING) as string | undefined;
      if (!raw) return;

      const snapshot = JSON.parse(raw) as MetadataSnapshot;
      if (snapshot.version !== 1) return;

      if (this.#fileTags.size === 0 && this.#recentFiles.size === 0) {
        await this.importSnapshot(snapshot);
        Log.debug("Asset Manager: loaded metadata from world setting");
      }
    } catch (err) {
      Log.debug("Asset Manager: failed to load metadata from settings", err);
    }
  }

  /* ── Internal: IndexedDB ─────────────────────────────────── */

  async #openDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES, { keyPath: "path" });
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };

      request.onsuccess = () => {
        this.#db = request.result;
        this.#loadAll().then(resolve).catch(reject);
      };

      request.onerror = () => {
        Log.warn("MetadataStore: failed to open IndexedDB", request.error);
        resolve();
      };
    });
  }

  async #loadAll(): Promise<void> {
    if (!this.#db) return;

    const files = await this.#getAllFromStore<FileTagData & { lastUsed?: number }>(STORE_FILES);
    for (const file of files) {
      if (file.tags?.length) this.#fileTags.set(file.path, file.tags);
      if (file.lastUsed) this.#recentFiles.set(file.path, file.lastUsed);
    }

    const folderMemory = await this.#getSetting("folderMemory") as Record<string, string> | undefined;
    if (folderMemory) this.#folderMemory = new Map(Object.entries(folderMemory));

    const tagColors = await this.#getSetting("tagColors") as Record<string, string> | undefined;
    if (tagColors) {
      this.#tagColors = new Map([...Object.entries(DEFAULT_TAG_COLORS), ...Object.entries(tagColors)]);
    }
  }

  #getAllFromStore<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.#db) { resolve([]); return; }
      const tx = this.#db.transaction(storeName, "readonly");
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  #putFile(path: string, data: { tags: string[]; lastUsed?: number }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#db) { resolve(); return; }
      const tx = this.#db.transaction(STORE_FILES, "readwrite");
      const store = tx.objectStore(STORE_FILES);
      store.put({ path, ...data });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  #getSetting(key: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.#db) { resolve(undefined); return; }
      const tx = this.#db.transaction(STORE_SETTINGS, "readonly");
      const store = tx.objectStore(STORE_SETTINGS);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  #putSetting(key: string, value: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.#db) { resolve(); return; }
      const tx = this.#db.transaction(STORE_SETTINGS, "readwrite");
      const store = tx.objectStore(STORE_SETTINGS);
      store.put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  #scheduleSyncToSettings(): void {
    if (this.#syncTimer) clearTimeout(this.#syncTimer);
    this.#syncTimer = setTimeout(() => { this.#syncToSettings(); }, SYNC_DEBOUNCE_MS);
  }

  async #syncToSettings(): Promise<void> {
    try {
      const game = getGame();
      if (!game?.settings) return;
      const snapshot = await this.exportSnapshot();
      await game.settings.set(MOD, AM_META_SETTING, JSON.stringify(snapshot));
      Log.debug("Asset Manager: synced metadata to world setting");
    } catch (err) {
      Log.debug("Asset Manager: failed to sync metadata to settings", err);
    }
  }
}

/* ── Singleton ────────────────────────────────────────────── */

let _instance: MetadataStore | null = null;

export function getMetadataStore(): MetadataStore {
  if (!_instance) _instance = new MetadataStore();
  return _instance;
}

export function destroyMetadataStore(): void {
  if (_instance) {
    _instance.destroy();
    _instance = null;
  }
}
