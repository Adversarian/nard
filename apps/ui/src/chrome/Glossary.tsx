import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { digits, T, type Key, type Lang } from '../i18n'
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
 * PAGED, NOT SCROLLED. A scrollbar is browser chrome: it is drawn by the
 * platform, in the platform's colours, and on a dark walnut panel it is a grey
 * plastic strip down one side that belongs to no part of this design. Paging
 * costs two buttons and a counter, and every page is a fixed, composed block of
 * type instead of a moving column with its edges cut off.
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

/** Four to a page: enough to read as a group, few enough to never need a scrollbar
 *  at the smallest window the app allows. */
const PER_PAGE = 4
const PAGES = Math.ceil(TERMS.length / PER_PAGE)

export function Glossary({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const t = T(lang)
  const [page, setPage] = useState(0)
  const rtl = lang === 'fa'

  // Arrow keys page it, Escape closes it. A panel with no scrollbar should
  // still be navigable without reaching for the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') setPage((p) => Math.min(PAGES - 1, p + (rtl ? -1 : 1)))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p + (rtl ? 1 : -1)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, rtl])

  const shown = TERMS.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      dir={rtl ? 'rtl' : 'ltr'}
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
        className="flex w-full max-w-3xl flex-col rounded-[3px]"
        style={{
          background: 'var(--app-panel)',
          border: '1px solid var(--app-line)',
          boxShadow: '0 24px 60px -14px var(--shadow)',
        }}
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

        {/*
          A fixed height, sized to the tallest page, so the panel does not
          resize as you turn through it. A dialog that changes shape under the
          cursor is worse than one with some space at the bottom of a page.
        */}
        <dl className="min-h-[19rem] px-7 py-6">
          {shown.map((id) => (
            <div key={id} className="mb-5 last:mb-0">
              <dt className="text-sm" style={{ color: 'var(--inlay)' }}>
                {t(`glossary.${id}.term` as Key)}
              </dt>
              <dd className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--text-dim)' }}>
                {t(`glossary.${id}.body` as Key)}
              </dd>
            </div>
          ))}
        </dl>

        <footer
          className="flex shrink-0 items-center justify-between px-7 py-4"
          style={{ borderTop: '1px solid var(--app-line)' }}
        >
          <Page onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            {rtl ? '→' : '←'}
          </Page>
          <span
            className="text-label uppercase tracking-[0.2em] tabular-nums"
            style={{ color: 'var(--text-dim)' }}
          >
            {digits(page + 1, lang)} / {digits(PAGES, lang)}
          </span>
          <Page
            onClick={() => setPage((p) => Math.min(PAGES - 1, p + 1))}
            disabled={page === PAGES - 1}
          >
            {rtl ? '←' : '→'}
          </Page>
        </footer>
      </motion.div>
    </motion.div>
  )
}

function Page({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-[3px] px-4 py-1.5 text-base transition-opacity disabled:cursor-default"
      style={{
        border: '1px solid var(--app-line)',
        color: 'var(--text)',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      {children}
    </button>
  )
}
