import { beforeEach, describe, expect, it, vi } from "vitest";

import { MOD } from "../logger";
import { resetRuntimePatches } from "../runtime/runtime-patches";
import { AM_SETTINGS } from "./asset-manager-settings";
import {
  __assetManagerInternals,
  openAssetManager,
  registerAssetManagerPicker,
} from "./asset-manager-picker";

class BaseFilePickerStub {
  static DEFAULT_OPTIONS = {};
  static upload = vi.fn();
  static renderCalls: Array<{ force?: boolean; options?: Record<string, unknown> }> = [];

  constructor(_options?: Record<string, unknown>) {}

  render(force?: boolean, options?: Record<string, unknown>): void {
    BaseFilePickerStub.renderCalls.push({ force, options });
  }
}

describe("asset manager runtime override", () => {
  beforeEach(() => {
    resetRuntimePatches();
    BaseFilePickerStub.renderCalls = [];

    (globalThis as Record<string, unknown>).game = {
      user: { isGM: true },
      settings: {
        get(module: string, key: string) {
          if (module === MOD && key === AM_SETTINGS.ENABLE) return true;
          return undefined;
        },
      },
    };

    (globalThis as Record<string, unknown>).foundry = {
      utils: {
        mergeObject(base: Record<string, unknown>, update: Record<string, unknown>) {
          return { ...base, ...update };
        },
      },
    };

    (globalThis as Record<string, unknown>).ui = {
      notifications: {
        info: vi.fn(),
      },
    };

    (globalThis as Record<string, unknown>).CONFIG = {
      ux: {
        FilePicker: BaseFilePickerStub,
      },
    };
  });

  it("registers the FilePicker override only once", () => {
    registerAssetManagerPicker();
    const firstOverride = ((globalThis as Record<string, unknown>).CONFIG as {
      ux: { FilePicker: unknown };
    }).ux.FilePicker;
    const stateAfterFirst = __assetManagerInternals.getAssetManagerPatchState();

    registerAssetManagerPicker();
    const secondOverride = ((globalThis as Record<string, unknown>).CONFIG as {
      ux: { FilePicker: unknown };
    }).ux.FilePicker;

    expect(firstOverride).toBe(secondOverride);
    expect(stateAfterFirst.originalFilePicker).toBe(BaseFilePickerStub);
    expect(stateAfterFirst.overrideFilePicker).toBe(firstOverride);
  });

  it("suppresses notification info calls with nested restore guards", () => {
    const notifications = ((globalThis as Record<string, unknown>).ui as {
      notifications: { info: ReturnType<typeof vi.fn> };
    }).notifications;
    const originalInfo = notifications.info;

    const restoreA = __assetManagerInternals.suppressInfoNotifications();
    const replacedInfo = notifications.info;
    const restoreB = __assetManagerInternals.suppressInfoNotifications();

    expect(replacedInfo).not.toBe(originalInfo);
    expect(notifications.info).toBe(replacedInfo);
    expect(__assetManagerInternals.getAssetManagerPatchState().notificationSuppressionDepth).toBe(2);

    restoreA();
    expect(notifications.info).toBe(replacedInfo);
    expect(__assetManagerInternals.getAssetManagerPatchState().notificationSuppressionDepth).toBe(1);

    restoreB();
    expect(notifications.info).not.toBe(replacedInfo);
    expect(typeof notifications.info).toBe("function");
    expect(__assetManagerInternals.getAssetManagerPatchState().notificationSuppressionDepth).toBe(0);
  });

  it("opens the standalone asset manager using the registered override", () => {
    registerAssetManagerPicker();

    openAssetManager();

    expect(BaseFilePickerStub.renderCalls).toHaveLength(1);
    expect(BaseFilePickerStub.renderCalls[0]).toEqual({
      force: true,
      options: { width: 960, height: 680 },
    });
  });
});
