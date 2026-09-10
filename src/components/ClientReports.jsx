import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIME_CHANNEL_IDS, normalizeTimeChannel, timeChannelLabel } from '../lib/timeChannels'
import { fetchClientRate } from '../lib/clientRates'
import { cn } from '../lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'

const SERVICE_COLORS = {
  ppc: '#F7931E',
  seo: '#3B82F6',
  social: '#EC4899',
  email: '#14B8A6',
  web: '#22C55E',
  creative: '#A855F7',
  account: '#6366F1',
  other: '#64748B',
  unassigned: '#94A3B8',
}

const UNASSIGNED = { id: 'unassigned', label: 'Unassigned Service', color: SERVICE_COLORS.unassigned }

function pad(n) {
  return String(n).padStart(2, '0')
}

function toISODate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseISO(iso) {
  if (!iso) return null
  const [year, month, day] = String(iso).slice(0, 10).split('-').map(Number)
  if (!year || !month) return null
  return new Date(year, month - 1, day || 1)
}

function monthKeyFromDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`
}

function monthLabel(key) {
  const date = parseISO(`${key}-01`)
  if (!date) return key
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function monthsBetween(start, end) {
  const keys = []
  if (!start || !end || start > end) return keys
  let year = start.getFullYear()
  let month = start.getMonth()
  const endYear = end.getFullYear()
  const endMonth = end.getMonth()
  while (year < endYear || (year === endYear && month <= endMonth)) {
    keys.push(`${year}-${pad(month + 1)}`)
    month += 1
    if (month > 11) {
      month = 0
      year += 1
    }
  }
  return keys
}

function isBusinessDay(date) {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

function businessDaysInRange(start, end) {
  if (!start || !end || start > end) return 0
  let count = 0
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const last = new Date(end)
  last.setHours(0, 0, 0, 0)
  while (cursor <= last) {
    if (isBusinessDay(cursor)) count += 1
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

function entryDateValue(entry) {
  return String(entry.date || '').slice(0, 10)
}

function entryMinutes(entry) {
  return Number(entry.minutes || 0)
}

function formatHours(hoursOrMinutes, { fromMinutes = false } = {}) {
  const hours = fromMinutes ? (Number(hoursOrMinutes) || 0) / 60 : Number(hoursOrMinutes) || 0
  const abs = Math.abs(hours)
  if (!abs) return '0h'
  if (Math.abs(abs - Math.round(abs)) < 0.05) return `${Math.round(hours)}h`
  return `${hours.toFixed(1).replace(/\.0$/, '')}h`
}

function money(value) {
  if (value == null || Number.isNaN(value)) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function Unavailable({ label = 'Data unavailable' }) {
  return <span className="text-muted-foreground font-medium">{label}</span>
}

function taskService(ticket) {
  const raw = ticket?.category || ticket?.service || ticket?.channel || ticket?.account_service
  if (!raw || !String(raw).trim()) return UNASSIGNED
  const value = String(raw).trim()
  const id = normalizeTimeChannel(value)
  if (TIME_CHANNEL_IDS.includes(String(value).toLowerCase()) || id !== 'other' || String(value).toLowerCase() === 'other') {
    if (TIME_CHANNEL_IDS.includes(id)) {
      return { id, label: timeChannelLabel(id), color: SERVICE_COLORS[id] || SERVICE_COLORS.other }
    }
  }
  return {
    id: `custom-${value.toLowerCase()}`,
    label: value,
    color: SERVICE_COLORS[id] || SERVICE_COLORS.other,
  }
}

function MetricCard({ label, value, note, warn }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold mt-1 leading-tight', warn && 'text-brand-orange')}>{value}</p>
        {note && <p className="text-sm text-muted-foreground mt-1">{note}</p>}
      </CardContent>
    </Card>
  )
}

function PaceChart({ points, planned, actual, forecast, allowance, available }) {
  const width = 560
  const height = 188
  const padX = 16
  const padY = 22
  const maxY = Math.max(allowance || 0, available || 0, ...planned, ...actual, ...forecast, 1)
  const maxX = Math.max(points.length - 1, 1)
  const x = (i) => padX + (i / maxX) * (width - padX * 2)
  const y = (v) => height - padY - (v / maxY) * (height - padY * 2)
  const toPath = (values) => values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const allowY = y(allowance || available || 0)
  const lastActual = actual.findLastIndex ? actual.findLastIndex((v) => v != null) : actual.length - 1

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48">
      {(allowance > 0 || available > 0) && (
        <>
          <line x1={padX} y1={allowY} x2={width - padX} y2={allowY} stroke="#F7931E" strokeDasharray="5 5" strokeWidth="1.5" />
          <text x={width - padX} y={allowY - 6} textAnchor="end" fontSize="11" fill="#F7931E">
            {formatHours(allowance || available)} {allowance ? 'allowance' : 'available'}
          </text>
        </>
      )}
      <path d={toPath(planned)} fill="none" stroke="#94A3B8" strokeWidth="2" />
      <path d={toPath(actual)} fill="none" stroke="#F7931E" strokeWidth="2.5" />
      {forecast?.length > 1 && (
        <path d={toPath(forecast)} fill="none" stroke="#64748B" strokeWidth="2" strokeDasharray="6 5" />
      )}
      {lastActual >= 0 && (
        <circle cx={x(Math.max(lastActual, 0))} cy={y(actual[Math.max(lastActual, 0)] || 0)} r="3.5" fill="#F7931E" />
      )}
    </svg>
  )
}

function ServiceDonut({ slices, totalMinutes }) {
  const size = 180
  const stroke = 22
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  let offset = 0
  const total = totalMinutes || slices.reduce((sum, slice) => sum + slice.minutes, 0)
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E7EB" strokeWidth={stroke} />
        {slices.filter((slice) => slice.minutes > 0).map((slice) => {
          const len = total > 0 ? (slice.minutes / total) * circ : 0
          const dash = `${len} ${circ - len}`
          const el = (
            <circle
              key={slice.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold">{formatHours(total, { fromMinutes: true })}</p>
      </div>
    </div>
  )
}

export default function ClientReports({ client, timeEntries = [], tickets = [] }) {
  const [view, setView] = useState('month')
  const [period, setPeriod] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [billingRate, setBillingRate] = useState(null)
  const [rateChecked, setRateChecked] = useState(false)
  const [ticketMap, setTicketMap] = useState({})
  const [showAllWork, setShowAllWork] = useState(false)

  const monthlyHours = Number(client?.monthly_hours)
  const hasAllowance = Number.isFinite(monthlyHours) && monthlyHours > 0
  const contractStart = parseISO(client?.project_start_date)
  const contractEnd = parseISO(client?.project_end_date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!client?.id) {
        setRateChecked(true)
        return
      }
      const { value } = await fetchClientRate(supabase, client.id)
      if (cancelled) return
      setBillingRate(value)
      setRateChecked(true)
    })()
    return () => { cancelled = true }
  }, [client?.id])

  useEffect(() => {
    const fromProp = {}
    for (const ticket of tickets) {
      if (ticket?.id) fromProp[ticket.id] = ticket
    }
    const needed = [...new Set(timeEntries.map((entry) => entry.ticket_id).filter(Boolean))]
    const missing = needed.filter((id) => !fromProp[id] || (fromProp[id].category == null && fromProp[id].service == null && fromProp[id].channel == null))
    if (!missing.length) {
      setTicketMap(fromProp)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('tickets')
        .select('id, ticket_id, title, category, ticket_type')
        .in('id', missing)
      if (cancelled) return
      const next = { ...fromProp }
      for (const ticket of data || []) next[ticket.id] = { ...next[ticket.id], ...ticket }
      setTicketMap(next)
    })()
    return () => { cancelled = true }
  }, [tickets, timeEntries])

  const periodOptions = useMemo(() => {
    const endCap = contractEnd && contractEnd < today ? contractEnd : today
    const startCap = contractStart || (() => {
      const dates = timeEntries.map(entryDateValue).filter(Boolean).sort()
      return dates[0] ? parseISO(dates[0]) : new Date(today.getFullYear(), today.getMonth() - 11, 1)
    })()
    return monthsBetween(startCap, endCap).reverse()
  }, [client?.project_start_date, client?.project_end_date, timeEntries])

  useEffect(() => {
    if (!period && periodOptions.length) setPeriod(periodOptions[0])
  }, [period, periodOptions])

  const teamMembers = useMemo(() => {
    const seen = new Map()
    for (const entry of timeEntries) {
      const person = entry.user || entry.profiles
      if (!entry.user_id || seen.has(entry.user_id)) continue
      seen.set(entry.user_id, person?.full_name || 'Team Member')
    }
    return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [timeEntries])

  const annotatedEntries = useMemo(() => {
    return timeEntries.map((entry) => {
      const ticket = ticketMap[entry.ticket_id] || entry.ticket || null
      const service = taskService(ticket)
      return { ...entry, ticket, service }
    })
  }, [timeEntries, ticketMap])

  const filteredEntries = useMemo(() => {
    return annotatedEntries.filter((entry) => {
      if (serviceFilter !== 'all' && entry.service.id !== serviceFilter) return false
      if (memberFilter !== 'all' && entry.user_id !== memberFilter) return false
      return true
    })
  }, [annotatedEntries, serviceFilter, memberFilter])

  const selectedMonth = period || monthKeyFromDate(today)
  const selectedYear = Number(selectedMonth.slice(0, 4))
  const selectedMonthIndex = Number(selectedMonth.slice(5, 7)) - 1
  const monthStart = new Date(selectedYear, selectedMonthIndex, 1)
  const monthEnd = new Date(selectedYear, selectedMonthIndex, daysInMonth(selectedYear, selectedMonthIndex))
  const isCurrentMonth = monthKeyFromDate(today) === selectedMonth
  const reportingDate = isCurrentMonth ? today : monthEnd
  const clippedReportingDate = contractEnd && reportingDate > contractEnd ? contractEnd : reportingDate

  const monthEntries = useMemo(() => {
    const start = toISODate(monthStart)
    const end = toISODate(monthEnd)
    return filteredEntries.filter((entry) => {
      const date = entryDateValue(entry)
      return date >= start && date <= end
    })
  }, [filteredEntries, selectedMonth])

  const termEntries = useMemo(() => {
    if (!contractStart) return []
    const start = toISODate(contractStart)
    const end = toISODate(clippedReportingDate)
    return filteredEntries.filter((entry) => {
      const date = entryDateValue(entry)
      return date >= start && date <= end
    })
  }, [filteredEntries, client?.project_start_date, clippedReportingDate])

  const viewEntries = view === 'term' ? termEntries : monthEntries
  const usedMinutes = viewEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const usedHours = usedMinutes / 60
  const monthUsedMinutes = monthEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const monthUsedHours = monthUsedMinutes / 60

  const monthCountThroughReporting = useMemo(() => {
    if (!contractStart) return 0
    return monthsBetween(contractStart, clippedReportingDate).length
  }, [client?.project_start_date, clippedReportingDate])

  const fullContractMonths = useMemo(() => {
    if (!contractStart || !contractEnd) return null
    return monthsBetween(contractStart, contractEnd).length
  }, [client?.project_start_date, client?.project_end_date])

  const elapsedBiz = businessDaysInRange(monthStart, isCurrentMonth ? today : monthEnd)
  const totalBiz = businessDaysInRange(monthStart, monthEnd)
  const plannedHours = hasAllowance && totalBiz > 0 ? monthlyHours * (elapsedBiz / totalBiz) : null
  const forecastHours = hasAllowance && elapsedBiz > 0
    ? monthUsedHours * (totalBiz / elapsedBiz)
    : monthUsedHours
  const remainingMonth = hasAllowance ? monthlyHours - monthUsedHours : null
  const usedPct = hasAllowance ? Math.round((monthUsedHours / monthlyHours) * 100) : null
  const elapsedPct = totalBiz > 0 ? Math.round((elapsedBiz / totalBiz) * 100) : 0

  let monthlyStatus = null
  if (hasAllowance) {
    if (monthUsedHours > monthlyHours + 0.05) monthlyStatus = 'Over monthly hours'
    else if (forecastHours > monthlyHours + 0.05) monthlyStatus = 'At risk of over-servicing'
    else if (plannedHours != null && monthUsedHours < plannedHours - 1) monthlyStatus = 'Under pace'
    else monthlyStatus = 'On pace'
  }
  const statusWarn = monthlyStatus === 'Over monthly hours' || monthlyStatus === 'At risk of over-servicing'

  const cumulativeAvailable = hasAllowance && monthCountThroughReporting
    ? monthlyHours * monthCountThroughReporting
    : null
  const cumulativeBalance = cumulativeAvailable != null ? cumulativeAvailable - usedHours : null
  const fullAllowance = hasAllowance && fullContractMonths ? monthlyHours * fullContractMonths : null

  const termElapsedDays = contractStart
    ? Math.max(1, Math.round((clippedReportingDate - contractStart) / 86400000) + 1)
    : 0
  const termTotalDays = contractStart && contractEnd
    ? Math.max(1, Math.round((contractEnd - contractStart) / 86400000) + 1)
    : null
  const contractForecastHours = contractStart && termElapsedDays > 0
    ? usedHours * ((termTotalDays || termElapsedDays) / termElapsedDays)
    : null
  const contractOverUnder = fullAllowance != null && contractForecastHours != null
    ? contractForecastHours - fullAllowance
    : null

  const paceDays = Array.from({ length: Math.max(daysInMonth(selectedYear, selectedMonthIndex), 1) }, (_, i) => i + 1)
  const lastElapsedDay = isCurrentMonth ? today.getDate() : daysInMonth(selectedYear, selectedMonthIndex)
  const plannedSeries = paceDays.map((day) => {
    if (!hasAllowance || totalBiz <= 0) return 0
    const through = new Date(selectedYear, selectedMonthIndex, day)
    const biz = businessDaysInRange(monthStart, through)
    return monthlyHours * (biz / totalBiz)
  })
  const actualSeries = paceDays.map((day) => {
    const clamped = Math.min(day, lastElapsedDay)
    const iso = `${selectedMonth}-${pad(clamped)}`
    const minutes = monthEntries
      .filter((entry) => entryDateValue(entry) <= iso)
      .reduce((sum, entry) => sum + entryMinutes(entry), 0)
    return minutes / 60
  })
  const monthForecastSeries = paceDays.map((day) => {
    if (day <= lastElapsedDay) return actualSeries[day - 1]
    if (!elapsedBiz) return monthUsedHours
    const through = new Date(selectedYear, selectedMonthIndex, day)
    const biz = Math.max(businessDaysInRange(monthStart, through), elapsedBiz)
    return monthUsedHours * (biz / elapsedBiz)
  })

  const termKeys = contractStart
    ? monthsBetween(contractStart, contractEnd || clippedReportingDate)
    : []
  const termPlanned = termKeys.map((_, index) => (hasAllowance ? monthlyHours * (index + 1) : 0))
  const termActual = termKeys.map((key) => {
    if (key > monthKeyFromDate(clippedReportingDate)) return null
    const endDate = key === monthKeyFromDate(clippedReportingDate)
      ? toISODate(clippedReportingDate)
      : toISODate(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0))
    const minutes = termEntries
      .filter((entry) => entryDateValue(entry) <= endDate)
      .reduce((sum, entry) => sum + entryMinutes(entry), 0)
    return minutes / 60
  })
  const lastTermIndex = termActual.reduce((last, value, index) => (value == null ? last : index), 0)
  const lastTermHours = termActual[lastTermIndex] || 0
  const termForecastSeries = termKeys.map((_, index) => {
    if (index <= lastTermIndex) return lastTermHours
    if (!monthCountThroughReporting) return lastTermHours
    return lastTermHours * ((index + 1) / monthCountThroughReporting)
  })

  const workRows = useMemo(() => {
    const groups = new Map()
    for (const entry of viewEntries) {
      const ticketId = entry.ticket_id || 'none'
      const memberId = entry.user_id || 'unknown'
      const serviceId = entry.service.id
      const key = `${ticketId}|${memberId}|${serviceId}`
      const current = groups.get(key) || {
        task: entry.ticket?.title || entry.description || 'Time entry',
        ticketKey: entry.ticket?.ticket_id || '',
        service: entry.service,
        member: (entry.user || entry.profiles)?.full_name || 'Team Member',
        minutes: 0,
      }
      current.minutes += entryMinutes(entry)
      groups.set(key, current)
    }
    const rows = [...groups.values()].sort((a, b) => b.minutes - a.minutes)
    const total = rows.reduce((sum, row) => sum + row.minutes, 0)
    return rows.map((row) => ({
      ...row,
      pct: total > 0 ? Math.round((row.minutes / total) * 100) : 0,
      value: billingRate != null ? (row.minutes / 60) * billingRate : null,
    }))
  }, [viewEntries, billingRate])

  const serviceSlices = useMemo(() => {
    const groups = new Map()
    for (const entry of viewEntries) {
      const service = entry.service || UNASSIGNED
      const current = groups.get(service.id) || { ...service, minutes: 0 }
      current.minutes += entryMinutes(entry)
      groups.set(service.id, current)
    }
    return [...groups.values()].filter((slice) => slice.minutes > 0).sort((a, b) => b.minutes - a.minutes)
  }, [viewEntries])

  const serviceOptions = useMemo(() => {
    const seen = new Map()
    for (const entry of annotatedEntries) {
      if (!seen.has(entry.service.id)) seen.set(entry.service.id, entry.service.label)
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [annotatedEntries])

  const resetFilters = () => {
    setServiceFilter('all')
    setMemberFilter('all')
    setPeriod(periodOptions[0] || '')
    setView('month')
    setShowAllWork(false)
  }

  const exportCsv = () => {
    const lines = [
      ['Task / Work Item', 'Service', 'Team Member', 'Hours', '% of Total', 'Work Value'],
      ...workRows.map((row) => [
        row.task,
        row.service.label,
        row.member,
        formatHours(row.minutes, { fromMinutes: true }),
        `${row.pct}%`,
        row.value == null ? 'Data unavailable' : money(row.value),
      ]),
    ]
    const csv = lines.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${client?.slug || 'client'}-report-${selectedMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const termBlocked = view === 'term' && !contractStart
  const trackedValue = billingRate != null ? usedHours * billingRate : null
  const retainerRevenue = Number(client?.monthly_retainer_revenue)
  const monthlyRetainer = Number.isFinite(retainerRevenue) && retainerRevenue > 0 ? retainerRevenue : null
  const accruedRevenue = monthlyRetainer != null && monthCountThroughReporting
    ? monthlyRetainer * (view === 'term' ? monthCountThroughReporting : 1)
    : null
  const coverage = accruedRevenue != null && trackedValue != null ? accruedRevenue - trackedValue : null
  const effectiveRate = usedHours > 0 && accruedRevenue != null ? accruedRevenue / usedHours : null
  const coverageNote = coverage == null
    ? null
    : coverage < 0
      ? 'Over-servicing'
      : remainingMonth > 0.05 || (view === 'term' && cumulativeBalance > 0.05)
        ? 'Unused client capacity'
        : 'Coverage'

  const paceStatus = view === 'month'
    ? (plannedHours == null
        ? 'Needs monthly hours'
        : monthUsedHours - plannedHours > 0.05
          ? `${formatHours(monthUsedHours - plannedHours)} over the expected monthly pace`
          : plannedHours - monthUsedHours > 0.05
            ? `${formatHours(plannedHours - monthUsedHours)} under the expected monthly pace`
            : 'On the expected monthly pace')
    : (cumulativeBalance == null
        ? 'Contract information needed'
        : contractOverUnder != null && contractOverUnder > 0.05
          ? `Projected to exceed the contract by ${formatHours(contractOverUnder)}`
          : cumulativeBalance > 0.05
            ? `${formatHours(cumulativeBalance)} rollover hours currently available`
            : cumulativeBalance < -0.05
              ? `${formatHours(Math.abs(cumulativeBalance))} cumulative over-servicing`
              : 'On the contracted hours available')

  const visibleWork = showAllWork ? workRows : workRows.slice(0, 4)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Monitor monthly delivery and cumulative contract health.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={workRows.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-[200px]">
          <p className="text-[11px] uppercase text-muted-foreground mb-1">Reporting Period</p>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger>
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((key) => (
                <SelectItem key={key} value={key}>{monthLabel(key)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[180px]">
          <p className="text-[11px] uppercase text-muted-foreground mb-1">Service</p>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {serviceOptions.map((service) => (
                <SelectItem key={service.id} value={service.id}>{service.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-[200px]">
          <p className="text-[11px] uppercase text-muted-foreground mb-1">Team Member</p>
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All team members</SelectItem>
              {teamMembers.map((member) => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={resetFilters}>Reset</Button>
      </div>

      <div className="inline-flex rounded-lg border p-1 bg-muted/40">
        <button
          type="button"
          onClick={() => setView('month')}
          className={cn('px-3 py-1.5 text-sm font-medium rounded-md', view === 'month' ? 'bg-white shadow-sm' : 'text-muted-foreground')}
        >
          This Month
        </button>
        <button
          type="button"
          onClick={() => setView('term')}
          className={cn('px-3 py-1.5 text-sm font-medium rounded-md', view === 'term' ? 'bg-white shadow-sm' : 'text-muted-foreground')}
        >
          Contract Term
        </button>
      </div>

      {termBlocked ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-5">
            <p className="font-semibold">Contract information needed</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add a contract start date to calculate cumulative hours, rollover, and term remaining.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {view === 'month' ? (
              <>
                <MetricCard
                  label="Hours Used"
                  value={hasAllowance
                    ? `${formatHours(monthUsedHours).replace('h', '')} / ${formatHours(monthlyHours)}`
                    : formatHours(monthUsedHours)}
                  note={hasAllowance ? `${usedPct}% of monthly allowance` : 'Monthly allowance unavailable'}
                />
                <MetricCard
                  label="Monthly Hours Remaining"
                  value={remainingMonth == null
                    ? <Unavailable />
                    : remainingMonth < -0.05
                      ? `${formatHours(Math.abs(remainingMonth))} over`
                      : formatHours(remainingMonth)}
                  note="Against this month’s allowance. No rollover."
                  warn={remainingMonth < -0.05}
                />
                <MetricCard
                  label="Forecasted Month-End Hours"
                  value={formatHours(forecastHours)}
                  note={hasAllowance && forecastHours - monthlyHours > 0.05
                    ? `Forecast · ${formatHours(forecastHours - monthlyHours)} over this month`
                    : 'Forecast based on elapsed business days'}
                  warn={hasAllowance && forecastHours - monthlyHours > 0.05}
                />
                <MetricCard
                  label="Monthly Status"
                  value={!hasAllowance ? <Unavailable /> : monthlyStatus}
                  note={`${elapsedPct}% of month elapsed`}
                  warn={statusWarn}
                />
              </>
            ) : (
              <>
                <MetricCard
                  label="Cumulative Hours Used"
                  value={formatHours(usedHours)}
                  note={contractStart ? `Since ${monthLabel(monthKeyFromDate(contractStart))}` : 'Contract start needed'}
                />
                <MetricCard
                  label="Cumulative Hours Available"
                  value={cumulativeAvailable == null ? <Unavailable label="Contract information needed" /> : formatHours(cumulativeAvailable)}
                  note={hasAllowance ? `${formatHours(monthlyHours)} × ${monthCountThroughReporting} months elapsed` : 'Monthly hours needed'}
                />
                <MetricCard
                  label="Cumulative Balance"
                  value={cumulativeBalance == null
                    ? <Unavailable label="Contract information needed" />
                    : cumulativeBalance >= 0
                      ? formatHours(cumulativeBalance)
                      : `${formatHours(Math.abs(cumulativeBalance))} over`}
                  note={cumulativeBalance == null
                    ? 'Unused hours carried forward'
                    : cumulativeBalance >= 0
                      ? 'Rollover hours currently available'
                      : 'Cumulative over-servicing'}
                  warn={cumulativeBalance < -0.05}
                />
                <MetricCard
                  label="Contract-End Forecast"
                  value={contractForecastHours == null ? <Unavailable /> : formatHours(contractForecastHours)}
                  note={contractOverUnder == null
                    ? 'Needs contract end date and monthly hours'
                    : contractOverUnder > 0.05
                      ? `Projected ${formatHours(contractOverUnder)} over the full contract`
                      : `Projected ${formatHours(Math.abs(contractOverUnder))} under the full contract`}
                  warn={contractOverUnder > 0.05}
                />
              </>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Retainer Pace</CardTitle>
                    <CardDescription>Actual usage compared with planned usage</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-brand-orange border-brand-orange/40 whitespace-normal text-right max-w-[220px]">
                    {paceStatus}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {view === 'month' && hasAllowance ? (
                  <>
                    <PaceChart
                      points={paceDays}
                      planned={plannedSeries}
                      actual={actualSeries}
                      forecast={monthForecastSeries}
                      allowance={monthlyHours}
                    />
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <span className="text-muted-foreground">Planned pace · {formatHours(plannedHours || 0)}</span>
                      <span className="text-brand-orange font-medium">Actual · {formatHours(monthUsedHours)}</span>
                      <span>Forecast · {formatHours(forecastHours)}</span>
                    </div>
                  </>
                ) : view === 'term' && hasAllowance && contractStart ? (
                  <>
                    <PaceChart
                      points={termKeys}
                      planned={termPlanned}
                      actual={termActual.map((value) => value ?? lastTermHours)}
                      forecast={termForecastSeries}
                      available={fullAllowance || cumulativeAvailable}
                    />
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <span className="text-muted-foreground">Available · {formatHours(cumulativeAvailable || 0)}</span>
                      <span className="text-brand-orange font-medium">Actual · {formatHours(usedHours)}</span>
                      <span>Forecast · {contractForecastHours == null ? 'Data unavailable' : formatHours(contractForecastHours)}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Data unavailable. Monthly included hours are missing.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Hours by Service</CardTitle>
                <CardDescription>Where the retainer is being used</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row items-center gap-6">
                <ServiceDonut slices={serviceSlices} totalMinutes={usedMinutes} />
                <div className="space-y-2 text-sm w-full">
                  {serviceSlices.length === 0 && <p className="text-muted-foreground">No tracked hours for these filters.</p>}
                  {serviceSlices.map((slice) => (
                    <div key={slice.id} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                        {slice.label}
                      </span>
                      <span className="font-medium">
                        {formatHours(slice.minutes, { fromMinutes: true })}
                        {usedMinutes > 0 ? ` · ${Math.round((slice.minutes / usedMinutes) * 100)}%` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Retainer Efficiency</CardTitle>
                    <CardDescription>Revenue coverage based on tracked hours and the client billing rate</CardDescription>
                  </div>
                  <Badge variant="outline" className="text-brand-orange border-brand-orange/40">Efficiency—not true profit</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span>{view === 'term' ? 'Contracted revenue accrued' : 'Monthly Retainer Revenue'}</span>
                  <span className="font-semibold">{rateChecked && accruedRevenue != null ? money(accruedRevenue) : <Unavailable />}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Client Billing Rate</span>
                  <span className="font-semibold">{rateChecked && billingRate != null ? `$${billingRate}/h` : <Unavailable />}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{view === 'term' ? 'Cumulative tracked work value' : 'Tracked Work Value'}</span>
                  <span className="font-semibold">{trackedValue != null ? money(trackedValue) : <Unavailable />}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>{view === 'term' ? 'Cumulative revenue coverage' : 'Revenue Coverage'}</span>
                  <span className={cn('font-semibold', coverage > 0 && 'text-emerald-600', coverage < 0 && 'text-brand-orange')}>
                    {coverage == null ? <Unavailable /> : `${coverage >= 0 ? '+' : ''}${money(coverage)}`}
                  </span>
                </div>
                {coverageNote && (
                  <p className="text-xs text-muted-foreground">{coverageNote}</p>
                )}
                <div className="flex justify-between gap-4">
                  <span>{view === 'term' ? 'Cumulative effective hourly rate' : 'Effective Hourly Rate'}</span>
                  <span className="font-semibold">{effectiveRate == null ? <Unavailable /> : `$${Math.round(effectiveRate)}/h`}</span>
                </div>
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Retainer efficiency is based on client revenue and billing rate. It does not represent true profit because internal labor costs are not included.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Work Consuming the Retainer</CardTitle>
                <CardDescription>Highest-hour work items for the selected period</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {workRows.length === 0 ? (
                  <p className="p-5 text-sm text-muted-foreground">No time entries for these filters.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b bg-muted/30 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="text-left px-4 py-2">Task / Work Item</th>
                            <th className="text-left px-4 py-2">Service</th>
                            <th className="text-left px-4 py-2">Team Member</th>
                            <th className="text-right px-4 py-2">Hours</th>
                            <th className="text-right px-4 py-2">% of Total</th>
                            <th className="text-right px-4 py-2">Work Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {visibleWork.map((row, index) => (
                            <tr key={`${row.task}-${row.member}-${index}`}>
                              <td className="px-4 py-2 font-medium">{row.task}</td>
                              <td className="px-4 py-2">{row.service.label}</td>
                              <td className="px-4 py-2">{row.member}</td>
                              <td className="px-4 py-2 text-right">{formatHours(row.minutes, { fromMinutes: true })}</td>
                              <td className="px-4 py-2 text-right">{row.pct}%</td>
                              <td className="px-4 py-2 text-right">{row.value == null ? <Unavailable /> : money(row.value)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {workRows.length > 4 && (
                      <div className="p-3 text-center">
                        <Button variant="ghost" size="sm" onClick={() => setShowAllWork((open) => !open)}>
                          {showAllWork ? 'Show less' : `Show ${workRows.length - 4} more`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

