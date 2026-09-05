import { Popover } from '@base-ui-components/react/popover'
import { useSettings, type Theme } from './store'
import { T, type Lang } from '../i18n'
import type { HomeSide } from '../board/geometry'
import { sound } from '../sound/player'
import { useState } from 'react'
import { SettingsIcon } from '../chrome/Button'
import { Glossary } from '../chrome/Glossary'

/**
 * Settings.
 *
 * Four choices, one panel, no tabs. Everything here changes how the board looks
 * or sounds; nothing here changes how the game is played, because that decision
 * belongs on the ladder where the opponent is chosen.
 */
export function Settings() {
  const st = useSettings()
  const t = T(st.lang)
  const fa = st.lang === 'fa'
  const [glossary, setGlossary] = useState(false)

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={t('app.settings')}
        className="flex items-center p-1 opacity-55 transition-opacity hover:opacity-100"
        style={{ color: 'var(--text-dim)' }}
      >
        <SettingsIcon />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={10} align="end">
          <Popover.Popup
            dir={fa ? 'rtl' : 'ltr'}
            className="min-w-64 rounded-[3px] p-4 text-sm shadow-2xl outline-none"
            style={{
              background: 'var(--app-panel)',
              /* A quiet edge and a warm shadow. A bright brass border made it
                 a gold rectangle pasted over the board rather than something
                 belonging to the same room. */
              border: '1px solid var(--app-line)',
              boxShadow: '0 18px 50px -12px var(--shadow)',
              color: 'var(--text)',
            }}
          >
            <Row label={t('settings.board')}>
              <Choice<Theme>
                value={st.theme}
                onChange={(v) => st.set('theme', v)}
                options={[
                  ['khatam', t('settings.themeKhatam')],
                  ['tournament', t('settings.themeTournament')],
                  ['kaghaz', t('settings.themeKaghaz')],
                ]}
              />
            </Row>
            <Row label={t('settings.language')}>
              <Choice<Lang>
                value={st.lang}
                onChange={(v) => st.set('lang', v)}
                /* Language names are always written in their OWN language —
                   a Persian speaker looking for Persian looks for فارسی, not
                   for whatever "Persian" is in the language they cannot read.
                   Both bundles therefore hold the same two strings. */
                options={[
                  ['en', t('settings.langEn')],
                  ['fa', t('settings.langFa')],
                ]}
              />
            </Row>
            <Row label={t('settings.myHome')}>
              <Choice<HomeSide>
                value={st.home}
                onChange={(v) => st.set('home', v)}
                options={[
                  ['right', t('settings.right')],
                  ['left', t('settings.left')],
                ]}
              />
            </Row>
            <Row label={t('settings.sound')}>
              <Choice<string>
                value={st.volume > 0 ? 'on' : 'off'}
                onChange={(v) => {
                  const next = v === 'on' ? 0.7 : 0
                  st.set('volume', next)
                  if (next > 0) void sound.unlock()
                }}
                /* "On"/"Off", not "Unmute"/"Mute". These are two states of one
                   setting with the current one highlighted, and a pair of verbs
                   reads as two ACTIONS — leaving the player unsure whether the
                   lit one is what is happening or what would happen if they
                   pressed it. */
                options={[
                  ['on', t('settings.on')],
                  ['off', t('settings.off')],
                ]}
              />
            </Row>
            {/* Reachable during play, not only from the ladder — the words turn
                up in the turn log and the review, which is where someone is
                most likely to hit one they do not know. */}
            <button
              onClick={() => setGlossary(true)}
              className="mt-4 w-full rounded-[3px] px-3 py-2 text-start text-xs transition-colors"
              style={{ border: '1px solid var(--app-line)', color: 'var(--text-dim)' }}
            >
              {t('glossary.open')}
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
      {glossary && (
        <div className="fixed inset-0 z-30">
          <Glossary lang={st.lang} onClose={() => setGlossary(false)} />
        </div>
      )}
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
