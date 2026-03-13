/**
 * Minimal Foundry VTT v13 type shims.
 * 
 * This file provides basic type definitions for Foundry VTT globals
 * to reduce reliance on `any` casts throughout the codebase.
 * 
 * These types are intentionally minimal and defensive - they only define
 * the subset of APIs actually used by this module.
 * 
 * @see https://foundryvtt.com/api/
 */

/* ── Core Game Object ─────────────────────────────────────── */

/** Minimal Game interface for the global `game` object */
export interface FoundryGame {
  /** Foundry VTT version string (e.g., "13.0.0") */
  version?: string;
  /** Currently active game system */
  system?: FoundrySystem;
  /** Currently logged-in user */
  user?: FoundryUser;
  /** Collection of all users */
  users?: FoundryCollection<FoundryUser>;
  /** Collection of all actors in the world */
  actors?: FoundryCollection<FoundryDocument>;
  /** Collection of all compendium packs */
  packs?: FoundryCollection<FoundryCompendiumCollection>;
  /** Settings manager */
  settings?: FoundrySettings;
  /** Current user ID (shortcut for user.id) */
  userId?: string;
  /** Socket.io socket for module communication */
  socket?: FoundrySocket;
  /** Collection of installed modules */
  modules?: Map<string, FoundryModule>;
}

/** Minimal System interface */
export interface FoundrySystem {
  id: string;
  version?: string;
}

/** Minimal User interface */
export interface FoundryUser {
  id: string;
  name: string;
  isGM: boolean;
  active: boolean;
  /** The user's assigned character (if any) */
  character?: FoundryDocument;
}

/** Minimal Module interface */
export interface FoundryModule {
  id: string;
  version?: string;
  active: boolean;
}

/* ── Collections ──────────────────────────────────────────── */

/** Generic Foundry collection (array-like with extra methods) */
export interface FoundryCollection<T> {
  get(id: string): T | undefined;
  find(predicate: (item: T) => boolean): T | undefined;
  filter(predicate: (item: T) => boolean): T[];
  forEach(callback: (item: T) => void): void;
  map<U>(callback: (item: T) => U): U[];
  [Symbol.iterator](): Iterator<T>;
}

/* ── Settings ─────────────────────────────────────────────── */

/** Settings manager interface */
export interface FoundrySettings {
  register(module: string, key: string, data: SettingRegistration): void;
  registerMenu(module: string, key: string, data: SettingMenuRegistration): void;
  get(module: string, key: string): unknown;
  set(module: string, key: string, value: unknown): Promise<unknown>;
}

/** Setting registration data */
export interface SettingRegistration {
  name?: string;
  hint?: string;
  scope?: "client" | "world";
  config?: boolean;
  type?: typeof String | typeof Number | typeof Boolean | typeof Object | typeof Array;
  choices?: Record<string, string>;
  default?: unknown;
  onChange?: (value: unknown) => void;
  restricted?: boolean;
}

/** Setting menu registration data */
export interface SettingMenuRegistration {
  name?: string;
  label?: string;
  hint?: string;
  icon?: string;
  type: new () => unknown;
  restricted?: boolean;
}

/* ── Compendium ───────────────────────────────────────────── */

/** Compendium collection interface */
export interface FoundryCompendiumCollection {
  collection: string;
  metadata?: {
    id?: string;
    name?: string;
    label?: string;
    package?: string;
    packageName?: string;
    type?: string;
  };
  documentName?: string;
  documentClass?: FoundryDocumentClass;
  /** Number of entries in the pack */
  size?: number;
  getDocuments(): Promise<FoundryDocument[]>;
  /** Get the pack index, optionally with extra system fields. */
  getIndex(options?: { fields?: string[] }): Promise<Array<FoundryIndexEntry>>;
}

/** A single entry from a compendium pack index. */
export interface FoundryIndexEntry {
  _id: string;
  name?: string;
  img?: string;
  type?: string;
  uuid?: string;
  [key: string]: unknown;
}

/* ── Documents ────────────────────────────────────────────── */

/** Base document class interface */
export interface FoundryDocumentClass {
  create(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<FoundryDocument>;
}

/** Base document interface */
export interface FoundryDocument {
  id: string;
  name?: string;
  uuid?: string;
  img?: string;
  type?: string;
  system?: Record<string, unknown>;
  ownership?: Record<string, number>;
  sheet?: { render(opts?: { force?: boolean }): void };
  update(data: Record<string, unknown>, options?: Record<string, unknown>): Promise<FoundryDocument>;
  createEmbeddedDocuments(type: string, data: Record<string, unknown>[], options?: Record<string, unknown>): Promise<FoundryDocument[]>;
  toObject(): Record<string, unknown>;
  [key: string]: unknown;
}

/* ── Socket ───────────────────────────────────────────────── */

/** Socket.io interface for module communication */
export interface FoundrySocket {
  on(event: string, callback: (data: unknown) => void): void;
  emit(event: string, data: unknown): void;
}

/* ── UI ───────────────────────────────────────────────────── */

/** UI notifications interface */
export interface FoundryNotifications {
  info(message: string, options?: NotificationOptions): void;
  warn(message: string, options?: NotificationOptions): void;
  error(message: string, options?: NotificationOptions): void;
}

/** Notification options */
export interface NotificationOptions {
  permanent?: boolean;
  console?: boolean;
}

/** Global UI object */
export interface FoundryUI {
  notifications?: FoundryNotifications;
}

/* ── Hooks ────────────────────────────────────────────────── */

/** Hooks interface */
export interface FoundryHooks {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (...args: any[]) => void): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  once(event: string, callback: (...args: any[]) => void): number;
  off(event: string, id: number): void;
  call(event: string, ...args: unknown[]): boolean;
  callAll(event: string, ...args: unknown[]): boolean;
}

/* ── LPCS / ActorSheetV2 ──────────────────────────────────── */

/**
 * Minimal HandlebarsTemplatePart shim for Foundry v13 ApplicationV2 PARTS system.
 * @see https://foundryvtt.com/api/functions/foundry.applications.api.HandlebarsApplicationMixin.html
 */
export interface HandlebarsTemplatePart {
  template: string;
  templates?: string[];
  classes?: string[];
  container?: { classes?: string[]; id?: string };
  scrollable?: string[];
}

/**
 * Minimal ActorSheetV2 instance shim.
 * @see https://foundryvtt.com/api/classes/foundry.applications.sheets.ActorSheetV2.html
 */
export interface ActorSheetV2Instance {
  actor: FoundryDocument & {
    system: Record<string, unknown>;
    items: FoundryCollection<FoundryDocument>;
    isOwner: boolean;
    limited: boolean;
    img: string;
    prototypeToken?: { texture?: { src?: string } };
  };
  element: HTMLElement;
  tabGroups: Record<string, string>;
  isEditable: boolean;
  render(options?: { force?: boolean }): unknown;
  close(options?: Record<string, unknown>): Promise<void>;
}

/**
 * DocumentSheetConfig static shim for sheet registration.
 * @see https://foundryvtt.com/api/classes/foundry.applications.apps.DocumentSheetConfig.html
 */
export interface DocumentSheetConfigStatic {
  registerSheet(
    documentClass: unknown,
    scope: string,
    sheetClass: unknown,
    options?: {
      types?: string[];
      makeDefault?: boolean;
      label?: string;
    }
  ): void;
  unregisterSheet(
    documentClass: unknown,
    scope: string,
    sheetClass: unknown,
    options?: { types?: string[] }
  ): void;
}

