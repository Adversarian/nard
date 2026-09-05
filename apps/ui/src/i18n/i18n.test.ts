import { describe, expect, it } from 'vitest'
import en from './en.json'
import fa from './fa.json'
import { translate } from './index'

/**
 * The two bundles have to stay in step, and the placeholders in them have to
 * match. A Persian string that quietly lost its `{n}` renders "Match to " with
 * nothing after it, and nothing else in the app would notice.
 */
describe('localisation bundles', () => {
  it('has every English key in Persian', () => {
    const missing = Object.keys(en).filter((k) => !(k in fa))
    expect(missing).toEqual([])
  })

  it('has no Persian key that English does not define', () => {
    const extra = Object.keys(fa).filter((k) => !(k in en))
    expect(extra).toEqual([])
  })

  it('uses the same placeholders in both languages', () => {
    const holes = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const [key, value] of Object.entries(en)) {
      const other = (fa as Record<string, string>)[key]
      if (other === undefined) continue
      expect({ key, holes: holes(other) }).toEqual({ key, holes: holes(value) })
    }
  })

  it('leaves no English string sitting in the Persian bundle', () => {
    // A key whose "translation" is byte-identical to the English is almost
    // always one that was added and never translated. Proper nouns and
    // borrowed terms are the real exceptions, so they are named here.
    const shared = new Set([
      'app.name',
      'match.crawford',
      // Language names are always written in their own language.
      'settings.langEn',
      'settings.langFa',
    ])
    const untranslated = Object.entries(en)
      .filter(([k, v]) => !shared.has(k) && (fa as Record<string, string>)[k] === v)
      .map(([k]) => k)
    expect(untranslated).toEqual([])
  })

  it('substitutes numbers in the interface own digits', () => {
    expect(translate('fa', 'match.to', { n: 7 })).toContain('۷')
    expect(translate('en', 'match.to', { n: 7 })).toContain('7')
  })
})
