import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart3, TrendingUp, TrendingDown, Users, Building2, 
  Calendar, DollarSign, Clock, Download, Filter, RefreshCw,
  ChevronLeft, ChevronRight, FileText, PieChart, Target,
  ArrowUpRight, ArrowDownRight, Minus, Eye, EyeOff, Printer,
  Wallet, UserCheck, X, Check
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Input } from '../components/ui/input'
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
import { BarChart, DonutChart, AreaChart } from '../components/Charts'

const BRAND_LOGO =
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Brandastic_black_logo%20(6).png'
let cachedLogoDataUrl = null

async function loadLogoDataUrl() {
  if (cachedLogoDataUrl) return cachedLogoDataUrl
  try {
    const res = await fetch(BRAND_LOGO)
    const blob = await res.blob()
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
    cachedLogoDataUrl = dataUrl
    return dataUrl
  } catch {
    return null
  }
}

function ReportHeader({ title, subtitle }) {
  return (
    <div className="rounded-2xl border bg-gradient-to-r from-brand-orange/10 via-transparent to-brand-coral/10 p-4 sm:p-6 mb-6">
      <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        <Badge variant="secondary" className="hidden sm:inline-flex">Internal</Badge>
      </div>
    </div>
  )
}

function ReportFooter() {
  // Footer only shows in PDF exports, not in web view
  return null
}

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

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
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
      <ReportHeader
        title="Client Report"
        subtitle={`${FULL_MONTHS[selectedMonth - 1]} ${selectedYear} • ${viewMode === 'monthly' ? 'Monthly' : viewMode === 'yearly' ? 'Yearly' : 'Lifetime'}`}
      />
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
      <ReportFooter />
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
      <ReportHeader
        title="Team Report"
        subtitle={`${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`}
      />
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
      <ReportFooter />
    </div>
  )
}

function TimeReports({ employees, clients, timeEntries, selectedYear, selectedMonth }) {
  const [activeTab, setActiveTab] = useState('summary')
  const [selectedClient, setSelectedClient] = useState('all')
  const [selectedEmployee, setSelectedEmployee] = useState('all')
  const [billableFilter, setBillableFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [weeklyLimit, setWeeklyLimit] = useState('20')

  const normalizedEntries = useMemo(() => {
    return (timeEntries || []).map((entry) => {
      const minutes = entry.minutes ?? entry.duration_minutes ?? 0
      const date = entry.date || (entry.start_time ? entry.start_time.split('T')[0] : null)
      return {
        ...entry,
        minutes,
        date,
        billable: Boolean(entry.billable),
      }
    }).filter((entry) => entry.date)
  }, [timeEntries])

  const monthEntries = useMemo(() => {
    return normalizedEntries.filter((entry) => {
      const d = new Date(entry.date)
      return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
    })
  }, [normalizedEntries, selectedMonth, selectedYear])

  const totalMinutes = monthEntries.reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  const billableMinutes = monthEntries.filter((entry) => entry.billable).reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  const nonBillableMinutes = Math.max(totalMinutes - billableMinutes, 0)
  const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate()
  const avgDailyMinutes = daysInMonth ? totalMinutes / daysInMonth : 0

  const dailyTotals = useMemo(() => {
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(selectedYear, selectedMonth - 1, index + 1)
      const dayMinutes = monthEntries
        .filter((entry) => isSameDay(new Date(entry.date), date))
        .reduce((sum, entry) => sum + entry.minutes, 0)
      return {
        label: `${index + 1}`,
        value: dayMinutes / 60,
      }
    })
  }, [daysInMonth, monthEntries, selectedMonth, selectedYear])

  const topClients = useMemo(() => {
    const clientMap = new Map()
    monthEntries.forEach((entry) => {
      const id = entry.client_id || entry.client?.id
      if (!id) return
      const current = clientMap.get(id) || { id, name: entry.client?.name || 'Unknown', minutes: 0 }
      current.minutes += entry.minutes || 0
      clientMap.set(id, current)
    })
    return Array.from(clientMap.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
  }, [monthEntries])

  const topEmployees = useMemo(() => {
    const employeeMap = new Map()
    monthEntries.forEach((entry) => {
      const id = entry.user_id || entry.user?.id
      if (!id) return
      const current = employeeMap.get(id) || {
        id,
        name: entry.user?.full_name || 'Unknown',
        avatar: entry.user?.avatar_url,
        minutes: 0,
      }
      current.minutes += entry.minutes || 0
      employeeMap.set(id, current)
    })
    return Array.from(employeeMap.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 5)
  }, [monthEntries])

  const weeklyDates = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - idx))
      return d
    })
  }, [])

  const weeklyTotals = useMemo(() => {
    return weeklyDates.map((date) => {
      const minutes = normalizedEntries
        .filter((entry) => isSameDay(new Date(entry.date), date))
        .reduce((sum, entry) => sum + entry.minutes, 0)
      return {
        label: formatDayLabel(date),
        value: minutes / 60,
      }
    })
  }, [normalizedEntries, weeklyDates])

  const weeklyEntries = useMemo(() => {
    return normalizedEntries
      .filter((entry) => {
        const entryDate = new Date(entry.date)
        return weeklyDates.some((date) => isSameDay(entryDate, date))
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [normalizedEntries, weeklyDates])

  const mostActive = useMemo(() => {
    const map = new Map()
    weeklyEntries.forEach((entry) => {
      const id = entry.user_id || entry.user?.id
      if (!id) return
      const current = map.get(id) || {
        id,
        name: entry.user?.full_name || 'Unknown',
        avatar: entry.user?.avatar_url,
        minutes: 0,
      }
      current.minutes += entry.minutes || 0
      map.set(id, current)
    })
    return Array.from(map.values())
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3)
  }, [weeklyEntries])

  const detailedEntries = useMemo(() => {
    return normalizedEntries
      .filter((entry) => {
        if (selectedClient !== 'all' && (entry.client_id || entry.client?.id) !== selectedClient) return false
        if (selectedEmployee !== 'all' && (entry.user_id || entry.user?.id) !== selectedEmployee) return false
        if (billableFilter === 'billable' && !entry.billable) return false
        if (billableFilter === 'non-billable' && entry.billable) return false
        if (searchText.trim()) {
          const haystack = [
            entry.description,
            entry.ticket?.title,
            entry.ticket?.ticket_id,
            entry.client?.name,
            entry.user?.full_name,
          ].filter(Boolean).join(' ').toLowerCase()
          return haystack.includes(searchText.trim().toLowerCase())
        }
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [billableFilter, normalizedEntries, searchText, selectedClient, selectedEmployee])

  const maxClientMinutes = Math.max(...topClients.map((client) => client.minutes), 1)
  const maxEmployeeMinutes = Math.max(...topEmployees.map((emp) => emp.minutes), 1)

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Time Reports"
        subtitle={`${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="detailed">Detailed</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold">{formatDecimalHours(totalMinutes / 60)}</p>
                  <p className="text-xs text-muted-foreground">This month</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Billable Hours</p>
                  <p className="text-2xl font-bold">{formatDecimalHours(billableMinutes / 60)}</p>
                  <p className="text-xs text-muted-foreground">Billable</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Non-billable Hours</p>
                  <p className="text-2xl font-bold">{formatDecimalHours(nonBillableMinutes / 60)}</p>
                  <p className="text-xs text-muted-foreground">Internal</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">Avg Daily Hours</p>
                  <p className="text-2xl font-bold">{formatDecimalHours(avgDailyMinutes / 60)}</p>
                  <p className="text-xs text-muted-foreground">Across month</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Daily hours trend
                  </CardTitle>
                  <CardDescription>Hours logged per day this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <AreaChart data={dailyTotals} height={220} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-4 w-4" />
                    Billable split
                  </CardTitle>
                  <CardDescription>Billable vs non-billable</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-3">
                  <DonutChart
                    value={billableMinutes}
                    total={Math.max(totalMinutes, 1)}
                    label="Billable"
                  />
                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <span>Billable: {formatDecimalHours(billableMinutes / 60)}</span>
                    <span>Non-billable: {formatDecimalHours(nonBillableMinutes / 60)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Top Clients</CardTitle>
                  <CardDescription>Highest hours this month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topClients.length === 0 && (
                    <p className="text-sm text-muted-foreground">No client activity this month.</p>
                  )}
                  {topClients.map((client) => (
                    <div key={client.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{client.name}</span>
                        <span>{formatDecimalHours(client.minutes / 60)}</span>
                      </div>
                      <Progress value={(client.minutes / maxClientMinutes) * 100} />
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Top Team Members</CardTitle>
                  <CardDescription>Most hours logged this month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {topEmployees.length === 0 && (
                    <p className="text-sm text-muted-foreground">No team activity this month.</p>
                  )}
                  {topEmployees.map((member) => (
                    <div key={member.id} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{member.name}</span>
                        <span>{formatDecimalHours(member.minutes / 60)}</span>
                      </div>
                      <Progress value={(member.minutes / maxEmployeeMinutes) * 100} />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="weekly">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Weekly project report
                  </CardTitle>
                  <CardDescription>Last 7 days of time tracked</CardDescription>
                </CardHeader>
                <CardContent>
                  <BarChart data={weeklyTotals} height={220} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Most Active</CardTitle>
                  <CardDescription>Last 7 days</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mostActive.length === 0 && (
                    <p className="text-sm text-muted-foreground">No time tracked this week.</p>
                  )}
                  {mostActive.map((member) => (
                    <div key={member.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {formatDecimalHours(member.minutes / 60)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>Latest time entries</CardTitle>
                  <CardDescription>Recent time tracked this week</CardDescription>
                </div>
                <Select value={weeklyLimit} onValueChange={setWeeklyLimit}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Show latest entries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">Show latest 10</SelectItem>
                    <SelectItem value="20">Show latest 20</SelectItem>
                    <SelectItem value="50">Show latest 50</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Team Member</th>
                        <th className="text-left p-3 font-medium">Description</th>
                        <th className="text-left p-3 font-medium">Client</th>
                        <th className="text-right p-3 font-medium">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyEntries.slice(0, Number(weeklyLimit)).map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={entry.user?.avatar_url} />
                                <AvatarFallback className="text-[10px]">{getInitials(entry.user?.full_name || 'NA')}</AvatarFallback>
                              </Avatar>
                              <span>{entry.user?.full_name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{entry.description || entry.ticket?.title || 'No description'}</span>
                              {entry.ticket?.ticket_id && (
                                <span className="text-xs text-muted-foreground">{entry.ticket.ticket_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <span>{entry.client?.name || 'Unassigned'}</span>
                          </td>
                          <td className="p-3 text-right">
                            {formatHours(entry.minutes || 0)}
                          </td>
                        </tr>
                      ))}
                      {weeklyEntries.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-sm text-muted-foreground">
                            No time entries recorded this week.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detailed">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Detailed time report</CardTitle>
                <CardDescription>Filter and drill into time entries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Clients</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger className="w-60">
                      <SelectValue placeholder="Team member" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Team Members</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={billableFilter} onValueChange={setBillableFilter}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Billable" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="billable">Billable</SelectItem>
                      <SelectItem value="non-billable">Non-billable</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search description, client, ticket..."
                    className="flex-1 min-w-[240px]"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-3 font-medium">Date</th>
                        <th className="text-left p-3 font-medium">Team Member</th>
                        <th className="text-left p-3 font-medium">Client</th>
                        <th className="text-left p-3 font-medium">Work</th>
                        <th className="text-right p-3 font-medium">Duration</th>
                        <th className="text-right p-3 font-medium">Billable</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedEntries.slice(0, 100).map((entry) => (
                        <tr key={entry.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 text-sm">{formatDate(entry.date)}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={entry.user?.avatar_url} />
                                <AvatarFallback className="text-[10px]">{getInitials(entry.user?.full_name || 'NA')}</AvatarFallback>
                              </Avatar>
                              <span>{entry.user?.full_name || 'Unknown'}</span>
                            </div>
                          </td>
                          <td className="p-3">{entry.client?.name || 'Unassigned'}</td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className="font-medium">{entry.description || entry.ticket?.title || 'No description'}</span>
                              {entry.ticket?.ticket_id && (
                                <span className="text-xs text-muted-foreground">{entry.ticket.ticket_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right">{formatHours(entry.minutes || 0)}</td>
                          <td className="p-3 text-right">
                            <Badge className={entry.billable ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'}>
                              {entry.billable ? 'Billable' : 'Non-billable'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                      {detailedEntries.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                            No time entries match your filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <ReportFooter />
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
      <ReportHeader
        title="Profitability Report"
        subtitle={`${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`}
      />
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
      <ReportFooter />
    </div>
  )
}

// Payroll Report Component
function PayrollReport({ employees, timeEntries }) {
  const [startDate, setStartDate] = useState(() => {
    // Default to 2 weeks ago
    const d = new Date()
    d.setDate(d.getDate() - 14)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })
  const [selectedMembers, setSelectedMembers] = useState([])
  const [showMemberSelector, setShowMemberSelector] = useState(false)

  // Quick date range presets
  const setDateRange = (preset) => {
    const today = new Date()
    const end = today.toISOString().split('T')[0]
    let start
    
    switch (preset) {
      case 'week':
        start = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0]
        break
      case '2weeks':
        start = new Date(today.setDate(today.getDate() - 14)).toISOString().split('T')[0]
        break
      case 'month':
        start = new Date(today.setMonth(today.getMonth() - 1)).toISOString().split('T')[0]
        break
      case 'lastPayroll':
        // Assuming bi-weekly payroll, find last period
        const dayOfMonth = new Date().getDate()
        if (dayOfMonth <= 15) {
          start = new Date(today.getFullYear(), today.getMonth() - 1, 16).toISOString().split('T')[0]
          setEndDate(new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0])
        } else {
          start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]
          setEndDate(new Date(today.getFullYear(), today.getMonth(), 15).toISOString().split('T')[0])
        }
        break
      default:
        start = new Date(today.setDate(today.getDate() - 14)).toISOString().split('T')[0]
    }
    
    setStartDate(start)
    if (preset !== 'lastPayroll') setEndDate(end)
  }

  // Toggle member selection
  const toggleMember = (memberId) => {
    setSelectedMembers(prev => 
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    )
  }

  // Select all / deselect all
  const toggleAllMembers = () => {
    if (selectedMembers.length === employees.length) {
      setSelectedMembers([])
    } else {
      setSelectedMembers(employees.map(e => e.id))
    }
  }

  // Calculate hours for each selected member in date range
  const payrollData = useMemo(() => {
    const membersToShow = selectedMembers.length > 0 
      ? employees.filter(e => selectedMembers.includes(e.id))
      : employees

    return membersToShow.map(member => {
      const memberEntries = timeEntries.filter(entry => {
        if (entry.user_id !== member.id) return false
        const entryDate = entry.date
        if (!entryDate) return false
        return entryDate >= startDate && entryDate <= endDate
      })

      const totalMinutes = memberEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
      const billableMinutes = memberEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.minutes || 0), 0)
      const nonBillableMinutes = totalMinutes - billableMinutes

      // Group by client
      const clientBreakdown = {}
      memberEntries.forEach(entry => {
        const clientName = entry.client?.name || 'No Client'
        if (!clientBreakdown[clientName]) {
          clientBreakdown[clientName] = { minutes: 0, billable: 0 }
        }
        clientBreakdown[clientName].minutes += entry.minutes || 0
        if (entry.billable) clientBreakdown[clientName].billable += entry.minutes || 0
      })

      // Group by date for daily breakdown
      const dailyBreakdown = {}
      memberEntries.forEach(entry => {
        const date = entry.date
        if (!dailyBreakdown[date]) {
          dailyBreakdown[date] = 0
        }
        dailyBreakdown[date] += entry.minutes || 0
      })

      return {
        ...member,
        totalMinutes,
        totalHours: totalMinutes / 60,
        billableMinutes,
        billableHours: billableMinutes / 60,
        nonBillableMinutes,
        nonBillableHours: nonBillableMinutes / 60,
        entries: memberEntries.length,
        clientBreakdown,
        dailyBreakdown,
        hourlyRate: member.hourly_cost || 0,
        estimatedPay: (totalMinutes / 60) * (member.hourly_cost || 0),
      }
    }).sort((a, b) => b.totalMinutes - a.totalMinutes)
  }, [employees, timeEntries, selectedMembers, startDate, endDate])

  // Totals
  const totals = useMemo(() => ({
    totalHours: payrollData.reduce((sum, m) => sum + m.totalHours, 0),
    billableHours: payrollData.reduce((sum, m) => sum + m.billableHours, 0),
    nonBillableHours: payrollData.reduce((sum, m) => sum + m.nonBillableHours, 0),
    totalEntries: payrollData.reduce((sum, m) => sum + m.entries, 0),
    estimatedPay: payrollData.reduce((sum, m) => sum + m.estimatedPay, 0),
  }), [payrollData])

  // Calculate days in range
  const daysInRange = useMemo(() => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
  }, [startDate, endDate])

  return (
    <div className="space-y-6">
      <ReportHeader
        title="Payroll / Contractor Hours Report"
        subtitle={`${formatDate(startDate)} - ${formatDate(endDate)} (${daysInRange} days)`}
      />

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Date Range */}
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-44"
              />
            </div>
            
            {/* Quick Presets */}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDateRange('week')}>
                Last 7 Days
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDateRange('2weeks')}>
                Last 2 Weeks
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDateRange('month')}>
                Last Month
              </Button>
            </div>
          </div>

          {/* Team Member Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Team Members ({selectedMembers.length === 0 ? 'All' : selectedMembers.length} selected)
              </label>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={toggleAllMembers}
                >
                  {selectedMembers.length === employees.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowMemberSelector(!showMemberSelector)}
                >
                  {showMemberSelector ? 'Hide' : 'Choose Members'}
                </Button>
              </div>
            </div>
            
            {/* Selected members chips */}
            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedMembers.map(memberId => {
                  const member = employees.find(e => e.id === memberId)
                  return (
                    <Badge 
                      key={memberId} 
                      variant="secondary"
                      className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => toggleMember(memberId)}
                    >
                      {member?.full_name}
                      <X className="h-3 w-3" />
                    </Badge>
                  )
                })}
              </div>
            )}
            
            {/* Member selector dropdown */}
            <AnimatePresence>
              {showMemberSelector && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-3 bg-muted/50 rounded-lg">
                    {employees.map(member => (
                      <button
                        key={member.id}
                        onClick={() => toggleMember(member.id)}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg text-left transition-colors",
                          selectedMembers.includes(member.id)
                            ? "bg-brand-orange text-white"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-xs">{getInitials(member.full_name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.full_name}</p>
                          <p className="text-xs opacity-70 truncate">{member.email}</p>
                        </div>
                        {selectedMembers.includes(member.id) && (
                          <Check className="h-4 w-4 shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Team Members</p>
                <p className="text-2xl font-bold">{payrollData.length}</p>
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
                <p className="text-sm text-muted-foreground">Total Hours</p>
                <p className="text-2xl font-bold">{formatDecimalHours(totals.totalHours)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <DollarSign className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billable Hours</p>
                <p className="text-2xl font-bold">{formatDecimalHours(totals.billableHours)}</p>
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
                <p className="text-sm text-muted-foreground">Time Entries</p>
                <p className="text-2xl font-bold">{totals.totalEntries}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <Wallet className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Est. Payroll</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.estimatedPay)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Hours by Team Member
          </CardTitle>
          <CardDescription>
            {formatDate(startDate)} to {formatDate(endDate)} • {daysInRange} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium">Team Member</th>
                  <th className="text-right p-3 font-medium">Total Hours</th>
                  <th className="text-right p-3 font-medium">Billable</th>
                  <th className="text-right p-3 font-medium">Non-Billable</th>
                  <th className="text-right p-3 font-medium">Entries</th>
                  <th className="text-right p-3 font-medium">Hourly Rate</th>
                  <th className="text-right p-3 font-medium">Est. Pay</th>
                </tr>
              </thead>
              <tbody>
                {payrollData.map((member) => (
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
                    <td className="p-3 text-right font-semibold text-lg">
                      {formatDecimalHours(member.totalHours)}
                    </td>
                    <td className="p-3 text-right text-green-600">
                      {formatDecimalHours(member.billableHours)}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {formatDecimalHours(member.nonBillableHours)}
                    </td>
                    <td className="p-3 text-right">
                      {member.entries}
                    </td>
                    <td className="p-3 text-right text-muted-foreground">
                      {member.hourlyRate > 0 ? formatCurrency(member.hourlyRate) + '/hr' : '-'}
                    </td>
                    <td className="p-3 text-right font-medium text-green-600">
                      {member.hourlyRate > 0 ? formatCurrency(member.estimatedPay) : '-'}
                    </td>
                  </tr>
                ))}
                
                {/* Totals Row */}
                <tr className="bg-muted/50 font-semibold">
                  <td className="p-3">TOTAL</td>
                  <td className="p-3 text-right text-lg">{formatDecimalHours(totals.totalHours)}</td>
                  <td className="p-3 text-right text-green-600">{formatDecimalHours(totals.billableHours)}</td>
                  <td className="p-3 text-right text-muted-foreground">{formatDecimalHours(totals.nonBillableHours)}</td>
                  <td className="p-3 text-right">{totals.totalEntries}</td>
                  <td className="p-3 text-right">-</td>
                  <td className="p-3 text-right text-green-600 text-lg">{formatCurrency(totals.estimatedPay)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {payrollData.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No time entries found for the selected period and team members.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Client Breakdown per Member */}
      {payrollData.length > 0 && payrollData.some(m => Object.keys(m.clientBreakdown).length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Hours by Client
            </CardTitle>
            <CardDescription>
              Breakdown of hours per team member by client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {payrollData.filter(m => m.entries > 0).map((member) => (
                <div key={member.id} className="space-y-2">
                  <div className="flex items-center gap-2 font-medium">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-xs">{getInitials(member.full_name)}</AvatarFallback>
                    </Avatar>
                    {member.full_name}
                    <span className="text-muted-foreground font-normal">
                      ({formatDecimalHours(member.totalHours)} total)
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-8">
                    {Object.entries(member.clientBreakdown).map(([clientName, data]) => (
                      <div key={clientName} className="p-2 bg-muted/50 rounded-lg">
                        <p className="text-sm font-medium truncate">{clientName}</p>
                        <p className="text-lg font-semibold">{formatDecimalHours(data.minutes / 60)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ReportFooter />
    </div>
  )
}

// Main Reports Page
export default function Reports() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth()
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
  const defaultTab = 'time'

  // Fetch data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Validate session before fetching
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[Reports] Session invalid, cannot fetch data')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      // Fetch base data first
      const [employeesRes, clientsRes, clientRatesRes, timeEntriesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .in('role', ['team', 'admin'])
          .order('full_name'),
        supabase
          .from('clients')
          .select('*')
          .or('is_active.is.true,is_active.is.null')
          .order('name'),
        supabase
          .from('client_rates')
          .select('*'),
        // Use simpler query without joins for reliability
        supabase
          .from('time_entries')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      const employeesData = employeesRes.data || []
      const clientsData = clientsRes.data || []
      const rawTimeEntries = timeEntriesRes.data || []

      console.log('[Reports] Fetched time entries:', rawTimeEntries.length)
      
      // Normalize time entries and add user/client data
      const userMap = employeesData.reduce((acc, u) => ({ ...acc, [u.id]: u }), {})
      const clientMap = clientsData.reduce((acc, c) => ({ ...acc, [c.id]: c }), {})
      
      // Fetch ticket data for entries that have ticket_id
      const ticketIds = [...new Set(rawTimeEntries.map(e => e.ticket_id).filter(Boolean))]
      let ticketMap = {}
      if (ticketIds.length > 0) {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, title, ticket_id')
          .in('id', ticketIds)
        ticketMap = (tickets || []).reduce((acc, t) => ({ ...acc, [t.id]: t }), {})
      }
      
      const normalizedEntries = rawTimeEntries.map(entry => {
        // Normalize the date field
        const date = entry.date || 
          (entry.start_time ? entry.start_time.split('T')[0] : null) ||
          (entry.created_at ? entry.created_at.split('T')[0] : null)
        
        return {
          ...entry,
          date,
          minutes: entry.minutes ?? entry.duration_minutes ?? 0,
          billable: entry.billable ?? true,
          user: userMap[entry.user_id] || null,
          client: clientMap[entry.client_id] || null,
          ticket: ticketMap[entry.ticket_id] || null,
        }
      }).filter(e => e.date) // Only keep entries with valid dates

      console.log('[Reports] Normalized entries:', normalizedEntries.length, 
        'Total minutes:', normalizedEntries.reduce((sum, e) => sum + (e.minutes || 0), 0))

      setEmployees(employeesData)
      setClients(clientsData)
      setClientRates(clientRatesRes.data || [])
      setTimeEntries(normalizedEntries)
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

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) {
      console.log('[Reports] Auth still loading, waiting...')
      return
    }
    
    if (!user) {
      console.log('[Reports] No user after auth loaded')
      setLoading(false)
      return
    }
    
    console.log('[Reports] Auth ready, fetching data...')
    fetchData()
  }, [authLoading, user?.id])

  // Export to CSV
  const exportCSV = (type) => {
    const { data, filename } = buildExportData(type)
    const headers = Object.keys(data[0] || {})
    const csv = [
      headers.join(','),
      ...data.map((row) => headers.map((h) => `"${row[h] ?? ''}"`).join(',')),
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    toast({ title: 'CSV exported!', variant: 'success' })
  }

  const exportExcel = (type) => {
    const { data, filename } = buildExportData(type)
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report')
    XLSX.writeFile(workbook, filename.replace('.csv', '.xlsx'))
    toast({ title: 'Excel exported!', variant: 'success' })
  }

  const exportPDF = async (type) => {
    const { data, filename, title } = buildExportData(type, true)
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const logoDataUrl = await loadLogoDataUrl()

    const headerY = 40
    doc.setFillColor(255, 247, 237)
    doc.roundedRect(30, 20, pageWidth - 60, 70, 8, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('Brandastic', 110, headerY + 10)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text(title, 110, headerY + 30)
    doc.text(`Generated ${formatDate(new Date())}`, 110, headerY + 48)
    // Top logo removed per request (footer logo remains)

    autoTable(doc, {
      startY: 110,
      head: [Object.keys(data[0] || { Report: 'No data' })],
      body: data.map((row) => Object.values(row)),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [245, 158, 11] },
      margin: { left: 30, right: 30 },
    })

    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(
      'Brandastic PM • Confidential',
      40,
      pageHeight - 20
    )
    if (logoDataUrl) {
      const logoProps = doc.getImageProperties(logoDataUrl)
      const logoHeight = 10
      const logoWidth = (logoProps.width / logoProps.height) * logoHeight
      doc.addImage(logoDataUrl, logoProps.fileType || 'PNG', pageWidth - 60 - logoWidth, pageHeight - 28, logoWidth, logoHeight, undefined, 'FAST')
    }
    doc.save(filename.replace('.csv', '.pdf'))
    toast({ title: 'PDF exported!', variant: 'success' })
  }

  const buildExportData = (type, includeTitle = false) => {
    let data = []
    let filename = ''
    let title = 'Brandastic Report'

    if (type === 'team') {
      data = employees.map((emp) => ({
        Name: emp.full_name,
        Email: emp.email,
        Role: emp.role,
        'Target Hours': emp.target_hours_monthly || 120,
        'Hourly Cost': emp.hourly_cost || 50,
      }))
      filename = `team-report-${selectedYear}-${selectedMonth}.csv`
      title = `Team Report • ${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`
    } else if (type === 'entries') {
      data = timeEntries
        .filter((entry) => {
          const d = new Date(entry.date)
          return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear
        })
        .map((entry) => ({
          Date: formatDate(entry.date),
          Employee: entry.user?.full_name || 'Unknown',
          Client: entry.client?.name || 'Unknown',
          Description: entry.description || '',
          Minutes: entry.minutes || 0,
          Hours: ((entry.minutes || 0) / 60).toFixed(2),
          Billable: entry.billable ? 'Yes' : 'No',
        }))
      filename = `time-entries-${selectedYear}-${selectedMonth}.csv`
      title = `Time Entries • ${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`
    } else {
      data = clients.map((client) => ({
        Client: client.name,
        'Monthly Hours': client.monthly_hours || 0,
        'Monthly Revenue': (client.monthly_hours || 0) * 175,
        Active: client.is_active !== false ? 'Yes' : 'No',
      }))
      filename = `client-report-${selectedYear}-${selectedMonth}.csv`
      title = `Client Report • ${FULL_MONTHS[selectedMonth - 1]} ${selectedYear}`
    }

    return includeTitle ? { data, filename, title } : { data, filename }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
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
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-purple to-brand-blue">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
                <h1 className="text-2xl sm:text-4xl font-display font-bold">Reports</h1>
            </div>
              <p className="text-sm sm:text-lg text-muted-foreground">
              Comprehensive insights into clients, team performance, and profitability
            </p>
          </div>
          
            {/* Refresh button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="self-start"
            >
              <RefreshCw className={cn("h-4 w-4 sm:mr-2", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          
          {/* Controls Row - Date Selector & Export */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Date Selector */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
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
              <span className="px-2 font-medium min-w-[100px] sm:min-w-[140px] text-center text-sm">
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
            
            <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportExcel('entries')}
                className="gap-1"
            >
              <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportPDF('entries')}
                className="gap-1"
            >
              <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV('entries')}
                className="gap-1"
            >
              <Download className="h-4 w-4" />
                <span className="hidden sm:inline">CSV</span>
            </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="bg-muted/50 flex-wrap">
          <TabsTrigger value="time" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Time Reports</span>
            <span className="sm:hidden">Time</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2">
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">Payroll</span>
            <span className="sm:hidden">Pay</span>
          </TabsTrigger>
          <TabsTrigger value="client" className="gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Client Reports</span>
            <span className="sm:hidden">Clients</span>
          </TabsTrigger>
          <TabsTrigger value="team" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Team Reports</span>
            <span className="sm:hidden">Team</span>
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="profitability" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Profitability</span>
              <span className="sm:hidden">Profit</span>
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

        <TabsContent value="time">
          <motion.div variants={itemVariants}>
            <TimeReports
              employees={employees}
              clients={clients}
              timeEntries={timeEntries}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="payroll">
          <motion.div variants={itemVariants}>
            <PayrollReport
              employees={employees}
              timeEntries={timeEntries}
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
