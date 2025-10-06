// Local augmentations / shims to improve typing for the hooks we use

// These extend the upstream fvtt-types so we can write strongly-typed callbacks
// for V2 and legacy V1 application hooks without casting.
declare global {
  namespace foundry.applications.api {
    // Convenience alias if not present in scope (we only reference these types)
    // Using the upstream namespaces from fvtt-types
    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface ApplicationV2 {}
  }

  namespace Hooks {
    type GetHeaderControlsApplicationV2<Application extends foundry.applications.api.ApplicationV2 = any> = (
      application: Application,
      controls: import("fvtt-types").foundry.client.applications.api.ApplicationV2.HeaderControlsEntry[],
    ) => void;

    type RenderApplicationV1 = (
      app: import("fvtt-types").foundry.client.applications.base.Application,
      html: JQuery<HTMLElement>
    ) => void;

    type CloseApplicationV1 = (
      app: import("fvtt-types").foundry.client.applications.base.Application
    ) => void;

    type GetApplicationV1HeaderButtons = (
      app: import("fvtt-types").foundry.client.applications.base.Application,
      buttons: Array<{
        label?: string;
        class?: string;
        icon?: string;
        onclick?: (event: MouseEvent) => void;
      }>
    ) => void;
  }

  interface HookConfig {
    getHeaderControlsApplicationV2: Hooks.GetHeaderControlsApplicationV2;
    renderApplicationV1: Hooks.RenderApplicationV1;
    closeApplicationV1: Hooks.CloseApplicationV1;
    getApplicationV1HeaderButtons: Hooks.GetApplicationV1HeaderButtons;
  }
}

export {};

