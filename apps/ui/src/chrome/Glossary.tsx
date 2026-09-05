import { motion } from 'motion/react'
import { T, type Key, type Lang } from '../i18n'
import { Button } from './Button'

/**
 * The vocabulary, in prose.
 *
 * NOT a tutorial. AGENTS.md §1 still holds: the player this is built for has
 * been playing for fifty years and does not need to be taught backgammon, and
 * nothing here explains how to play. What it explains is the WORDS — what a
 * prime is and why six in a row cannot be jumped, what taking a double actually
 * costs you — because the interface uses them (the opponents' style lines, the
 * review's bands, the match-length note) and anyone else who picks the game up
 * will meet them cold.
 *
 * Ordered from the board outward: the things you can point at first, then the
 * shapes, then the scoring, then the numbers the review reports.
 */
const TERMS = [
  'point',
  'pip',
  'blot',
  'hit',
  'bar',
  'anchor',
  'prime',
  'backgame',
  'gammon',
  'backgammon',
  'cube',
  'crawford',
  'match',
  'pr',
] as const

export function Glossary({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = T(lang)
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      className="absolute inset-0 z-20 flex items-center justify-center p-6"
      style={{ background: 'color-mix(in srgb, var(--app-bg) 86%, transparent)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.04 }}
        // Stop a click inside the panel closing it; the backdrop keeps that job.
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-3xl flex-col rounded-[3px]"
        style={{ background: 'var(--app-panel)', border: '1px solid var(--app-line)' }}
      >
        <header
          className="flex shrink-0 items-center justify-between px-7 py-5"
          style={{ borderBottom: '1px solid var(--app-line)' }}
        >
          <div>
            <h2 className="text-lg" style={{ color: 'var(--text)' }}>
              {t('glossary.title')}
            </h2>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>
              {t('glossary.intro')}
            </p>
          </div>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </header>

        <dl className="min-h-0 flex-1 overflow-y-auto px-7 py-5">
          {TERMS.map((id) => (
            <div key={id} className="mb-5 last:mb-0">
              <dt className="text-sm" style={{ color: 'var(--inlay)' }}>
                {t(`glossary.${id}.term` as Key)}
              </dt>
              <dd
                className="mt-1 text-xs leading-relaxed"
                style={{ color: 'var(--text-dim)' }}
              >
                {t(`glossary.${id}.body` as Key)}
              </dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </motion.div>
  )
}
