const TAURI_MARKER = '__TAURI_INTERNALS__'

export function isTauri(): boolean {
  return TAURI_MARKER in globalThis
}

export async function invokeTauri<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}
