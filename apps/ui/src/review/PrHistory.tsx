import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { prHistory } from '../game/archive'
import { digits, type Lang } from '../i18n/strings'

/**
 * PR over time.
 *
 * This is the thing that brings him back: a number that goes down over months.
 * Lower is better, so the axis is inverted — a line that climbs on screen means
 * improvement, which is the wrong way round and would have to be explained
 * every time. It climbs when he improves.
 *
 * Only drawn once there is something to see. A chart of one point is a boast,
 * not information.
 */
export function PrHistory({ lang }: { lang: Lang }) {
  const fa = lang === 'fa'
  const points = prHistory()
  if (points.length < 3) return null

  const data = points.map((p, i) => ({
    i: i + 1,
    pr: Math.round(p.checkerPr * 10) / 10,
  }))
  const best = Math.min(...data.map((d) => d.pr))
  const recent = data.slice(-5).reduce((a, d) => a + d.pr, 0) / Math.min(5, data.length)

  return (
    <section className="mx-auto mt-10 w-full max-w-5xl">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'روند بازی شما' : 'Your play over time'}
        </h2>
        <span className="text-xs" style={{ color: 'var(--text-dim)' }}>
          {fa ? 'میانگین اخیر' : 'recent'} {digits(Math.round(recent), lang)} ·{' '}
          {fa ? 'بهترین' : 'best'} {digits(Math.round(best), lang)}
        </span>
      </div>
      <div style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -22 }}>
            <CartesianGrid stroke="var(--frame)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="i" tick={{ fill: 'var(--text-dim)', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              reversed
              tick={{ fill: 'var(--text-dim)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--app-panel)',
                border: '1px solid var(--frame)',
                borderRadius: 2,
                color: 'var(--text)',
                fontSize: 12,
              }}
              labelFormatter={(v) => `${fa ? 'مسابقه' : 'match'} ${v}`}
              formatter={(v) => [String(v), 'PR']}
            />
            <Line
              type="monotone"
              dataKey="pr"
              stroke="var(--inlay)"
              strokeWidth={2}
              dot={{ r: 2, fill: 'var(--inlay)', strokeWidth: 0 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)', opacity: 0.7 }}>
        {fa
          ? 'PR کمتر بهتر است؛ محور برعکس است تا بالا رفتن خط یعنی بهتر شدن.'
          : 'Lower PR is better, so the axis is inverted — the line rising means you are improving.'}
      </p>
    </section>
  )
}
