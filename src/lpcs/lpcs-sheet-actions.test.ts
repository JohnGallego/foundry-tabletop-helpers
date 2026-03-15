import { describe, expect, it, vi } from "vitest";

import { buildLPCSSheetActions } from "./lpcs-sheet-actions";

describe("lpcs sheet actions", () => {
  it("cycles skill sort mode and triggers a skills rerender", () => {
    const actions = buildLPCSSheetActions();
    const context = {
      _skillSortMode: "proficiency" as const,
      render: vi.fn(),
    };

    actions.cycleSkillSort.call(context as unknown as never, {} as Event, {} as HTMLElement);

    expect(context._skillSortMode).toBe("ability");
    expect(context.render).toHaveBeenCalledWith({ parts: ["skills"] });
  });

  it("opens the exhaustion dialog with the actor's current level", () => {
    const actions = buildLPCSSheetActions();
    const dialog = {
      classList: { add: vi.fn() },
      setAttribute: vi.fn(),
    };
    const updateDialogUI = vi.fn();
    const context = {
      actor: {
        isOwner: true,
        system: {
          attributes: {
            exhaustion: 3,
          },
        },
      },
      element: {
        querySelector(selector: string) {
          if (selector === "[data-exhaustion-dialog]") return dialog;
          return null;
        },
      },
      _pendingExhaustion: 0,
      _exhaustionDialogOpen: false,
      _updateExhaustionDialogUI: updateDialogUI,
    };

    actions.openExhaustionDialog.call(context as unknown as never, {} as Event, {} as HTMLElement);

    expect(context._pendingExhaustion).toBe(3);
    expect(context._exhaustionDialogOpen).toBe(true);
    expect(dialog.classList.add).toHaveBeenCalledWith("open");
    expect(dialog.setAttribute).toHaveBeenCalledWith("aria-hidden", "false");
    expect(updateDialogUI).toHaveBeenCalledWith(dialog, 3);
  });
});
