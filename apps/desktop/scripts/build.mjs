import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: desktop,
    stdio: 'inherit',
    // `pnpm` is a `.cmd` shim on Windows. Node cannot spawn that shim
    // directly without going through the command shell (it reports EINVAL).
    shell: process.platform === 'win32' && command.toLowerCase().endsWith('.cmd'),
  })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.platform === 'win32') {
  run('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    resolve(desktop, 'scripts/prepare-gnubg.ps1'),
  ])
  run('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    resolve(desktop, 'scripts/smoke-gnubg.ps1'),
  ])
  run(pnpm, ['exec', 'tauri', 'build'])
} else {
  // Windows is the release target. On Linux, compile the real shell and IPC
  // wiring without attempting to manufacture a non-shipping installer.
  run(pnpm, ['exec', 'tauri', 'build', '--no-bundle'])
}
