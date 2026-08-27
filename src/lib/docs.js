export const DOC_COLLECTIONS = [
  { value: 'videos', label: 'Videos' },
  { value: 'how-tos', label: 'How-tos' },
  { value: 'client-meetings', label: 'Client meetings' },
  { value: 'ads', label: 'Ads' },
  { value: 'seo', label: 'SEO' },
  { value: 'shoots', label: 'Shoots' },
]

export const BRIEF_CHANNELS = [
  { channel: 'Paid social', this_month: '', design: '' },
  { channel: 'Google Ads', this_month: '', design: '' },
  { channel: 'Email / SMS', this_month: '', design: '' },
  { channel: 'Organic social', this_month: '', design: '' },
  { channel: 'Blog', this_month: '', design: '' },
]

export function toISODate(value = new Date()) {
  const d = new Date(value)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function wednesdayOnOrBefore(value = new Date()) {
  const d = new Date(value)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 4) % 7))
  return d
}

export function weekOptions(count = 8) {
  const current = wednesdayOnOrBefore()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(current)
    d.setDate(current.getDate() - (count - 2 - i) * 7)
    return toISODate(d)
  })
}

export function monthStart(value = new Date()) {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatWeekLabel(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatMonthLabel(iso) {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function parseLoomId(url = '') {
  const match = String(url).match(/loom\.com\/(?:share|embed)\/([a-zA-Z0-9]+)/i)
  return match ? match[1] : null
}

export function detectDocKind(url = '') {
  return parseLoomId(url) || /loom\.com/i.test(url) ? 'loom' : 'note'
}

export function defaultAgendaTitle(clientName, isoDate) {
  const [year, month, day] = String(isoDate).split('-')
  return `${year}-${Number(month)}-${Number(day)} ${clientName || 'Client'} x Brandastic Meeting Agenda`
}

export function stampKind(text = '') {
  if (/\bdue\b/i.test(text)) return 'due'
  if (/\b(need|asking|eow)\b/i.test(text)) return 'need'
  if (/\b(sent|updated|relaunched)\b/i.test(text)) return 'sent'
  return null
}

export const SETUP_SQL = 'Run supabase/agendas-internal-docs.sql in the Supabase SQL editor, then refresh.'
