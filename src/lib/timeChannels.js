export const TIME_CHANNELS = [
  { id: 'ppc', label: 'PPC' },
  { id: 'seo', label: 'SEO' },
  { id: 'social', label: 'Social' },
  { id: 'email', label: 'Email' },
  { id: 'web', label: 'Web' },
  { id: 'creative', label: 'Creative' },
  { id: 'account', label: 'Account' },
  { id: 'other', label: 'Other' },
]

export const TIME_CHANNEL_IDS = TIME_CHANNELS.map((channel) => channel.id)
export const DEFAULT_TIME_CHANNEL = 'other'

const CHANNEL_ALIASES = {
  ppc: 'ppc',
  'paid search': 'ppc',
  'paid social': 'social',
  ads: 'ppc',
  google: 'ppc',
  seo: 'seo',
  organic: 'seo',
  social: 'social',
  'organic social': 'social',
  email: 'email',
  sms: 'email',
  'email / sms': 'email',
  web: 'web',
  website: 'web',
  creative: 'creative',
  design: 'creative',
  account: 'account',
  am: 'account',
  other: 'other',
}

export function normalizeTimeChannel(value) {
  if (!value) return DEFAULT_TIME_CHANNEL
  const key = String(value).trim().toLowerCase()
  if (TIME_CHANNEL_IDS.includes(key)) return key
  return CHANNEL_ALIASES[key] || DEFAULT_TIME_CHANNEL
}

export function timeChannelLabel(value) {
  const id = normalizeTimeChannel(value)
  return TIME_CHANNELS.find((channel) => channel.id === id)?.label || 'Other'
}

export function emptyChannelHours() {
  return TIME_CHANNELS.reduce((acc, channel) => {
    acc[channel.id] = 0
    return acc
  }, {})
}

export function parseChannelHours(raw, monthlyHours = 0) {
  const next = emptyChannelHours()
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      const id = normalizeTimeChannel(key)
      const hours = Number(value)
      if (Number.isFinite(hours) && hours > 0) next[id] += hours
    }
  }
  const assigned = Object.values(next).reduce((sum, hours) => sum + hours, 0)
  if (assigned <= 0 && monthlyHours > 0) next.other = Number(monthlyHours) || 0
  return next
}

export function channelHoursTotal(channelHours) {
  return Object.values(channelHours || {}).reduce((sum, hours) => sum + (Number(hours) || 0), 0)
}

export function isMissingColumnError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  const code = String(error?.code || '')
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    message.includes('does not exist') ||
    message.includes('schema cache') ||
    message.includes('could not find the')
  )
}
