import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, TrendingUp, TrendingDown, Users, Building2, 
  Calendar, DollarSign, Clock, Download, Filter, RefreshCw,
  ChevronLeft, ChevronRight, FileText, PieChart, Target,
  ArrowUpRight, ArrowDownRight, Minus, Eye, EyeOff, Printer
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

const FULL_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

function formatCurrency(value) {
  if (!value && value !== 0) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function formatHours(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function formatDecimalHours(hours) {
  return `${hours.toFixed(1)}h`
}

function getChangeIndicator(current, previous) {
  if (!previous || previous === 0) return { change: 0, direction: 'neutral' }
  const change = ((current - previous) / previous) * 100
  return {
    change: Math.abs(change).toFixed(1),
    direction: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
  }
}

function ChangeIndicator({ current, previous, invertColors = false }) {
  const { change, direction } = getChangeIndicator(current, previous)
  
  if (direction === 'neutral') {
    return <span className="text-muted-foreground text-xs flex items-center gap-1"><Minus className="h-3 w-3" /> No change</span>
  }
  
  const isPositive = invertColors ? direction === 'down' : direction === 'up'
  
  return (
    <span className={cn(
      "text-xs flex items-center gap-1",
      isPositive ? "text-green-500" : "text-red-500"
    )}>
      {direction === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {change}%
    </span>
  )
}

// Client Report Component
function ClientReport({ clients, timeEntries, clientRates, selectedYear, selectedMonth }) {
  const [selectedClient, setSelectedClient] = useState('all')
  const [viewMode, setViewMode] = useState('monthly') // monthly, yearly, lifetime
  
  // Get data for selected client or all
  const filteredEntries = useMemo(() => {
    let entries = timeEntries
    if (selectedClient !== 'all') {
      entries = entries.filter(e => e.client_id === selectedClient)
    }
    return entries
  }, [timeEntries, selectedClient])

  // Calculate monthly breakdown
  const monthlyData = useMemo(() => {
    const data = {}
    
    filteredEntries.forEach(entry => {
      const date = new Date(entry.date)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      
      if (!data[monthKey]) {
        data[monthKey] = {
          month: date.getMonth() + 1,
          year: date.getFullYear(),
          totalMinutes: 0,
          billableMinutes: 0,
          entries: 0,
          clients: new Set(),
        }
      }
      
      data[monthKey].totalMinutes += entry.minutes
      if (entry.billable) data[monthKey].billableMinutes += entry.minutes
      data[monthKey].entries++
      data[monthKey].clients.add(entry.client_id)
    })
    
    return Object.entries(data)
      .map(([key, value]) => ({ ...value, key }))
      .sort((a, b) => b.key.localeCompare(a.key))
  }, [filteredEntries])

  // Calculate current vs previous month
  const currentMonthKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
  const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
  const prevMonthKey = `${prevYear}-${String(prevMonth).padStart(2, '0')}`
  
  const currentMonthData = monthlyData.find(m => m.key === currentMonthKey)
  const prevMonthData = monthlyData.find(m => m.key === prevMonthKey)

  // Calculate yearly data
  const yearlyData = useMemo(() => {
    const data = {}
    
    filteredEntries.forEach(entry => {
      const year = new Date(entry.date).getFullYear()
      
      if (!data[year]) {
        data[year] = {
          year,
          totalMinutes: 0,
          billableMinutes: 0,
          entries: 0,
        }
      }
      
      data[year].totalMinutes += entry.minutes
      if (entry.billable) data[year].billableMinutes += entry.minutes
      data[year].entries++
    })
    
    return Object.values(data).sort((a, b) => b.year - a.year)
  }, [filteredEntries])

  // Lifetime totals
  const lifetimeData = useMemo(() => {
    return {
      totalMinutes: filteredEntries.reduce((sum, e) => sum + e.minutes, 0),
      billableMinutes: filteredEntries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes, 0),
      entries: filteredEntries.length,
      startDate: filteredEntries.length > 0 
        ? filteredEntries.reduce((min, e) => e.date < min ? e.date : min, filteredEntries[0].date)
        : null,
    }
  }, [filteredEntries])

  const selectedClientData = clients.find(c => c.id === selectedClient)
  const clientRate = clientRates.find(r => r.client_id === selectedClient)?.hourly_rate || 75

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: client.color || '#F7931E' }}
                  />
                  {client.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {['monthly', 'yearly', 'lifetime'].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors capitalize",
                viewMode === mode 
                  ? "bg-background shadow text-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">
                  {formatDecimalHours((currentMonthData?.totalMinutes || 0) / 60)}
                </p>
                <ChangeIndicator 
                  current={currentMonthData?.totalMinutes || 0}
                  previous={prevMonthData?.totalMinutes}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Billable Hours</p>
                <p className="text-2xl font-bold">
                  {formatDecimalHours((currentMonthData?.billableMinutes || 0) / 60)}
                </p>
                <ChangeIndicator 
                  current={currentMonthData?.billableMinutes || 0}
                  previous={prevMonthData?.billableMinutes}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Est. Revenue</p>
                <p className="text-2xl font-bold">
                  {formatCurrency((currentMonthData?.billableMinutes || 0) / 60 * clientRate)}
                </p>
                <p className="text-xs text-muted-foreground">@ {formatCurrency(clientRate)}/hr</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Target className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Utilization</p>
                <p className="text-2xl font-bold">
                  {currentMonthData?.totalMinutes 
                    ? Math.round((currentMonthData.billableMinutes / currentMonthData.totalMinutes) * 100)
                    : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Billable vs Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly/Yearly/Lifetime View */}
      {viewMode === 'monthly' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Month-over-Month Report
            </CardTitle>
            <CardDescription>
              Track hours and revenue trends across months
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-right p-3 font-medium">Total Hours</th>
                    <th className="text-right p-3 font-medium">Billable Hours</th>
                    <th className="text-right p-3 font-medium">Est. Revenue</th>
                    <th className="text-right p-3 font-medium">Entries</th>
                    <th className="text-right p-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.slice(0, 12).map((month, idx) => {
                    const prevMonth = monthlyData[idx + 1]
                    return (
                      <tr key={month.key} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">
                          {FULL_MONTHS[month.month - 1]} {month.year}
                        </td>
                        <td className="p-3 text-right">{formatDecimalHours(month.totalMinutes / 60)}</td>
                        <td className="p-3 text-right">{formatDecimalHours(month.billableMinutes / 60)}</td>
                        <td className="p-3 text-right font-medium text-green-600">
                          {formatCurrency(month.billableMinutes / 60 * clientRate)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">{month.entries}</td>
                        <td className="p-3 text-right">
                          <ChangeIndicator current={month.totalMinutes} previous={prevMonth?.totalMinutes} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'yearly' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Year-over-Year Report
            </CardTitle>
            <CardDescription>
              Annual comparison of hours and revenue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {yearlyData.map((year, idx) => {
                const prevYear = yearlyData[idx + 1]
                const revenue = (year.billableMinutes / 60) * clientRate
                
                return (
                  <div key={year.year} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xl font-bold">{year.year}</h3>
                      <ChangeIndicator current={year.totalMinutes} previous={prevYear?.totalMinutes} />
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="text-lg font-semibold">{formatDecimalHours(year.totalMinutes / 60)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Billable Hours</p>
                        <p className="text-lg font-semibold">{formatDecimalHours(year.billableMinutes / 60)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Est. Revenue</p>
                        <p className="text-lg font-semibold text-green-600">{formatCurrency(revenue)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Entries</p>
                        <p className="text-lg font-semibold">{year.entries}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {viewMode === 'lifetime' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Contract Lifetime Report
            </CardTitle>
            <CardDescription>
              {selectedClient !== 'all' && selectedClientData
                ? `Complete history for ${selectedClientData.name}`
                : 'Complete history across all clients'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="p-4 rounded-lg border text-center">
                <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{formatDecimalHours(lifetimeData.totalMinutes / 60)}</p>
                <p className="text-sm text-muted-foreground">Total Hours Tracked</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <DollarSign className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{formatDecimalHours(lifetimeData.billableMinutes / 60)}</p>
                <p className="text-sm text-muted-foreground">Billable Hours</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <TrendingUp className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                <p className="text-3xl font-bold text-green-600">
                  {formatCurrency((lifetimeData.billableMinutes / 60) * clientRate)}
                </p>
                <p className="text-sm text-muted-foreground">Lifetime Revenue</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <Calendar className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                <p className="text-3xl font-bold">{lifetimeData.entries}</p>
                <p className="text-sm text-muted-foreground">Time Entries</p>
              </div>
            </div>
            {lifetimeData.startDate && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Client since {formatDate(lifetimeData.startDate)}
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Team Report Component
function TeamReport({ employees, timeEntries, selectedYear, selectedMonth }) {
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  
  // Calculate team stats
  const teamStats = useMemo(() => {
    return employees.map(emp => {
      const empEntries = timeEntries.filter(e => e.user_id === emp.id)
      const currentMonthEntries = empEntries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
      })
      const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1
      const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear
      const prevMonthEntries = empEntries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() + 1 === prevMonth && d.getFullYear() === prevYear
      })
      
      const currentMinutes = currentMonthEntries.reduce((sum, e) => sum + e.minutes, 0)
      const prevMinutes = prevMonthEntries.reduce((sum, e) => sum + e.minutes, 0)
      const billableMinutes = currentMonthEntries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes, 0)
      const targetMinutes = (emp.target_hours_monthly || 120) * 60
      
      // Get unique clients worked on
      const clientsWorked = [...new Set(currentMonthEntries.map(e => e.client_id))].length
      
      return {
        ...emp,
        totalMinutes: currentMinutes,
        billableMinutes,
        prevMinutes,
        targetMinutes,
        efficiency: targetMinutes > 0 ? (currentMinutes / targetMinutes) * 100 : 0,
        utilization: currentMinutes > 0 ? (billableMinutes / currentMinutes) * 100 : 0,
        entries: currentMonthEntries.length,
        clientsWorked,
      }
    }).sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [employees, timeEntries, selectedMonth, selectedYear])

  // Team totals
  const teamTotals = useMemo(() => {
    return {
      totalMinutes: teamStats.reduce((sum, e) => sum + e.totalMinutes, 0),
      billableMinutes: teamStats.reduce((sum, e) => sum + e.billableMinutes, 0),
      entries: teamStats.reduce((sum, e) => sum + e.entries, 0),
      avgEfficiency: teamStats.length > 0 
        ? teamStats.reduce((sum, e) => sum + e.efficiency, 0) / teamStats.length 
        : 0,
    }
  }, [teamStats])

  return (
    <div className="space-y-6">
      {/* Team Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Clock className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Team Hours</p>
                <p className="text-2xl font-bold">{formatDecimalHours(teamTotals.totalMinutes / 60)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Target className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                <p className="text-2xl font-bold">{Math.round(teamTotals.avgEfficiency)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <FileText className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{teamTotals.entries}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Team Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Accountability Report
          </CardTitle>
          <CardDescription>
            {FULL_MONTHS[selectedMonth - 1]} {selectedYear} - Individual performance breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Team Member</th>
                  <th className="text-right p-3 font-medium">Hours Logged</th>
                  <th className="text-right p-3 font-medium">Target</th>
                  <th className="text-right p-3 font-medium">Efficiency</th>
                  <th className="text-right p-3 font-medium">Billable %</th>
                  <th className="text-right p-3 font-medium">Clients</th>
                  <th className="text-right p-3 font-medium">Entries</th>
                  <th className="text-right p-3 font-medium">MoM</th>
                </tr>
              </thead>
              <tbody>
                {teamStats.map((member) => (
                  <tr key={member.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-xs">{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {formatDecimalHours(member.totalMinutes / 60)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {member.target_hours_monthly || 120}h
                    </td>
                    <td className="p-3 text-right">
                      <Badge 
                        variant="outline"
                        className={cn(
                          member.efficiency >= 90 ? "border-green-500 text-green-500" :
                          member.efficiency >= 70 ? "border-yellow-500 text-yellow-500" :
                          member.efficiency >= 50 ? "border-orange-500 text-orange-500" :
                          "border-red-500 text-red-500"
                        )}
                      >
                        {Math.round(member.efficiency)}%
                      </Badge>
                    </td>
                    <td className="p-3 text-right">
                      {Math.round(member.utilization)}%
                    </td>
                    <td className="p-3 text-right">
                      {member.clientsWorked}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {member.entries}
                    </td>
                    <td className="p-3 text-right">
                      <ChangeIndicator current={member.totalMinutes} previous={member.prevMinutes} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Work Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Work Distribution</CardTitle>
          <CardDescription>Visual breakdown of hours by team member</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {teamStats.map((member) => {
              const maxMinutes = Math.max(...teamStats.map(m => m.totalMinutes), 1)
              const percentage = (member.totalMinutes / maxMinutes) * 100
              
              return (
                <div key={member.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{member.full_name}</span>
                    <span>{formatDecimalHours(member.totalMinutes / 60)}</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="h-full bg-gradient-to-r from-brand-orange to-brand-coral rounded-full"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Profitability Report Component (Admin only)
function ProfitabilityReport({ employees, clients, timeEntries, clientRates, selectedYear, selectedMonth }) {
  const [showCosts, setShowCosts] = useState(true)

  // Calculate employee profitability
  const employeeProfitability = useMemo(() => {
    return employees.map(emp => {
      const empEntries = timeEntries.filter(e => e.user_id === emp.id)
      const currentMonthEntries = empEntries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
      })
      
      const totalMinutes = currentMonthEntries.reduce((sum, e) => sum + e.minutes, 0)
      const billableMinutes = currentMonthEntries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes, 0)
      
      // Calculate cost (employee hourly cost * hours worked)
      const hourlyCost = emp.hourly_cost || 50
      const totalCost = (totalMinutes / 60) * hourlyCost
      
      // Calculate revenue (sum of billable hours * each client's rate)
      let revenue = 0
      currentMonthEntries.filter(e => e.billable).forEach(entry => {
        const rate = clientRates.find(r => r.client_id === entry.client_id)?.hourly_rate || 75
        revenue += (entry.minutes / 60) * rate
      })
      
      const profit = revenue - totalCost
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0
      const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
      
      return {
        ...emp,
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        hourlyCost,
        totalCost,
        revenue,
        profit,
        margin,
        roi,
      }
    }).sort((a, b) => b.profit - a.profit)
  }, [employees, timeEntries, clientRates, selectedMonth, selectedYear])

  // Calculate client profitability
  const clientProfitability = useMemo(() => {
    return clients.map(client => {
      const clientEntries = timeEntries.filter(e => e.client_id === client.id)
      const currentMonthEntries = clientEntries.filter(e => {
        const d = new Date(e.date)
        return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
      })
      
      const billingRate = clientRates.find(r => r.client_id === client.id)?.hourly_rate || 75
      const totalMinutes = currentMonthEntries.reduce((sum, e) => sum + e.minutes, 0)
      const billableMinutes = currentMonthEntries.filter(e => e.billable).reduce((sum, e) => sum + e.minutes, 0)
      
      // Revenue
      const revenue = (billableMinutes / 60) * billingRate
      
      // Cost (sum of hours * each employee's hourly cost)
      let totalCost = 0
      currentMonthEntries.forEach(entry => {
        const emp = employees.find(e => e.id === entry.user_id)
        totalCost += (entry.minutes / 60) * (emp?.hourly_cost || 50)
      })
      
      const profit = revenue - totalCost
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0
      
      return {
        ...client,
        totalHours: totalMinutes / 60,
        billableHours: billableMinutes / 60,
        billingRate,
        revenue,
        totalCost,
        profit,
        margin,
        entries: currentMonthEntries.length,
      }
    }).sort((a, b) => b.profit - a.profit)
  }, [clients, employees, timeEntries, clientRates, selectedMonth, selectedYear])

  // Company totals
  const totals = useMemo(() => {
    const totalRevenue = clientProfitability.reduce((sum, c) => sum + c.revenue, 0)
    const totalCost = employeeProfitability.reduce((sum, e) => sum + e.totalCost, 0)
    const totalProfit = totalRevenue - totalCost
    const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    
    return { totalRevenue, totalCost, totalProfit, margin }
  }, [employeeProfitability, clientProfitability])

  return (
    <div className="space-y-6">
      {/* Toggle */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCosts(!showCosts)}
          className="gap-2"
        >
          {showCosts ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showCosts ? 'Hide' : 'Show'} Costs
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(totals.totalRevenue)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {showCosts && (
          <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cost</p>
                  <p className="text-2xl font-bold text-red-600">
                    {formatCurrency(totals.totalCost)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className={cn(
          "border-2",
          totals.totalProfit >= 0 
            ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30" 
            : "bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                totals.totalProfit >= 0 ? "bg-emerald-500/20" : "bg-red-500/20"
              )}>
                <TrendingUp className={cn(
                  "h-5 w-5",
                  totals.totalProfit >= 0 ? "text-emerald-500" : "text-red-500"
                )} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Net Profit</p>
                <p className={cn(
                  "text-2xl font-bold",
                  totals.totalProfit >= 0 ? "text-emerald-600" : "text-red-600"
                )}>
                  {formatCurrency(totals.totalProfit)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <PieChart className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Profit Margin</p>
                <p className="text-2xl font-bold">
                  {Math.round(totals.margin)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee ROI */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Employee ROI Report
          </CardTitle>
          <CardDescription>
            Return on investment per team member - {FULL_MONTHS[selectedMonth - 1]} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Employee</th>
                  <th className="text-right p-3 font-medium">Hours</th>
                  <th className="text-right p-3 font-medium">Hourly Rate</th>
                  {showCosts && <th className="text-right p-3 font-medium">Cost</th>}
                  <th className="text-right p-3 font-medium">Revenue Gen.</th>
                  <th className="text-right p-3 font-medium">Profit</th>
                  <th className="text-right p-3 font-medium">ROI</th>
                </tr>
              </thead>
              <tbody>
                {employeeProfitability.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={emp.avatar_url} />
                          <AvatarFallback className="text-xs">{getInitials(emp.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatDecimalHours(emp.totalHours)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatCurrency(emp.hourlyCost)}/hr
                    </td>
                    {showCosts && (
                      <td className="p-3 text-right text-red-600">{formatCurrency(emp.totalCost)}</td>
                    )}
                    <td className="p-3 text-right text-green-600">{formatCurrency(emp.revenue)}</td>
                    <td className={cn(
                      "p-3 text-right font-medium",
                      emp.profit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(emp.profit)}
                    </td>
                    <td className="p-3 text-right">
                      <Badge 
                        variant="outline"
                        className={cn(
                          emp.roi >= 100 ? "border-emerald-500 text-emerald-500" :
                          emp.roi >= 50 ? "border-green-500 text-green-500" :
                          emp.roi >= 0 ? "border-yellow-500 text-yellow-500" :
                          "border-red-500 text-red-500"
                        )}
                      >
                        {Math.round(emp.roi)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Client Profitability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Client Profitability Report
          </CardTitle>
          <CardDescription>
            Revenue and profit by client - {FULL_MONTHS[selectedMonth - 1]} {selectedYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Client</th>
                  <th className="text-right p-3 font-medium">Hours</th>
                  <th className="text-right p-3 font-medium">Rate</th>
                  <th className="text-right p-3 font-medium">Revenue</th>
                  {showCosts && <th className="text-right p-3 font-medium">Cost</th>}
                  <th className="text-right p-3 font-medium">Profit</th>
                  <th className="text-right p-3 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody>
                {clientProfitability.filter(c => c.entries > 0).map((client) => (
                  <tr key={client.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: client.color || '#F7931E' }}
                        />
                        <span className="font-medium">{client.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-right">{formatDecimalHours(client.billableHours)}</td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatCurrency(client.billingRate)}/hr
                    </td>
                    <td className="p-3 text-right text-green-600">{formatCurrency(client.revenue)}</td>
                    {showCosts && (
                      <td className="p-3 text-right text-red-600">{formatCurrency(client.totalCost)}</td>
                    )}
                    <td className={cn(
                      "p-3 text-right font-medium",
                      client.profit >= 0 ? "text-emerald-600" : "text-red-600"
                    )}>
                      {formatCurrency(client.profit)}
                    </td>
                    <td className="p-3 text-right">
                      <Badge 
                        variant="outline"
                        className={cn(
                          client.margin >= 50 ? "border-emerald-500 text-emerald-500" :
                          client.margin >= 30 ? "border-green-500 text-green-500" :
                          client.margin >= 0 ? "border-yellow-500 text-yellow-500" :
                          "border-red-500 text-red-500"
                        )}
                      >
                        {Math.round(client.margin)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Main Reports Page
export default function Reports() {
  const { user, profile, isAdmin } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Data
  const [employees, setEmployees] = useState([])
  const [clients, setClients] = useState([])
  const [clientRates, setClientRates] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Default tab based on role
  const defaultTab = isAdmin ? 'profitability' : 'team'

  // Fetch data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [employeesRes, clientsRes, clientRatesRes, timeEntriesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .in('role', ['team', 'admin'])
          .order('full_name'),
        supabase
          .from('clients')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('client_rates')
          .select('*'),
        supabase
          .from('time_entries')
          .select('*')
          .order('date', { ascending: false }),
      ])

      setEmployees(employeesRes.data || [])
      setClients(clientsRes.data || [])
      setClientRates(clientRatesRes.data || [])
      setTimeEntries(timeEntriesRes.data || [])
    } catch (error) {
      console.error('Error fetching report data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load report data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Export to CSV
  const exportCSV = (type) => {
    let data = []
    let filename = ''
    
    if (type === 'team') {
      data = employees.map(emp => ({
        Name: emp.full_name,
        Email: emp.email,
        'Target Hours': emp.target_hours_monthly || 120,
        'Hourly Cost': emp.hourly_cost || 50,
      }))
      filename = `team-report-${selectedYear}-${selectedMonth}.csv`
    } else if (type === 'entries') {
      data = timeEntries
        .filter(e => {
          const d = new Date(e.date)
          return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
        })
        .map(entry => {
          const emp = employees.find(e => e.id === entry.user_id)
          const client = clients.find(c => c.id === entry.client_id)
          return {
            Date: entry.date,
            Employee: emp?.full_name || 'Unknown',
            Client: client?.name || 'Unknown',
            Description: entry.description,
            Minutes: entry.minutes,
            Hours: (entry.minutes / 60).toFixed(2),
            Billable: entry.billable ? 'Yes' : 'No',
          }
        })
      filename = `time-entries-${selectedYear}-${selectedMonth}.csv`
    }
    
    // Create CSV
    const headers = Object.keys(data[0] || {})
    const csv = [
      headers.join(','),
      ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n')
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    
    toast({ title: 'Report exported!', variant: 'success' })
  }

  if (loading) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-8 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-purple to-brand-blue">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold">Reports</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Comprehensive insights into clients, team performance, and profitability
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Date Selector */}
            <div className="flex items-center gap-2 bg-muted rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (selectedMonth === 1) {
                    setSelectedMonth(12)
                    setSelectedYear(prev => prev - 1)
                  } else {
                    setSelectedMonth(prev => prev - 1)
                  }
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 font-medium min-w-[140px] text-center">
                {FULL_MONTHS[selectedMonth - 1]} {selectedYear}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  if (selectedMonth === 12) {
                    setSelectedMonth(1)
                    setSelectedYear(prev => prev + 1)
                  } else {
                    setSelectedMonth(prev => prev + 1)
                  }
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV('entries')}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="client" className="gap-2">
            <Building2 className="h-4 w-4" />
            Client Reports
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            Team Reports
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="profitability" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Profitability
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="client">
          <motion.div variants={itemVariants}>
            <ClientReport
              clients={clients}
              timeEntries={timeEntries}
              clientRates={clientRates}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="team">
          <motion.div variants={itemVariants}>
            <TeamReport
              employees={employees}
              timeEntries={timeEntries}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </motion.div>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="profitability">
            <motion.div variants={itemVariants}>
              <ProfitabilityReport
                employees={employees}
                clients={clients}
                timeEntries={timeEntries}
                clientRates={clientRates}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
              />
            </motion.div>
          </TabsContent>
        )}
      </Tabs>
    </motion.div>
  )
}
