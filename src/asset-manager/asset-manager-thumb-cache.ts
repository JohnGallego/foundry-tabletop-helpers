/**
 * Asset Manager — Thumbnail Cache
 *
 * Generates display-resolution WebP thumbnails via an inline Web Worker
 * (OffscreenCanvas) and caches them in IndexedDB. On subsequent loads,
 * thumbnails are served from cache — never loading a 4000px map image
 * as a 120px grid thumbnail again.
 *
 * Uses an inline blob worker to avoid separate file deployment and
 * Vite lib-mode worker bundling issues.
 */

import { Log } from "../logger";

/* ── Constants ────────────────────────────────────────────── */

const DB_NAME = "fth-thumb-cache";
const DB_VERSION = 1;
const STORE_NAME = "thumbnails";

/** Max concurrent worker tasks. */
const MAX_CONCURRENT = 4;

/** Max object URLs held in memory. Oldest are evicted when exceeded. */
const MAX_OBJECT_URLS = 500;

/** Thumbnail WebP quality (0-1). */
const THUMB_QUALITY = 0.40;

/* ── Inline Worker Source ─────────────────────────────────── */

/**
 * Worker code as a string. Runs in a separate thread.
 * Receives: { id, url, size }
 * Returns:  { id, blob } or { id, error }
 */
const WORKER_SOURCE = /* js */ `
"use strict";
self.onmessage = async (e) => {
  const { id, url, size, quality } = e.data;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "same-origin" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const srcBlob = await res.blob();
    const bitmap = await createImageBitmap(srcBlob);

    // Calculate aspect-fit dimensions
    const scale = Math.min(size / bitmap.width, size / bitmap.height, 1);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);

    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const thumbBlob = await canvas.convertToBlob({
      type: "image/webp",
      quality: quality || 0.75,
    });

    self.postMessage({ id, blob: thumbBlob });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
`;

/* ── Types ────────────────────────────────────────────────── */

interface ThumbRecord {
  /** Cache key: `path::size` */
  key: string;
  /** Original file path. */
  path: string;
  /** Thumbnail size (px). */
  size: number;
  /** Generated WebP blob. */
  blob: Blob;
  /** Timestamp of generation. */
  created: number;
}

interface PendingTask {
  resolve: (url: string) => void;
  reject: (err: Error) => void;
}

/* ── ThumbCache Class ─────────────────────────────────────── */

class ThumbCache {
  #db: IDBDatabase | null = null;
  #worker: Worker | null = null;
  #taskId = 0;
  #pending = new Map<number, PendingTask>();
  #activeCount = 0;
  #queue: Array<{ id: number; url: string; size: number }> = [];
  /** Object URLs we've created — must be revoked to free memory. */
  #objectUrls = new Map<string, string>();
  #ready: Promise<void>;

  constructor() {
    this.#ready = this.#init();
  }

  /* ── Public API ───────────────────────────────────────── */

  /**
   * Get a thumbnail URL for the given asset path and size.
   * Returns an object URL (from cache or freshly generated).
   * Returns `null` if generation fails or the file isn't an image.
   */
  async getThumbUrl(path: string, size: number): Promise<string | null> {
    await this.#ready;
    const key = `${path}::${size}`;

    // Check if we already have an active object URL (move to end for LRU)
    const existing = this.#objectUrls.get(key);
    if (existing) {
      this.#objectUrls.delete(key);
      this.#objectUrls.set(key, existing);
      return existing;
    }

    // Check IndexedDB cache
    const cached = await this.#getFromDb(key);
    if (cached) {
      const url = URL.createObjectURL(cached.blob);
      this.#objectUrls.set(key, url);
      this.#evictOldUrls();
      return url;
    }

    // Generate via worker
    try {
      const url = await this.#generateThumb(path, size);
      return url;
    } catch {
      return null;
    }
  }

  /**
   * Revoke all active object URLs (call when picker closes or
   * scroller recycles items significantly).
   */
  revokeAll(): void {
    for (const url of this.#objectUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.#objectUrls.clear();
  }

  /**
   * Revoke a specific object URL by cache key.
   */
  revoke(path: string, size: number): void {
    const key = `${path}::${size}`;
    const url = this.#objectUrls.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      this.#objectUrls.delete(key);
    }
  }

  /**
   * Clear the entire thumbnail cache (IndexedDB + object URLs).
   */
  async clearCache(): Promise<void> {
    await this.#ready;
    this.revokeAll();
    if (!this.#db) return;
    return new Promise((resolve, reject) => {
      const tx = this.#db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Destroy the cache — close DB, terminate worker, revoke URLs. */
  destroy(): void {
    this.revokeAll();
    if (this.#worker) {
      this.#worker.terminate();
      this.#worker = null;
    }
    if (this.#db) {
      this.#db.close();
      this.#db = null;
    }
    // Reject any pending tasks
    for (const task of this.#pending.values()) {
      task.reject(new Error("ThumbCache destroyed"));
    }
    this.#pending.clear();
    this.#queue.length = 0;
  }

  /** Evict oldest object URLs when over the cap. */
  #evictOldUrls(): void {
    while (this.#objectUrls.size > MAX_OBJECT_URLS) {
      // Map iterator gives insertion order — first entry is oldest
      const oldest = this.#objectUrls.keys().next().value;
      if (oldest === undefined) break;
      const url = this.#objectUrls.get(oldest);
      if (url) URL.revokeObjectURL(url);
      this.#objectUrls.delete(oldest);
    }
  }

  /* ── Initialization ───────────────────────────────────── */

  async #init(): Promise<void> {
    try {
      await this.#openDb();
      this.#createWorker();
    } catch (err) {
      Log.warn("ThumbCache: init failed, thumbnails will load at full resolution", err);
    }
  }

  #openDb(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "key" });
          store.createIndex("by-path", "path");
          store.createIndex("by-created", "created");
        }
      };
      req.onsuccess = () => {
        this.#db = req.result;
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  #createWorker(): void {
    try {
      const blob = new Blob([WORKER_SOURCE], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      this.#worker = new Worker(url);
      URL.revokeObjectURL(url); // Worker keeps the reference

      this.#worker.onmessage = (e: MessageEvent) => {
        const { id, blob: thumbBlob, error } = e.data;
        const task = this.#pending.get(id);
        if (!task) return;
        this.#pending.delete(id);
        this.#activeCount--;

        if (error) {
          task.reject(new Error(error));
        } else if (thumbBlob) {
          // Find the original path+size from the queue context
          // We stored it when dispatching
          task.resolve(thumbBlob);
        }

        // Process next in queue
        this.#drainQueue();
      };

      this.#worker.onerror = (err) => {
        Log.warn("ThumbCache: worker error", err);
      };
    } catch (err) {
      Log.warn("ThumbCache: failed to create worker", err);
    }
  }

  /* ── IndexedDB Operations ─────────────────────────────── */

  #getFromDb(key: string): Promise<ThumbRecord | undefined> {
    if (!this.#db) return Promise.resolve(undefined);
    return new Promise((resolve, reject) => {
      const tx = this.#db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as ThumbRecord | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  #putToDb(record: ThumbRecord): Promise<void> {
    if (!this.#db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = this.#db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /* ── Worker Task Management ───────────────────────────── */

  #generateThumb(path: string, size: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.#worker) {
        reject(new Error("No worker available"));
        return;
      }

      const id = ++this.#taskId;
      const key = `${path}::${size}`;

      // Wrap resolve to handle blob → object URL + caching
      const task: PendingTask = {
        resolve: async (thumbBlob: string) => {
          // thumbBlob is actually a Blob from the worker
          const blob = thumbBlob as unknown as Blob;
          const url = URL.createObjectURL(blob);
          this.#objectUrls.set(key, url);
          this.#evictOldUrls();

          // Cache in IndexedDB (fire and forget)
          this.#putToDb({ key, path, size, blob, created: Date.now() }).catch(() => {
            /* ignore cache write failures */
          });

          resolve(url);
        },
        reject,
      };

      this.#pending.set(id, task);

      // Queue or dispatch immediately
      if (this.#activeCount < MAX_CONCURRENT) {
        this.#dispatch(id, path, size);
      } else {
        this.#queue.push({ id, url: path, size });
      }
    });
  }

  #dispatch(id: number, url: string, size: number): void {
    this.#activeCount++;
    this.#worker?.postMessage({ id, url, size, quality: THUMB_QUALITY });
  }

  #drainQueue(): void {
    while (this.#activeCount < MAX_CONCURRENT && this.#queue.length > 0) {
      const next = this.#queue.shift()!;
      this.#dispatch(next.id, next.url, next.size);
    }
  }
}

/* ── Singleton ────────────────────────────────────────────── */

let instance: ThumbCache | null = null;

/** Get or create the singleton ThumbCache. */
export function getThumbCache(): ThumbCache {
  if (!instance) {
    instance = new ThumbCache();
  }
  return instance;
}

/** Destroy the singleton (call on module teardown). */
export function destroyThumbCache(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}
