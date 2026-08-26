import { useEffect } from 'react'

/**
 * Keyboard control.
 *
 * A player moving at speed should not have to travel to a button to roll. These
 * are the four things done often enough to deserve a key, and nothing else —
 * a shortcut nobody uses is a thing to trip over in the docs.
 *
 *   Space / Enter   roll
 *   U / Backspace   undo the part-played turn
 *   D               double
 *   Escape          back to the ladder
 */
export function useKeyboard(actions: {
  roll?: () => void
  undo?: () => void
  double?: () => void
  escape?: () => void
}): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never steal keys from a focused control or a text field.
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      switch (e.key) {
        case ' ':
        case 'Enter':
          if (actions.roll) {
            e.preventDefault()
            actions.roll()
          }
          break
        case 'u':
        case 'U':
        case 'Backspace':
          if (actions.undo) {
            e.preventDefault()
            actions.undo()
          }
          break
        case 'd':
        case 'D':
          if (actions.double) {
            e.preventDefault()
            actions.double()
          }
          break
        case 'Escape':
          actions.escape?.()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])
}
