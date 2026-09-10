import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIME_CHANNELS, normalizeTimeChannel, timeChannelLabel } from '../lib/timeChannels'
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
  other: '#94A3B8',
}

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

function entryDateValue(entry) {
  return String(entry.date || '').slice(0, 10)
}

function entryMinutes(entry) {
  return Number(entry.minutes || 0)
}

function formatHours(minutes) {
  const hours = (Number(minutes) || 0) / 60
  if (!hours) return '0h'
  if (Math.abs(hours - Math.round(hours)) < 0.05) return `${Math.round(hours)}h`
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

function MetricCard({ label, value, note, warn }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn('text-2xl font-bold mt-1', warn && 'text-brand-orange')}>{value}</p>
        {note && <p className="text-sm text-muted-foreground mt-1">{note}</p>}
      </CardContent>
    </Card>
  )
}

function PaceChart({ days, planned, actual, allowance }) {
  const width = 560
  const height = 180
  const padX = 12
  const padY = 16
  const maxY = Math.max(allowance || 0, ...planned, ...actual, 1)
  const maxX = Math.max(days.length - 1, 1)
  const x = (i) => padX + (i / maxX) * (width - padX * 2)
  const y = (v) => height - padY - (v / maxY) * (height - padY * 2)
  const toPath = (values) => values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ')
  const allowY = y(allowance || 0)

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44">
      {allowance > 0 && (
        <line x1={padX} y1={allowY} x2={width - padX} y2={allowY} stroke="#F7931E" strokeDasharray="5 5" strokeWidth="1.5" />
      )}
      <path d={toPath(planned)} fill="none" stroke="#94A3B8" strokeWidth="2" />
      <path d={toPath(actual)} fill="none" stroke="#F7931E" strokeWidth="2.5" />
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
        <p className="text-2xl font-bold">{formatHours(total)}</p>
      </div>
    </div>
  )
}

export default function ClientReports({ client, timeEntries = [] }) {
  const [view, setView] = useState('month')
  const [period, setPeriod] = useState('')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState('all')
  const [billingRate, setBillingRate] = useState(null)
  const [rateChecked, setRateChecked] = useState(false)

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

  const filteredEntries = useMemo(() => {
    return timeEntries.filter((entry) => {
      if (serviceFilter !== 'all' && normalizeTimeChannel(entry.channel) !== serviceFilter) return false
      if (memberFilter !== 'all' && entry.user_id !== memberFilter) return false
      return true
    })
  }, [timeEntries, serviceFilter, memberFilter])

  const selectedMonth = period || monthKeyFromDate(today)
  const selectedYear = Number(selectedMonth.slice(0, 4))
  const selectedMonthIndex = Number(selectedMonth.slice(5, 7)) - 1
  const monthStart = new Date(selectedYear, selectedMonthIndex, 1)
  const monthEnd = new Date(selectedYear, selectedMonthIndex, daysInMonth(selectedYear, selectedMonthIndex))
  const isCurrentMonth = monthKeyFromDate(today) === selectedMonth
  const reportingDate = view === 'term'
    ? (isCurrentMonth ? today : monthEnd)
    : (isCurrentMonth ? today : monthEnd)
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

  const monthCountThroughReporting = useMemo(() => {
    if (!contractStart) return 0
    return monthsBetween(contractStart, clippedReportingDate).length
  }, [client?.project_start_date, clippedReportingDate])

  const rolloverHours = useMemo(() => {
    if (!hasAllowance || !contractStart) return null
    const priorMonths = monthsBetween(contractStart, new Date(selectedYear, selectedMonthIndex, 0))
    let carry = 0
    for (const key of priorMonths) {
      const start = `${key}-01`
      const endDate = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)
      const end = toISODate(endDate)
      const minutes = filteredEntries
        .filter((entry) => {
          const date = entryDateValue(entry)
          return date >= start && date <= end
        })
        .reduce((sum, entry) => sum + entryMinutes(entry), 0)
      carry += Math.max(0, monthlyHours - minutes / 60)
    }
    return carry
  }, [filteredEntries, hasAllowance, monthlyHours, client?.project_start_date, selectedMonth])

  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth(selectedYear, selectedMonthIndex)
  const dayCount = daysInMonth(selectedYear, selectedMonthIndex)
  const monthUsedMinutes = monthEntries.reduce((sum, entry) => sum + entryMinutes(entry), 0)
  const plannedHours = hasAllowance ? monthlyHours * (daysElapsed / dayCount) : null
  const forecastHours = hasAllowance && daysElapsed > 0
    ? (monthUsedMinutes / 60) * (dayCount / daysElapsed)
    : null
  const remainingMonth = hasAllowance ? monthlyHours - monthUsedMinutes / 60 : null
  const overForecast = forecastHours != null && hasAllowance ? forecastHours - monthlyHours : null
  const elapsedPct = Math.round((daysElapsed / dayCount) * 100)
  const usedPct = hasAllowance ? Math.round((monthUsedMinutes / 60 / monthlyHours) * 100) : null
  const overPace = hasAllowance && usedPct != null && usedPct > elapsedPct + 5
  const underPace = hasAllowance && usedPct != null && usedPct < elapsedPct - 8

  const cumulativeAvailable = hasAllowance && monthCountThroughReporting
    ? monthlyHours * monthCountThroughReporting
    : null
  const remainingTerm = cumulativeAvailable != null ? cumulativeAvailable - usedHours : null

  const paceDays = Array.from({ length: daysElapsed }, (_, i) => i + 1)
  const plannedSeries = paceDays.map((day) => (hasAllowance ? (monthlyHours * day) / dayCount : 0))
  const actualSeries = paceDays.map((day) => {
    const iso = `${selectedMonth}-${pad(day)}`
    const minutes = monthEntries
      .filter((entry) => entryDateValue(entry) <= iso)
      .reduce((sum, entry) => sum + entryMinutes(entry), 0)
    return minutes / 60
  })

  const workRows = useMemo(() => {
    const groups = new Map()
    for (const entry of viewEntries) {
      const ticketId = entry.ticket_id || 'none'
      const memberId = entry.user_id || 'unknown'
      const service = normalizeTimeChannel(entry.channel)
      const key = `${ticketId}|${memberId}|${service}`
      const current = groups.get(key) || {
        task: entry.ticket?.title || entry.description || 'Time entry',
        ticketKey: entry.ticket?.ticket_id || '',
        service,
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
    return TIME_CHANNELS.map((channel) => {
      const minutes = viewEntries
        .filter((entry) => normalizeTimeChannel(entry.channel) === channel.id)
        .reduce((sum, entry) => sum + entryMinutes(entry), 0)
      return {
        id: channel.id,
        label: channel.label,
        minutes,
        color: SERVICE_COLORS[channel.id] || '#94A3B8',
      }
    }).filter((slice) => slice.minutes > 0)
  }, [viewEntries])

  const resetFilters = () => {
    setServiceFilter('all')
    setMemberFilter('all')
    setPeriod(periodOptions[0] || '')
    setView('month')
  }

  const exportCsv = () => {
    const lines = [
      ['Task / Work Item', 'Service', 'Team Member', 'Hours', '% of Total', 'Work Value'],
      ...workRows.map((row) => [
        row.task,
        timeChannelLabel(row.service),
        row.member,
        formatHours(row.minutes),
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
  const coverage = monthlyRetainer != null && trackedValue != null ? monthlyRetainer - trackedValue : null
  const effectiveRate = usedHours > 0 && monthlyRetainer != null ? monthlyRetainer / usedHours : null

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
              {TIME_CHANNELS.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>{channel.label}</SelectItem>
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
            <MetricCard
              label="Hours used"
              value={view === 'month' && hasAllowance
                ? `${formatHours(monthUsedMinutes).replace('h', '')} / ${formatHours(monthlyHours * 60)}`
                : formatHours(usedMinutes)}
              note={view === 'month'
                ? (hasAllowance ? `${usedPct}% of monthly allowance` : 'Monthly allowance unavailable')
                : (cumulativeAvailable != null ? `${Math.round((usedHours / cumulativeAvailable) * 100)}% of hours made available` : 'Contract information needed')}
            />
            <MetricCard
              label="Hours remaining"
              value={view === 'month'
                ? (remainingMonth == null ? <Unavailable /> : formatHours(remainingMonth * 60))
                : (remainingTerm == null ? <Unavailable label="Contract information needed" /> : formatHours(remainingTerm * 60))}
              note={view === 'month'
                ? 'Against this month’s allowance. No rollover.'
                : (rolloverHours == null
                    ? 'Includes unused hours carried forward'
                    : `Includes ${formatHours(rolloverHours * 60)} carried forward`)}
            />
            <MetricCard
              label="Forecast"
              value={forecastHours == null ? <Unavailable /> : formatHours(forecastHours * 60)}
              note={overForecast == null
                ? 'Needs monthly hours'
                : (overForecast > 0.05 ? `${formatHours(overForecast * 60)} over this month` : 'Within this month’s allowance')}
              warn={overForecast > 0.05}
            />
            <MetricCard
              label="Retainer status"
              value={!hasAllowance ? <Unavailable /> : overPace ? 'Over pace' : underPace ? 'Under pace' : 'On pace'}
              note={`${elapsedPct}% of month elapsed`}
              warn={overPace}
            />
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
                <div className="flex justify-between"><span>Monthly retainer</span><span className="font-semibold">{rateChecked && monthlyRetainer != null ? money(monthlyRetainer) : <Unavailable />}</span></div>
                <div className="flex justify-between"><span>Billing rate</span><span className="font-semibold">{rateChecked && billingRate != null ? `$${billingRate}/h` : <Unavailable />}</span></div>
                <div className="flex justify-between"><span>Tracked work value</span><span className="font-semibold">{trackedValue != null ? money(trackedValue) : <Unavailable />}</span></div>
                <div className="flex justify-between"><span>Revenue coverage</span><span className={cn('font-semibold', coverage > 0 && 'text-emerald-600', coverage < 0 && 'text-brand-orange')}>{coverage == null ? <Unavailable /> : `${coverage >= 0 ? '+' : ''}${money(coverage)}`}</span></div>
                <div className="flex justify-between"><span>Effective rate</span><span className="font-semibold">{effectiveRate == null ? <Unavailable /> : `$${Math.round(effectiveRate)}/h`}</span></div>
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
                        {workRows.slice(0, 8).map((row, index) => (
                          <tr key={`${row.task}-${row.member}-${index}`}>
                            <td className="px-4 py-2 font-medium">{row.task}</td>
                            <td className="px-4 py-2">{timeChannelLabel(row.service)}</td>
                            <td className="px-4 py-2">{row.member}</td>
                            <td className="px-4 py-2 text-right">{formatHours(row.minutes)}</td>
                            <td className="px-4 py-2 text-right">{row.pct}%</td>
                            <td className="px-4 py-2 text-right">{row.value == null ? <Unavailable /> : money(row.value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Retainer Pace</CardTitle>
                    <CardDescription>Actual usage compared with planned usage</CardDescription>
                  </div>
                  {overForecast > 0.05 && (
                    <Badge variant="outline" className="text-brand-orange border-brand-orange/40">
                      {formatHours(overForecast * 60)} over forecast
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {hasAllowance ? (
                  <>
                    <PaceChart days={paceDays} planned={plannedSeries} actual={actualSeries} allowance={monthlyHours} />
                    <div className="flex flex-wrap gap-4 text-sm mt-2">
                      <span className="text-muted-foreground">Planned pace · {formatHours((plannedHours || 0) * 60)}</span>
                      <span className="text-brand-orange font-medium">Actual · {formatHours(monthUsedMinutes)}</span>
                      <span>Forecast · {forecastHours == null ? 'Data unavailable' : formatHours(forecastHours * 60)}</span>
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
                      <span className="font-medium">{formatHours(slice.minutes)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
