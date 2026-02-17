import { Building2, Briefcase, Rocket } from 'lucide-react'

// Client type classification constants
export const CLIENT_TYPES = {
  RETAINER: 'retainer',
  PROJECT: 'project',
  PERSONAL_SAAS: 'personal_saas',
}

export const CLIENT_TYPE_LABELS = {
  [CLIENT_TYPES.RETAINER]: 'Retainer',
  [CLIENT_TYPES.PROJECT]: 'Project',
  [CLIENT_TYPES.PERSONAL_SAAS]: 'Personal/SaaS',
}

export const CLIENT_TYPE_DESCRIPTIONS = {
  [CLIENT_TYPES.RETAINER]: 'Ongoing monthly engagement with recurring hours',
  [CLIENT_TYPES.PROJECT]: 'Fixed-scope project work with defined deliverables',
  [CLIENT_TYPES.PERSONAL_SAAS]: 'Brandastic venture or personal SaaS company',
}

export const CLIENT_TYPE_COLORS = {
  [CLIENT_TYPES.RETAINER]: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-500/30',
    icon: 'text-blue-500',
    solid: 'bg-blue-500',
  },
  [CLIENT_TYPES.PROJECT]: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    text: 'text-green-700 dark:text-green-400',
    border: 'border-green-200 dark:border-green-500/30',
    icon: 'text-green-500',
    solid: 'bg-green-500',
  },
  [CLIENT_TYPES.PERSONAL_SAAS]: {
    bg: 'bg-purple-50 dark:bg-purple-500/10',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-500/30',
    icon: 'text-purple-500',
    solid: 'bg-purple-500',
  },
}

export const CLIENT_TYPE_ICONS = {
  [CLIENT_TYPES.RETAINER]: Building2,
  [CLIENT_TYPES.PROJECT]: Briefcase,
  [CLIENT_TYPES.PERSONAL_SAAS]: Rocket,
}

// Get all client type options for select dropdowns
export const CLIENT_TYPE_OPTIONS = [
  {
    value: CLIENT_TYPES.RETAINER,
    label: CLIENT_TYPE_LABELS[CLIENT_TYPES.RETAINER],
    description: CLIENT_TYPE_DESCRIPTIONS[CLIENT_TYPES.RETAINER],
    icon: CLIENT_TYPE_ICONS[CLIENT_TYPES.RETAINER],
    colors: CLIENT_TYPE_COLORS[CLIENT_TYPES.RETAINER],
  },
  {
    value: CLIENT_TYPES.PROJECT,
    label: CLIENT_TYPE_LABELS[CLIENT_TYPES.PROJECT],
    description: CLIENT_TYPE_DESCRIPTIONS[CLIENT_TYPES.PROJECT],
    icon: CLIENT_TYPE_ICONS[CLIENT_TYPES.PROJECT],
    colors: CLIENT_TYPE_COLORS[CLIENT_TYPES.PROJECT],
  },
  {
    value: CLIENT_TYPES.PERSONAL_SAAS,
    label: CLIENT_TYPE_LABELS[CLIENT_TYPES.PERSONAL_SAAS],
    description: CLIENT_TYPE_DESCRIPTIONS[CLIENT_TYPES.PERSONAL_SAAS],
    icon: CLIENT_TYPE_ICONS[CLIENT_TYPES.PERSONAL_SAAS],
    colors: CLIENT_TYPE_COLORS[CLIENT_TYPES.PERSONAL_SAAS],
  },
]

// Helper function to get client type config
export function getClientTypeConfig(clientType) {
  const type = clientType || CLIENT_TYPES.RETAINER
  return {
    value: type,
    label: CLIENT_TYPE_LABELS[type] || CLIENT_TYPE_LABELS[CLIENT_TYPES.RETAINER],
    description: CLIENT_TYPE_DESCRIPTIONS[type] || CLIENT_TYPE_DESCRIPTIONS[CLIENT_TYPES.RETAINER],
    icon: CLIENT_TYPE_ICONS[type] || CLIENT_TYPE_ICONS[CLIENT_TYPES.RETAINER],
    colors: CLIENT_TYPE_COLORS[type] || CLIENT_TYPE_COLORS[CLIENT_TYPES.RETAINER],
  }
}

// Helper function to get badge classes for a client type
export function getClientTypeBadgeClasses(clientType) {
  const colors = CLIENT_TYPE_COLORS[clientType] || CLIENT_TYPE_COLORS[CLIENT_TYPES.RETAINER]
  return `${colors.bg} ${colors.text} ${colors.border}`
}
