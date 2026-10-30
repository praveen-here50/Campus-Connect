// Formatting helpers shared by every screen.

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "9 min ago", "Yesterday", "3 days ago", then a date. */
export function ago(iso: string): string {
  const then = new Date(iso).getTime()
  const sec = Math.round((then - Date.now()) / 1000)
  const abs = Math.abs(sec)
  if (abs < 60) return 'Just now'
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(sec / 3600), 'hour')
  if (abs < 7 * 86400) {
    const s = rtf.format(Math.round(sec / 86400), 'day')
    return s.charAt(0).toUpperCase() + s.slice(1)
  }
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/** A stable pale hue per person: identity, never data. Neighbouring ids land far apart on the wheel. */
export function personHue(id: number): number {
  return Math.round((id * 137.508) % 360)
}

/** A Markdown post as one line of plain text for previews: no fences, headings, emphasis or link syntax. */
export function excerpt(markdown: string): string {
  return markdown
    .replace(/```[\w-]*/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/~~|__|[*`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en')} ${n === 1 ? one : many}`
}

export function greetingWord(date = new Date()): string {
  const h = date.getHours()
  if (h < 5) return 'Evening'
  if (h < 12) return 'Morning'
  if (h < 18) return 'Afternoon'
  return 'Evening'
}

export const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Recruiting',
  IN_PROGRESS: 'Building',
  COMPLETED: 'Shipped',
  TODO: 'To do',
  DONE: 'Done',
  AVAILABLE: 'Open to projects',
  LOOKING: 'Looking for a team',
  BUSY: 'Heads down',
}

export const LEVEL_LABEL = ['', 'Learning', 'Basic', 'Comfortable', 'Strong', 'Expert']

export const CATEGORIES = ['Web', 'Mobile', 'AI/ML', 'Data', 'Hardware/IoT', 'Game', 'Research', 'Design', 'Other']
