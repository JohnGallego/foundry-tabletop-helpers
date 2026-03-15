import { Log } from "../logger";
import { rotationLabel, shouldShowRotateButton, supportV1 } from "../settings";
import { getHooks } from "../types";
import { safe } from "../utils";
import { isExcludedApp } from "./window-rotation-helpers";
import type { AppV1Like, AppV2Like, V1Button } from "./index";

interface RegisterWindowRotationUiHooksOptions {
  onToggle: (app: AppV2Like) => void;
  onRestore: (app: AppV2Like) => void;
  onCleanup: (app: AppV2Like) => void;
}

export function ensureV2RotateButton(app: AppV2Like, onToggle: (app: AppV2Like) => void): void {
  const header = app?.window?.header;
  if (!header || header.querySelector('[data-action="fth-rotate"]')) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "header-control icon fth-rotate-btn";
  btn.dataset.action = "fth-rotate";
  btn.setAttribute("aria-label", rotationLabel());
  btn.title = rotationLabel();

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-arrows-rotate";
  btn.appendChild(icon);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggle(app);
  });

  const closeBtn = app?.window?.close ?? header.querySelector<HTMLElement>('[data-action="close"]');
  if (closeBtn) header.insertBefore(btn, closeBtn);
  else header.appendChild(btn);

  Log.debug("injected rotate button into V2 header", { app: app?.constructor?.name, id: app?.id });
}

const onGetApplicationV1HeaderButtons = (
  fn: (app: AppV1Like, buttons: V1Button[]) => void,
) => getHooks()?.on?.("getApplicationHeaderButtons", fn as (...args: unknown[]) => void);

const onRenderApplicationV1 = (
  fn: (app: AppV1Like) => void,
) => getHooks()?.on?.("renderApplication", fn as (...args: unknown[]) => void);

const onCloseApplicationV1 = (
  fn: (app: AppV1Like) => void,
) => getHooks()?.on?.("closeApplication", fn as (...args: unknown[]) => void);

export function registerWindowRotationUiHooks(options: RegisterWindowRotationUiHooksOptions): void {
  getHooks()?.on?.(
    "renderApplicationV2",
    ((app: AppV2Like) =>
      safe(() => {
        if (isExcludedApp(app)) return;
        if (shouldShowRotateButton()) ensureV2RotateButton(app, options.onToggle);
        options.onRestore(app);
      }, "renderApplicationV2")) as (...args: unknown[]) => void,
  );

  getHooks()?.on?.(
    "closeApplicationV2",
    ((app: AppV2Like) =>
      safe(() => {
        options.onCleanup(app);
      }, "closeApplicationV2")) as (...args: unknown[]) => void,
  );

  onGetApplicationV1HeaderButtons((app, buttons) =>
    safe(() => {
      if (!supportV1()) return;
      if (!shouldShowRotateButton()) return;
      buttons.unshift({
        label: rotationLabel(),
        class: "fth-rotate",
        icon: "fa-solid fa-arrows-rotate",
        onclick: () => options.onToggle(app),
      });
      Log.debug("added V1 header button", { app: app?.constructor?.name, appId: app?.appId });
    }, "getApplicationV1HeaderButtons"),
  );

  onRenderApplicationV1((app) =>
    safe(() => {
      if (!supportV1()) return;
      options.onRestore(app);
    }, "renderApplicationV1"),
  );

  onCloseApplicationV1((app) =>
    safe(() => {
      if (!supportV1()) return;
      options.onCleanup(app);
    }, "closeApplicationV1"),
  );
}
