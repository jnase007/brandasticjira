import { Fragment, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Download, FileText, RefreshCw } from 'lucide-react'
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

function retainerStatus(used, included) {
  if (!included) return { label: 'No hours set', cls: 'bg-muted text-muted-foreground' }
  const pct = used / included
  if (pct > 1) return { label: 'Over retainer', cls: 'bg-red-100 text-red-700' }
  if (pct >= 0.85) return { label: 'Approaching limit', cls: 'bg-amber-100 text-amber-800' }
  return { label: 'On track', cls: 'bg-emerald-100 text-emerald-800' }
}

function monthKey(date) {
  return (date || '').slice(0, 7)
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
  const [taskId, setTaskId] = useState('all')
  const [groupBy, setGroupBy] = useState('month')
  const [exportOpen, setExportOpen] = useState(false)
  const [expandedUser, setExpandedUser] = useState(null)
  const [expandedClient, setExpandedClient] = useState(null)
  const [sortKey, setSortKey] = useState('hours')
  const [sortDir, setSortDir] = useState('desc')

  const resetFilters = () => {
    setFrom('2026-01-01')
    setTo(toInputDate(endOfMonth(now)))
    setClientId('all')
    setUserId('all')
    setService('all')
    setTaskId('all')
    setGroupBy('month')
  }

  const services = useMemo(() => {
    const set = new Set()
    timeEntries.forEach((e) => set.add(serviceLabel(e)))
    return [...set].sort()
  }, [timeEntries])

  const tasks = useMemo(() => {
    const map = {}
    timeEntries.forEach((e) => {
      const id = String(e.ticket_id || e.id)
      const title = e.ticket?.title || e.ticket?.ticket_id || e.description || 'Untitled'
      if (!map[id]) map[id] = title.slice(0, 48)
    })
    return Object.entries(map).map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title))
  }, [timeEntries])

  const filtered = useMemo(() => {
    return timeEntries.filter((e) => {
      if (!e.date) return false
      if (e.date < from || e.date > to) return false
      if (clientId !== 'all' && e.client_id !== clientId) return false
      if (userId !== 'all' && e.user_id !== userId) return false
      if (service !== 'all' && serviceLabel(e) !== service) return false
      if (taskId !== 'all' && String(e.ticket_id || e.id) !== taskId) return false
      return true
    })
  }, [timeEntries, from, to, clientId, userId, service, taskId])

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
          taskHours: {},
        }
      }
      map[id].hours += hoursFromMinutes(e.minutes)
      if (e.client?.name) map[id].clients.add(e.client.name)
      const tid = String(e.ticket_id || e.id)
      map[id].tasks.add(tid)
      const tname = e.ticket?.title || e.description || 'Untitled'
      map[id].taskHours[tname] = (map[id].taskHours[tname] || 0) + hoursFromMinutes(e.minutes)
    })
    const rows = Object.values(map).map((r) => ({
      ...r,
      clientCount: r.clients.size,
      taskCount: r.tasks.size,
      taskList: Object.entries(r.taskHours).map(([title, hours]) => ({ title, hours })).sort((a, b) => b.hours - a.hours),
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

  const tempoGrid = useMemo(() => {
    const clientsMap = {}
    userTime.forEach((e) => {
      const cname = e.client?.name || 'No client'
      const uname = (e.user?.full_name || 'Unassigned').trim()
      const mk = monthKey(e.date)
      if (!clientsMap[cname]) clientsMap[cname] = { client: cname, people: {}, total: 0, months: {} }
      const c = clientsMap[cname]
      c.total += hoursFromMinutes(e.minutes)
      c.months[mk] = (c.months[mk] || 0) + hoursFromMinutes(e.minutes)
      if (!c.people[uname]) c.people[uname] = { name: uname, total: 0, months: {} }
      c.people[uname].total += hoursFromMinutes(e.minutes)
      c.people[uname].months[mk] = (c.people[uname].months[mk] || 0) + hoursFromMinutes(e.minutes)
    })
    return Object.values(clientsMap)
      .map((c) => ({ ...c, people: Object.values(c.people).sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total)
  }, [userTime])

  const retainerClientRows = useMemo(() => {
    return retainerClients.map((c) => {
      const used = hoursFromMinutes(filtered.filter((e) => e.client_id === c.id).reduce((s, e) => s + (e.minutes || 0), 0))
      const included = c.monthly_hours || 0
      const left = included - used
      const st = retainerStatus(used, included)
      const taskMap = {}
      filtered.filter((e) => e.client_id === c.id).forEach((e) => {
        const t = e.ticket?.title || e.description || 'Untitled'
        taskMap[t] = (taskMap[t] || 0) + hoursFromMinutes(e.minutes)
      })
      return {
        id: c.id,
        name: c.name,
        included,
        used,
        remaining: left,
        pct: included ? (used / included) * 100 : 0,
        over: Math.max(0, used - included),
        status: st,
        tasks: Object.entries(taskMap).map(([title, hours]) => ({ title, hours })).sort((a, b) => b.hours - a.hours),
      }
    }).sort((a, b) => b.used - a.used)
  }, [retainerClients, filtered])

  const workItems = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      const title = e.ticket?.title || e.description || 'Untitled'
      if (!map[title]) map[title] = { title, hours: 0, service: serviceLabel(e), users: new Set() }
      map[title].hours += hoursFromMinutes(e.minutes)
      if (e.user?.full_name) map[title].users.add(e.user.full_name)
    })
    const total = Object.values(map).reduce((s, x) => s + x.hours, 0) || 1
    return Object.values(map)
      .map((x) => ({ ...x, users: [...x.users].join(', '), pct: (x.hours / total) * 100 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 20)
  }, [userTime])

  const weekStacks = useMemo(() => {
    const map = {}
    userTime.forEach((e) => {
      if (!e.date) return
      const d = new Date(`${e.date}T00:00:00`)
      const week = Math.min(4, Math.floor((d.getDate() - 1) / 7) + 1)
      const task = e.ticket?.title || e.description || serviceLabel(e)
      if (!map[task]) map[task] = { task, weeks: [0, 0, 0, 0], total: 0 }
      map[task].weeks[week - 1] += hoursFromMinutes(e.minutes)
      map[task].total += hoursFromMinutes(e.minutes)
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [userTime])

  const saveView = () => {
    try {
      localStorage.setItem('brandastic-reports-view', JSON.stringify({ from, to, clientId, userId, service, taskId, groupBy, tab, chartView }))
    } catch {}
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
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Task</p>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tasks</SelectItem>
              {tasks.slice(0, 80).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1">Group by</p>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
              <SelectItem value="quarter">Quarter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={resetFilters} className="text-red-600">Reset</Button>
        <Button variant="outline" onClick={saveView}>Save view</Button>
        <Badge variant="secondary" className="hidden sm:inline-flex mb-1">Internal</Badge>
        <div className="ml-auto flex flex-wrap gap-2 relative">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn('h-4 w-4 mr-1', refreshing && 'animate-spin')} /> Refresh
          </Button>
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setExportOpen((o) => !o)}>
              Export <ChevronDown className="h-4 w-4 ml-1" />
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 z-20 w-36 rounded-md border bg-white shadow-md py-1">
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { onExport('excel', userTime); setExportOpen(false) }}>Excel</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { onExport('pdf', userTime); setExportOpen(false) }}>PDF</button>
                <button className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onClick={() => { onExport('csv', userTime); setExportOpen(false) }}>CSV</button>
              </div>
            )}
          </div>
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
                    <Fragment key={r.id}>
                      <tr className="border-b last:border-0 cursor-pointer" onClick={() => setExpandedUser(expandedUser === r.id ? null : r.id)}>
                        <td className="py-2 font-medium">
                          <span className="inline-flex items-center gap-1">
                            {expandedUser === r.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {r.name}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{fmtH(r.hours)}</td>
                        <td className="py-2 text-right tabular-nums">{r.clientCount}</td>
                        <td className="py-2 text-right tabular-nums">{r.taskCount}</td>
                      </tr>
                      {expandedUser === r.id && (
                        <tr className="bg-muted/40">
                          <td colSpan={4} className="py-2 px-6 text-sm text-muted-foreground">
                            {r.taskList.map((t) => (
                              <div key={t.title} className="flex justify-between py-0.5">
                                <span>{t.title}</span><span className="tabular-nums">{fmtH(t.hours)}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
              <CardHeader><CardTitle className="text-base">Retainer usage by user</CardTitle></CardHeader>
              <CardContent><HBar rows={hoursByUser.slice(0, 8)} colors={BRAND} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Usage over time</CardTitle></CardHeader>
              <CardContent>{hoursByWeek.length ? <AreaChart data={hoursByWeek} height={180} /> : <p className="text-sm text-muted-foreground">No hours.</p>}</CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by service</CardTitle></CardHeader>
              <CardContent><PieLegend slices={hoursByService} /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Retainer breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Client</th>
                    <th className="py-2 text-right">Retainer hours</th>
                    <th className="py-2 text-right">Hours used</th>
                    <th className="py-2 text-right">Remaining</th>
                    <th className="py-2 text-right">% used</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Overage</th>
                  </tr>
                </thead>
                <tbody>
                  {retainerClientRows.map((r) => (
                    <Fragment key={r.id}>
                      <tr className="border-b cursor-pointer" onClick={() => setExpandedClient(expandedClient === r.id ? null : r.id)}>
                        <td className="py-2 font-medium">
                          <span className="inline-flex items-center gap-1">
                            {expandedClient === r.id ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {r.name}
                          </span>
                        </td>
                        <td className="py-2 text-right tabular-nums">{fmtH(r.included)}</td>
                        <td className="py-2 text-right tabular-nums">{fmtH(r.used)}</td>
                        <td className="py-2 text-right tabular-nums">{fmtH(r.remaining)}</td>
                        <td className="py-2 text-right tabular-nums">{r.pct.toFixed(0)}%</td>
                        <td className="py-2"><span className={cn('text-xs px-2 py-0.5 rounded-full', r.status.cls)}>{r.status.label}</span></td>
                        <td className="py-2 text-right tabular-nums">{r.over ? fmtH(r.over) : '—'}</td>
                      </tr>
                      {expandedClient === r.id && (
                        <tr className="bg-muted/40">
                          <td colSpan={7} className="py-2 px-6 text-sm text-muted-foreground">
                            {r.tasks.length === 0 && 'No tasks in this range.'}
                            {r.tasks.map((t) => (
                              <div key={t.title} className="flex justify-between py-0.5">
                                <span>{t.title}</span><span className="tabular-nums">{fmtH(t.hours)}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Client × person × month</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Client / user</th>
                    <th className="py-2 text-right">Logged</th>
                    {monthCols.map((m) => <th key={m} className="py-2 text-right">{m}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {tempoGrid.map((c) => (
                    <Fragment key={c.client}>
                      <tr className="bg-muted/50 font-medium">
                        <td className="py-2">{c.client}</td>
                        <td className="py-2 text-right tabular-nums">{c.total.toFixed(1)}</td>
                        {monthCols.map((m) => <td key={m} className="py-2 text-right tabular-nums">{c.months[m] ? c.months[m].toFixed(1) : ''}</td>)}
                      </tr>
                      {c.people.map((p) => (
                        <tr key={`${c.client}-${p.name}`}>
                          <td className="py-2 pl-6">{p.name}</td>
                          <td className="py-2 text-right tabular-nums">{p.total.toFixed(1)}</td>
                          {monthCols.map((m) => <td key={m} className="py-2 text-right tabular-nums">{p.months[m] ? p.months[m].toFixed(1) : ''}</td>)}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contracts" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi label="Total tracked" value={fmtH(totalHours)} />
            <Kpi label="Tasks" value={new Set(userTime.map((e) => e.ticket_id || e.id)).size} />
            <Kpi label="Users" value={userCount} />
            <Kpi label="Services" value={hoursByService.length} />
          </div>
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-1">
              <CardHeader><CardTitle className="text-base">Time by task and week of month</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {weekStacks.map((row) => {
                  const max = Math.max(...weekStacks.map((w) => w.total), 1)
                  return (
                    <div key={row.task}>
                      <div className="flex justify-between text-xs mb-1"><span className="truncate pr-2">{row.task}</span><span>{fmtH(row.total)}</span></div>
                      <div className="flex h-4 rounded overflow-hidden bg-muted">
                        {row.weeks.map((h, i) => (
                          <div key={i} title={`Week ${i + 1}: ${fmtH(h)}`} style={{ width: `${(h / max) * 100}%`, background: BRAND[i % BRAND.length] }} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by service</CardTitle></CardHeader>
              <CardContent><PieLegend slices={hoursByService} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Hours by user</CardTitle></CardHeader>
              <CardContent><PieLegend slices={hoursByUser.slice(0, 8)} /></CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-base">Work item breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2">Work item / task</th>
                    <th className="py-2">Service</th>
                    <th className="py-2">Users</th>
                    <th className="py-2 text-right">Hours</th>
                    <th className="py-2 text-right">% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {workItems.map((w) => (
                    <tr key={w.title} className="border-b last:border-0">
                      <td className="py-2 font-medium">{w.title}</td>
                      <td className="py-2">{w.service}</td>
                      <td className="py-2">{w.users || '—'}</td>
                      <td className="py-2 text-right tabular-nums">{fmtH(w.hours)}</td>
                      <td className="py-2 text-right tabular-nums">{w.pct.toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
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
