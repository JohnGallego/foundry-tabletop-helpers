/**
 * Type definitions index.
 * 
 * Re-exports all type definitions and guards for easy importing.
 */

// Foundry VTT types
export type {
  FoundryGame,
  FoundrySystem,
  FoundryUser,
  FoundryModule,
  FoundryCollection,
  FoundrySettings,
  SettingRegistration,
  SettingMenuRegistration,
  FoundryCompendiumCollection,
  FoundryDocumentClass,
  FoundryDocument,
  FoundryIndexEntry,
  FoundrySocket,
  FoundryNotifications,
  NotificationOptions,
  FoundryUI,
  FoundryHooks,
} from "./foundry";

// Type guards and accessors
export {
  getGame,
  getHooks,
  getUI,
  getHandlebars,
  getConfig,
  getFormApplicationClass,
  getDialogClass,
  getCompendiumCollectionClass,
  isDnd5eWorld,
  getSystemId,
  systemVersionAtLeast,
  isDnd5eActivitiesSupported,
  isGM,
  getCurrentUserId,
  getPlayerUsers,
  getAllUsers,
  getSetting,
  setSetting,
  fromUuid,
  loadTemplates,
  renderTemplate,
  hasProperty,
  isObject,
} from "./guards";

