import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, differenceInMinutes, differenceInSeconds } from 'date-fns'

/**
 * Merge Tailwind classes with clsx
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Format date for display
 */
export function formatDate(date, formatStr = 'MMM d, yyyy') {
  if (!date) return ''
  try {
    const d = new Date(date)
    // Check if date is valid
    if (isNaN(d.getTime())) return ''
    return format(d, formatStr)
  } catch (e) {
    console.warn('Invalid date:', date)
    return ''
  }
}

/**
 * Format date relative to now
 */
export function formatRelativeDate(date) {
  if (!date) return ''
  try {
    const d = new Date(date)
    // Check if date is valid
    if (isNaN(d.getTime())) return ''
    return formatDistanceToNow(d, { addSuffix: true })
  } catch (e) {
    console.warn('Invalid date:', date)
    return ''
  }
}

/**
 * Format duration in minutes to human readable
 */
export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0m'
  
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Format timer display (HH:MM:SS)
 */
export function formatTimerDisplay(startTime) {
  if (!startTime) return '00:00:00'
  
  const start = new Date(startTime)
  const now = new Date()
  const totalSeconds = Math.max(0, differenceInSeconds(now, start))
  
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

/**
 * Calculate elapsed minutes from start time
 */
export function getElapsedMinutes(startTime) {
  if (!startTime) return 0
  return differenceInMinutes(new Date(), new Date(startTime))
}

/**
 * Get status display info
 * Supports both new 7-status workflow and legacy 3-status
 */
export function getStatusInfo(status) {
  const statusMap = {
    // New 7-status workflow
    new: { label: 'New', color: 'bg-slate-500', textColor: 'text-slate-700', icon: 'Circle' },
    in_progress: { label: 'In Progress', color: 'bg-amber-500', textColor: 'text-amber-700', icon: 'PlayCircle' },
    internal_review: { label: 'Internal Review', color: 'bg-purple-500', textColor: 'text-purple-700', icon: 'Eye' },
    client_review: { label: 'Client Review', color: 'bg-blue-500', textColor: 'text-blue-700', icon: 'UserCheck' },
    approved: { label: 'Approved', color: 'bg-emerald-500', textColor: 'text-emerald-700', icon: 'ThumbsUp' },
    ready_for_billing: { label: 'Ready for Billing', color: 'bg-orange-500', textColor: 'text-orange-700', icon: 'Receipt' },
    closed: { label: 'Closed', color: 'bg-green-500', textColor: 'text-green-700', icon: 'CheckCircle2' },
    
    // Legacy status mappings (for backwards compatibility)
    todo: { label: 'New', color: 'bg-slate-500', textColor: 'text-slate-700', icon: 'Circle' },
    inprogress: { label: 'In Progress', color: 'bg-amber-500', textColor: 'text-amber-700', icon: 'Clock' },
    done: { label: 'Closed', color: 'bg-green-500', textColor: 'text-green-700', icon: 'CheckCircle' },
    
    // CSS class-based colors for legacy UI
    'status-todo': { label: 'New', color: 'status-todo', icon: 'Circle' },
    'status-inprogress': { label: 'In Progress', color: 'status-inprogress', icon: 'Clock' },
    'status-done': { label: 'Closed', color: 'status-done', icon: 'CheckCircle' },
  }
  return statusMap[status] || statusMap.new
}

/**
 * Get ticket type display info
 */
export function getTicketTypeInfo(type) {
  const typeMap = {
    task: { label: 'Task', color: 'bg-blue-500', icon: 'ClipboardList' },
    client_homework: { label: 'Client Homework', color: 'bg-orange-500', icon: 'UserCheck' },
  }
  return typeMap[type] || typeMap.task
}

/**
 * Get resolution display info
 */
export function getResolutionInfo(resolution) {
  const resolutionMap = {
    unresolved: { label: 'Unresolved', color: 'bg-amber-500', textColor: 'text-amber-700' },
    resolved: { label: 'Resolved', color: 'bg-green-500', textColor: 'text-green-700' },
  }
  return resolutionMap[resolution] || resolutionMap.unresolved
}

/**
 * Calculate hours progress (estimated vs actual)
 */
export function getHoursProgress(estimatedHours, actualMinutes) {
  if (!estimatedHours || estimatedHours <= 0) return { percentage: 0, status: 'unknown' }
  
  const actualHours = (actualMinutes || 0) / 60
  const percentage = Math.round((actualHours / estimatedHours) * 100)
  
  let status = 'on_track'
  if (percentage >= 100) status = 'over'
  else if (percentage >= 80) status = 'warning'
  
  return { 
    percentage, 
    status,
    actualHours: Math.round(actualHours * 10) / 10,
    estimatedHours,
    remaining: Math.max(0, estimatedHours - actualHours),
    overBy: Math.max(0, actualHours - estimatedHours)
  }
}

/**
 * Get priority display info
 */
export function getPriorityInfo(priority) {
  const priorityMap = {
    low: { label: 'Low', color: 'priority-low', weight: 1 },
    medium: { label: 'Medium', color: 'priority-medium', weight: 2 },
    high: { label: 'High', color: 'priority-high', weight: 3 },
    urgent: { label: 'Urgent', color: 'priority-urgent', weight: 4 },
  }
  return priorityMap[priority] || priorityMap.medium
}

/**
 * Generate initials from name
 */
export function getInitials(name) {
  if (!name) return '?'
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text, length = 50) {
  if (!text) return ''
  if (text.length <= length) return text
  return text.slice(0, length).trim() + '...'
}

/**
 * Format file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * Get file icon based on type
 */
export function getFileIcon(mimeType) {
  if (!mimeType) return 'File'
  if (mimeType.startsWith('image/')) return 'Image'
  if (mimeType.startsWith('video/')) return 'Video'
  if (mimeType.startsWith('audio/')) return 'Music'
  if (mimeType.includes('pdf')) return 'FileText'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Table'
  if (mimeType.includes('document') || mimeType.includes('word')) return 'FileText'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive'
  return 'File'
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(used, total) {
  if (!total || total <= 0) return 0
  const percentage = (used / total) * 100
  return Math.min(100, Math.max(0, Math.round(percentage * 10) / 10))
}

/**
 * Get progress color based on percentage
 */
export function getProgressColor(percentage) {
  if (percentage >= 90) return 'bg-destructive'
  if (percentage >= 75) return 'bg-priority-high'
  if (percentage >= 50) return 'bg-priority-medium'
  return 'bg-priority-low'
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Generate a random color for clients
 */
export function generateRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#6C5CE7', '#FFD93D',
    '#A8E6CF', '#FF8B94', '#DDA0DD', '#98D8C8',
    '#F7DC6F', '#BB8FCE', '#85C1E9', '#F8B500',
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

/**
 * Slugify text
 */
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** Match http/https URLs (bare URLs in text) for linkification. Only allows http(s) for safety. */
const BARE_URL_REGEX = /https?:\/\/[^\s<>"']+/g

/**
 * Split text into segments of plain text and link objects. Use to render URLs as clickable links.
 * @returns Array<{ type: 'text' | 'link', value: string, href?: string }>
 */
export function linkifySegments(text) {
  if (!text || typeof text !== 'string') return [{ type: 'text', value: text || '' }]
  const segments = []
  let lastIndex = 0
  let match
  BARE_URL_REGEX.lastIndex = 0
  while ((match = BARE_URL_REGEX.exec(text)) !== null) {
    const rawUrl = match[0]
    const href = rawUrl.replace(/[.,;:)!?]+$/, '') // trim trailing punctuation from href
    if (lastIndex < match.index) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'link', value: href, href })
    lastIndex = match.index + rawUrl.length
  }
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }
  return segments.length ? segments : [{ type: 'text', value: text }]
}

/**
 * Parse ticket ID (e.g., "AGENCY-123") to get parts
 */
export function parseTicketId(ticketId) {
  if (!ticketId) return { prefix: '', number: 0 }
  const parts = ticketId.split('-')
  return {
    prefix: parts[0] || '',
    number: parseInt(parts[1], 10) || 0,
  }
}

/**
 * Group tickets by status
 */
export function groupTicketsByStatus(tickets) {
  const groups = {
    todo: [],
    inprogress: [],
    done: [],
  }

  tickets?.forEach(ticket => {
    if (groups[ticket.status]) {
      groups[ticket.status].push(ticket)
    }
  })

  // Sort by position within each group
  Object.keys(groups).forEach(status => {
    groups[status].sort((a, b) => a.position - b.position)
  })

  return groups
}

/**
 * Get start and end of current month
 */
export function getCurrentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}
