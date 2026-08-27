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

export const STARTER_LOOMS = [
  {
    id: 'starter-social-brief',
    title: 'Submitting a Brief for Social Pitch',
    url: 'https://www.loom.com/share/d162af36c08741c593efd6e20964a049',
    notes: 'How to submit a social pitch brief.',
    collection: 'videos',
    kind: 'loom',
  },
  {
    id: 'starter-heyreach',
    title: 'Setting Up HeyReach for Outreach Plan from Sales Navigator',
    url: 'https://www.loom.com/share/b88dc57efb8a4a1abfcfeff28c586f64',
    notes: 'HeyReach setup from a Sales Navigator outreach plan.',
    collection: 'videos',
    kind: 'loom',
  },
  {
    id: 'starter-healthcare-images',
    title: 'Troubleshooting Image Update Issues for Healthcare Blog',
    url: 'https://www.loom.com/share/eef43ccf167a4c03ace7e940615f9bec',
    notes: 'Fix image updates on a healthcare blog.',
    collection: 'videos',
    kind: 'loom',
  },
  {
    id: 'starter-gmail-signature',
    title: 'How to Update Your Email Signature in Gmail',
    url: 'https://www.loom.com/share/b0d3c72654c44c898ddb18266916906d',
    notes: 'Update the Gmail signature.',
    collection: 'videos',
    kind: 'loom',
  },
]

export function extractDumpUrls(value = '') {
  const matches = String(value).match(/https?:\/\/[^\s]+/gi) || []
  return [...new Set(matches.map((url) => url.replace(/[),.;]+$/, '')))]
}

export function knownLoom(url = '') {
  const id = parseLoomId(url)
  return STARTER_LOOMS.find((doc) => parseLoomId(doc.url) === id) || null
}
