import { Popover } from '@base-ui-components/react/popover'
import { useSettings, type Theme } from './store'
import { STRINGS, type Lang } from '../i18n/strings'
import type { HomeSide } from '../board/geometry'
import { sound } from '../sound/player'
import { SettingsIcon } from '../chrome/Button'

/**
 * Settings.
 *
 * Four choices, one panel, no tabs. Everything here changes how the board looks
 * or sounds; nothing here changes how the game is played, because that decision
 * belongs on the ladder where the opponent is chosen.
 */
export function Settings() {
  const st = useSettings()
  const s = STRINGS[st.lang]
  const fa = st.lang === 'fa'

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={fa ? 'تنظیمات' : 'Settings'}
        className="flex items-center p-1 opacity-55 transition-opacity hover:opacity-100"
        style={{ color: 'var(--text-dim)' }}
      >
        <SettingsIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={10} align="end">
          <Popover.Popup
            dir={fa ? 'rtl' : 'ltr'}
            className="min-w-64 rounded-sm p-4 text-sm shadow-xl outline-none"
            style={{
              background: 'var(--app-panel)',
              border: '1px solid var(--app-line)',
              color: 'var(--text)',
            }}
          >
            <Row label={fa ? 'تخته' : 'Board'}>
              <Choice<Theme>
                value={st.theme}
                onChange={(v) => st.set('theme', v)}
                options={[
                  ['khatam', fa ? 'خاتم' : 'Khatam'],
                  ['tournament', fa ? 'مسابقه' : 'Tournament'],
                  ['kaghaz', fa ? 'کاغذ' : 'Kaghaz'],
                ]}
              />
            </Row>
            <Row label={fa ? 'زبان' : 'Language'}>
              <Choice<Lang>
                value={st.lang}
                onChange={(v) => st.set('lang', v)}
                options={[
                  ['en', 'English'],
                  ['fa', 'فارسی'],
                ]}
              />
            </Row>
            <Row label={fa ? 'خانهٔ من' : 'My home'}>
              <Choice<HomeSide>
                value={st.home}
                onChange={(v) => st.set('home', v)}
                options={[
                  ['right', fa ? 'راست' : 'Right'],
                  ['left', fa ? 'چپ' : 'Left'],
                ]}
              />
            </Row>
            <Row label={fa ? 'صدا' : 'Sound'}>
              <Choice<string>
                value={st.volume > 0 ? 'on' : 'off'}
                onChange={(v) => {
                  const next = v === 'on' ? 0.7 : 0
                  st.set('volume', next)
                  if (next > 0) void sound.unlock()
                }}
                options={[
                  ['on', s.unmute],
                  ['off', s.mute],
                ]}
              />
            </Row>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1.5 text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Choice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: readonly (readonly [T, string])[]
}) {
  return (
    <div className="flex gap-1.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className="rounded-sm px-2.5 py-1 text-xs transition-colors"
          style={{
            border: `1px solid ${value === v ? 'var(--inlay)' : 'var(--app-line)'}`,
            color: value === v ? 'var(--text)' : 'var(--text-dim)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
