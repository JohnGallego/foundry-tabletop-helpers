/**
 * Shared utility functions used across the module.
 */

import { Log } from "./logger";

/**
 * Execute a synchronous function, catching and logging any thrown errors.
 * Use this to wrap Foundry hook callbacks so one failing hook never breaks others.
 *
 * @param fn    - The callback to execute.
 * @param where - Human-readable label used in the error log.
 */
export function safe(fn: () => void, where: string): void {
  try {
    fn();
  } catch (err) {
    Log.error(`Exception in ${where}`, err);
  }
}

