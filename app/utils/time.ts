/**
 * Compact relative-time formatting, e.g. "4 min ago", "2 h ago", "just now".
 * A matching absolute string is available via `formatAbsoluteTime` for tooltips.
 */

export function formatRelativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return ''

  const deltaSec = Math.round((now - then) / 1000)
  const future = deltaSec < 0
  const sec = Math.abs(deltaSec)

  const wrap = (label: string) => (future ? `in ${label}` : `${label} ago`)

  if (sec < 45) return 'just now'
  if (sec < 90) return wrap('1 min')

  const min = Math.round(sec / 60)
  if (min < 60) return wrap(`${min} min`)

  const hr = Math.round(min / 60)
  if (hr < 24) return wrap(`${hr} h`)

  const day = Math.round(hr / 24)
  if (day < 7) return wrap(`${day} d`)

  const week = Math.round(day / 7)
  if (week < 5) return wrap(`${week} w`)

  const month = Math.round(day / 30)
  if (month < 12) return wrap(`${month} mo`)

  const year = Math.round(day / 365)
  return wrap(`${year} y`)
}

/** Full, locale-aware absolute time, used as the `title` tooltip. */
export function formatAbsoluteTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** HH:MM:SS in the local timezone, used for the "last updated" indicator. */
export function formatClock(date: Date | number | null | undefined): string {
  if (date == null) return '-'
  const d = typeof date === 'number' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
