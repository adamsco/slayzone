import { useHotkeys } from 'react-hotkeys-hook'
import type { DependencyList } from 'react'
import type { Keys, HotkeyCallback, Options } from 'react-hotkeys-hook'
import { isModalDialogOpen } from './is-modal-dialog-open'

type OptionsOrDeps = Options | DependencyList

/** Drop-in replacement for useHotkeys that auto-skips when a modal dialog is open. */
export function useGuardedHotkeys<T extends HTMLElement>(
  keys: Keys,
  callback: HotkeyCallback,
  options?: OptionsOrDeps,
  dependencies?: OptionsOrDeps
) {
  return useHotkeys<T>(keys, (e, he) => {
    if (isModalDialogOpen()) return
    callback(e, he)
  }, options, dependencies)
}
