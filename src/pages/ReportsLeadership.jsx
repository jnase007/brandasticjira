import { useMemo, useState } from 'react'
import { Download, FileText, RefreshCw } from 'lucide-react'
import { CLIENT_TYPES } from '../lib/clientTypes'
import { cn, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { AreaChart } from '../components/Charts'

const BRAND = ['#F7931E', '#FF6B4A', '#7C3AED', '#2563EB', '#0D9488', '#DB2777']

function hoursFromMinutes(minutes) {
  return (minutes || 0) / 60
}

function fmtH(h) {
  return `${(h || 0).toFixed(1)}h`
}

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function toInputDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function serviceLabel(entry) {
  const fromTicket = entry.ticket?.title || entry.ticket?.ticket_id
  if (fromTicket) return String(fromTicket).split('—')[0].split('-')[0].trim().slice(0, 32)
  if (entry.description) return String(entry.description).slice(0, 32)
  const services = entry.client?.account_services
  if (Array.isArray(services) && services[0]) return services[0]
  return 'Unspecified'
}

function HBar({ rows, colors, max: maxOverride }) {
  const max = maxOverride || Math.max(...rows.map((r) => r.value), 1)
  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="text-sm text-muted-foreground">No hours in this range.</p>}
      {rows.map((row, i) => (
        <div key={row.label}>
          <div className="flex justify-between text-sm mb-1">
            <span className="truncate pr-2">{row.label}</span>
            <span className="tabular-nums text-muted-foreground">{fmtH(row.value)}</span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(4, (row.value / max) * 100)}%`,
                background: colors[i % colors.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function PieLegend({ slices }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1
  let acc = 0
  const stops = slices.map((s, i) => {
    const start = acc
    acc += (s.value / total) * 100
    return `${BRAND[i % BRAND.length]} ${start}% ${acc}%`
  })
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div
        className="h-40 w-40 rounded-full shrink-0"
        style={{ background: slices.length ? `conic-gradient(${stops.join(',')})` : '#e2e8f0' }}
      />
      <div className="space-y-2 w-full">
        {slices.map((s, i) => (
          <div key={s.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 min-w-0">
              <i className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BRAND[i % BRAND.length] }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums text-muted-foreground">{fmtH(s.value)}</span>
          </div>
        ))}
        {slices.length === 0 && <p className="text-sm text-muted-foreground">No data</p>}
      </div>
    </div>
  )
}

function Kpi({ label, value, hint }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}

export default function ReportsLeadership({
  employees,
  clients,
  timeEntries,
  onRefresh,
  refreshing,
  onExport,
}) {
  const now = new Date()
  const [tab, setTab] = useState('user-time')
  const [chartView, setChartView] = useState('pie')
  const [from, setFrom] = useState('2026-01-01')
  const [to, setTo] = useState(toInputDate(endOfMonth(now)))
  const [clientId, setClientId] = useState('all')
  const [userId, setUserId] = useState('all')
  const [service, setService] = useState('all')
  const [sortKey, setSortKey] = useState('hours')
  const [sortDir, setSortDir] = useState('desc')

  const resetFilters = () => {
    setFrom('2026-01-01')
    setTo(toInputDate(endOfMonth(now)))
    setClientId('all')
    setUserId('all')
    setService('all')
  }

  const services = useMemo(() => {
    const set = new Set()
    timeEntries.forEach((e) => set.add(serviceLabel(e)))
    return [...set].sort()
  }, [timeEntries])

  const filtered = useMemo(() => {
    return timeEntries.filter((e) => {
      if (!e.date) return false
      if (e.date < from || e.date > to) return false
      if (clientId !== 'all' && e.client_id !== clientId) return false
      if (userId !== 'all' && e.user_id !== userId) return false
      if (service !== 'all' && serviceLabel(e) !== service) return false
      return true
    })
  }, [timeEntries, from, to, clientId, userId, service])

  const retainerClients = useMemo(
    () => clients.filter((c) => (c.client_type || CLIENT_TYPES.RETAINER) === CLIENT_TYPES.RETAINER),
    [clients]
  )
  const contractClients = useMemo(
    () => clients.filter((c) => c.client_type === CLIENT_TYPES.PROJECT),
    [clients]
  )

  const byType = (list) => {
    const ids = new Set(list.map((c) => c.id))
    if (list.length === 0) return filtered
    return filtered.filter((e) => ids.has(e.client_id))
  }

  const userTime = tab === 'retainers' ? byType(retainerClients) : tab === 'contracts' ? byType(contractClients) : filtered

  const totalHours = hoursFromMinutes(userTime.reduce((s, e) => s + (e.minutes || 0), 0))
  const userIds = new Set(userTime.map((e) => e.user_id).filter(Boolean))
  const userCount = userIds.size
  const avgHours = userCount ? totalHours / userCount : 0
  const target = employees
    .filter((e) => userIds.has(e.id) || userId === 'all')
    .reduce((s, e) => s + (e.target_hours_monthly || 120), 0)
  const utilization = target ? Math.min(100, (totalHours / target) * 100) : 0

  const hoursByClient = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const name = e.client?.name || 'No client'
      map[name] = (map[name] || 0) + hoursFromMinutes(e.minutes)
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [userTime])

  const hoursByClientPeople = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const client = e.client?.name || 'No client'
      const person = (e.user?.full_name || 'Unassigned').trim()
      if (!map[client]) map[client] = { total: 0, people: {} }
      const h = hoursFromMinutes(e.minutes)
      map[client].total += h
      map[client].people[person] = (map[client].people[person] || 0) + h
    })
    return Object.entries(map)
      .map(([client, v]) => ({
        client,
        total: v.total,
        people: Object.entries(v.people)
          .map(([name, hours]) => ({ name, hours }))
          .filter((p) => p.hours > 0.05)
          .sort((a, b) => b.hours - a.hours),
      }))
      .sort((a, b) => b.total - a.total)
  }, [userTime])

  const hoursByUser = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const name = e.user?.full_name || 'Unknown'
      map[name] = (map[name] || 0) + hoursFromMinutes(e.minutes)
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .filter((r) => r.value > 0.05)
      .sort((a, b) => b.value - a.value)
  }, [userTime])

  const hoursByWeek = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      if (!e.date) return
      const d = new Date(`${e.date}T00:00:00`)
      const day = (d.getDay() + 6) % 7
      d.setDate(d.getDate() - day)
      const key = toInputDate(d)
      map[key] = (map[key] || 0) + hoursFromMinutes(e.minutes)
    })
    return Object.keys(map).sort().map((label) => ({
      label: label.slice(5),
      value: map[label],
    }))
  }, [userTime])

  const hoursByService = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const name = serviceLabel(e)
      map[name] = (map[name] || 0) + hoursFromMinutes(e.minutes)
    })
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [userTime])

  const peopleRows = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const name = (e.user?.full_name || 'Unassigned').trim()
      const id = name.toLowerCase()
      if (!map[id]) {
        map[id] = {
          id,
          name,
          hours: 0,
          clients: new Set(),
          tasks: new Set(),
        }
      }
      map[id].hours += hoursFromMinutes(e.minutes)
      if (e.client?.name) map[id].clients.add(e.client.name)
      map[id].tasks.add(e.ticket_id || e.id)
    })
    const rows = Object.values(map).map((r) => ({
      ...r,
      clientCount: r.clients.size,
      taskCount: r.tasks.size,
    })).filter((r) => r.hours > 0.05)
    rows.sort((a, b) => {
      const av = sortKey === 'name' ? a.name : sortKey === 'clients' ? a.clientCount : sortKey === 'tasks' ? a.taskCount : a.hours
      const bv = sortKey === 'name' ? b.name : sortKey === 'clients' ? b.clientCount : sortKey === 'tasks' ? b.taskCount : b.hours
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      return sortDir === 'asc' ? av - bv : bv - av
    })
    return rows
  }, [userTime, sortKey, sortDir])

  const includedHours = retainerClients.reduce((s, c) => s + (c.monthly_hours || 0), 0)
  const usedRetainer = hoursFromMinutes(byType(retainerClients).reduce((s, e) => s + (e.minutes || 0), 0))
  const remaining = Math.max(0, includedHours - usedRetainer)
  const usedPct = includedHours ? (usedRetainer / includedHours) * 100 : 0

  const monthCols = useMemo(() => {
    const cols = []
    const start = new Date(`${from}T00:00:00`)
    const end = new Date(`${to}T00:00:00`)
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    while (cursor <= end && cols.length < 12) {
      cols.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`)
      cursor.setMonth(cursor.getMonth() + 1)
    }
    return cols
  }, [from, to])

  const retainerMatrix = useMemo(() => {
    const rows = {}
    byType(retainerClients).forEach((e) => {
      const name = e.user?.full_name || 'Unknown'
      const key = e.date.slice(0, 7)
      if (!rows[name]) rows[name] = { name, months: {}, total: 0 }
      rows[name].months[key] = (rows[name].months[key] || 0) + hoursFromMinutes(e.minutes)
      rows[name].total += hoursFromMinutes(e.minutes)
    })
    return Object.values(rows).sort((a, b) => b.total - a.total)
  }, [timeEntries, from, to, clientId, userId, service, retainerClients])

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const timesheet = useMemo(() => {
    return [...userTime]
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      .slice(0, 200)
  }, [userTime])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-gradient-to-r from-brand-orange/10 via-transparent to-brand-coral/10 p-4 sm:p-6">
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Date range</p>
          <div className="flex gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Client</p>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">User</p>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {employees.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Service</p>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={resetFilters}>Reset</Button>
        <Badge variant="secondary" className="hidden sm:inline-flex mb-1">Internal</Badge>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => onExport('excel', userTime)}><Download className="h-4 w-4 mr-1" /> Excel</Button>
          <Button variant="outline" size="sm" onClick={() => onExport('pdf', userTime)}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
          <Button variant="outline" size="sm" onClick={() => onExport('csv', userTime)}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="user-time">User Time</TabsTrigger>
          <TabsTrigger value="retainers">Retainers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>

        <TabsContent value="user-time" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Total hours tracked" value={fmtH(totalHours)} />
            <Kpi label="Users" value={userCount} />
            <Kpi label="Avg hours / user" value={fmtH(avgHours)} />
            <Kpi label="Utilization" value={`${utilization.toFixed(0)}%`} hint="Tracked vs monthly targets" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hours over time</CardTitle>
              <p className="text-sm text-muted-foreground">Hours logged each week in this range. Peaks are heavy weeks, not a percent.</p>
            </CardHeader>
            <CardContent>
              {hoursByWeek.length ? (
                <AreaChart data={hoursByWeek} height={220} />
              ) : (
                <p className="text-sm text-muted-foreground">No hours in this range yet.</p>
              )}
            </CardContent>
          </Card>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base">Hours by client</CardTitle>
                  <p className="text-sm text-muted-foreground">Pick pie, bars, or who worked on each client.</p>
                </div>
                <div className="flex gap-1 bg-muted rounded-lg p-1">
                  {[
                    ['pie', 'Pie'],
                    ['bars', 'Bars'],
                    ['people', 'Who worked'],
                  ].map(([id, label]) => (
                    <Button key={id} size="sm" variant={chartView === id ? 'default' : 'ghost'} onClick={() => setChartView(id)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {chartView === 'pie' && <PieLegend slices={hoursByClient} />}
                {chartView === 'bars' && <HBar rows={hoursByClient} colors={BRAND} />}
                {chartView === 'people' && (
                  <div className="space-y-4">
                    {hoursByClientPeople.map((row) => {
                      const max = Math.max(...hoursByClientPeople.map((r) => r.total), 1)
                      return (
                        <div key={row.client}>
                          <div className="flex justify-between text-sm font-medium mb-1">
                            <span>{row.client}</span>
                            <span className="tabular-nums">{fmtH(row.total)}</span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden mb-2">
                            <div className="h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-coral" style={{ width: `${Math.max(6, (row.total / max) * 100)}%` }} />
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {row.people.map((p) => (
                              <span key={p.name}>{p.name} · {fmtH(p.hours)}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by person</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByUser.slice(0, 8)} colors={BRAND} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by service</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByService} colors={BRAND} /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">People</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 cursor-pointer" onClick={() => toggleSort('name')}>User</th>
                    <th className="py-2 cursor-pointer text-right" onClick={() => toggleSort('hours')}>Total hours</th>
                    <th className="py-2 cursor-pointer text-right" onClick={() => toggleSort('clients')}>Clients</th>
                    <th className="py-2 cursor-pointer text-right" onClick={() => toggleSort('tasks')}>Tasks</th>
                  </tr>
                </thead>
                <tbody>
                  {peopleRows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.name}</td>
                      <td className="py-2 text-right tabular-nums">{fmtH(r.hours)}</td>
                      <td className="py-2 text-right tabular-nums">{r.clientCount}</td>
                      <td className="py-2 text-right tabular-nums">{r.taskCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retainers" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Total retainer hours" value={fmtH(includedHours)} hint="Sum of monthly included hours" />
            <Kpi label="Hours used" value={fmtH(usedRetainer)} />
            <Kpi label="Hours remaining" value={fmtH(remaining)} />
            <Kpi label="% used" value={`${usedPct.toFixed(0)}%`} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by user</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByUser.slice(0, 8)} colors={BRAND} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by service</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByService} colors={BRAND} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Usage vs included</CardTitle></CardHeader>
              <CardContent>
                <div className="h-3 rounded-full bg-muted overflow-hidden mb-2">
                  <div className="h-full bg-gradient-to-r from-brand-orange to-brand-coral" style={{ width: `${Math.min(100, usedPct)}%` }} />
                </div>
                <p className="text-sm text-muted-foreground">{fmtH(usedRetainer)} of {fmtH(includedHours)}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Retainer breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">User</th>
                    {monthCols.map((m) => <th key={m} className="py-2 text-right">{m.slice(5)}</th>)}
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {retainerMatrix.map((r) => (
                    <tr key={r.name} className="border-b last:border-0">
                      <td className="py-2 font-medium">{r.name}</td>
                      {monthCols.map((m) => (
                        <td key={m} className="py-2 text-right tabular-nums">{r.months[m] ? r.months[m].toFixed(1) : '—'}</td>
                      ))}
                      <td className="py-2 text-right font-medium tabular-nums">{r.total.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Contract hours" value={fmtH(totalHours)} />
            <Kpi label="Users" value={userCount} />
            <Kpi label="Clients" value={new Set(userTime.map((e) => e.client_id).filter(Boolean)).size} />
            <Kpi label="Tasks" value={new Set(userTime.map((e) => e.ticket_id || e.id)).size} />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by user</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByUser.slice(0, 8)} colors={BRAND} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by client</CardTitle></CardHeader>
              <CardContent><PieLegend slices={hoursByClient} /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Timesheet</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Date</th>
                    <th className="py-2">User</th>
                    <th className="py-2">Client</th>
                    <th className="py-2">Task</th>
                    <th className="py-2 text-right">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheet.map((e) => (
                    <tr key={e.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(e.date)}</td>
                      <td className="py-2">{e.user?.full_name || '—'}</td>
                      <td className="py-2">{e.client?.name || '—'}</td>
                      <td className="py-2">{e.ticket?.title || e.description || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{fmtH(hoursFromMinutes(e.minutes))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
