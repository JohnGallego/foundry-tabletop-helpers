/**
 * Character Creator — Content Filter
 *
 * Applies GM curation to raw compendium index data.
 * Disabled items are stored as a Set<string> of UUIDs for O(1) lookup.
 */

import type { CreatorIndexEntry } from "../character-creator-types";
import { getDisabledContentUUIDs } from "../character-creator-settings";

export class ContentFilter {
  private disabledUUIDs: Set<string>;

  constructor(disabledUUIDs: string[] = []) {
    this.disabledUUIDs = new Set(disabledUUIDs);
  }

  /** Filter entries, removing any that are disabled. */
  filterEntries(entries: CreatorIndexEntry[]): CreatorIndexEntry[] {
    return entries.filter((e) => !this.disabledUUIDs.has(e.uuid));
  }

  /** Check if a specific UUID is enabled (not disabled). */
  isEnabled(uuid: string): boolean {
    return !this.disabledUUIDs.has(uuid);
  }

  /** Toggle an item's enabled state. */
  toggle(uuid: string, enabled: boolean): void {
    if (enabled) {
      this.disabledUUIDs.delete(uuid);
    } else {
      this.disabledUUIDs.add(uuid);
    }
  }

  /** Enable all items of a given type. */
  enableAll(entries: CreatorIndexEntry[]): void {
    for (const e of entries) {
      this.disabledUUIDs.delete(e.uuid);
    }
  }

  /** Disable all items of a given type. */
  disableAll(entries: CreatorIndexEntry[]): void {
    for (const e of entries) {
      this.disabledUUIDs.add(e.uuid);
    }
  }

  /** Serialize to array for settings storage. */
  toArray(): string[] {
    return [...this.disabledUUIDs];
  }

  /** Create a ContentFilter from the current settings. */
  static fromSettings(): ContentFilter {
    return new ContentFilter(getDisabledContentUUIDs());
  }
}
