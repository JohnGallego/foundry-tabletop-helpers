/**
 * Shared runtime patch registry for one-time global/prototype overrides.
 *
 * Foundry modules often need to patch global classes or configuration objects.
 * This registry makes those patches idempotent across repeated hook execution
 * and gives each patch a stable place to keep original references.
 */

interface RuntimePatchEntry<TState> {
  applied: boolean;
  state: TState;
}

const runtimePatchRegistry = new Map<string, RuntimePatchEntry<unknown>>();

/**
 * Get or create mutable state for a runtime patch key.
 */
export function getRuntimePatchState<TState>(
  key: string,
  createState: () => TState
): TState {
  const existing = runtimePatchRegistry.get(key) as RuntimePatchEntry<TState> | undefined;
  if (existing) return existing.state;

  const state = createState();
  runtimePatchRegistry.set(key, { applied: false, state });
  return state;
}

/**
 * Apply a patch exactly once for the given key.
 *
 * Returns the shared state for the patch and whether this invocation
 * actually applied the patch.
 */
export function applyRuntimePatchOnce<TState>(
  key: string,
  createState: () => TState,
  apply: (state: TState) => void
): { applied: boolean; state: TState } {
  const existing = runtimePatchRegistry.get(key) as RuntimePatchEntry<TState> | undefined;
  if (existing) {
    return { applied: false, state: existing.state };
  }

  const state = createState();
  runtimePatchRegistry.set(key, { applied: false, state });

  apply(state);

  const entry = runtimePatchRegistry.get(key) as RuntimePatchEntry<TState>;
  entry.applied = true;
  return { applied: true, state };
}

/**
 * Returns true if a patch with this key has already been applied.
 */
export function isRuntimePatchApplied(key: string): boolean {
  const entry = runtimePatchRegistry.get(key);
  return entry?.applied ?? false;
}

/**
 * Test helper: clear all registered runtime patches.
 */
export function resetRuntimePatches(): void {
  runtimePatchRegistry.clear();
}
