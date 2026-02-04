import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Users, DollarSign, TrendingUp, TrendingDown, Target,
  Plus, Calendar, Building2, ChevronLeft, ChevronRight, Edit2,
  Trash2, Check, X, AlertCircle, Zap, BarChart3, PieChart,
  Download, Filter, RefreshCw, ArrowUpRight, ArrowDownRight,
  Loader2, MoreHorizontal, Pencil
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { supabase, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useGamification } from '../contexts/GamificationContext'
import { cn, formatDate, formatDuration, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
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

function getEfficiencyColor(ratio) {
  if (ratio >= 90) return 'text-green-500'
  if (ratio >= 70) return 'text-yellow-500'
  if (ratio >= 50) return 'text-orange-500'
  return 'text-red-500'
}

function getEfficiencyBg(ratio) {
  if (ratio >= 90) return 'bg-green-500'
  if (ratio >= 70) return 'bg-yellow-500'
  if (ratio >= 50) return 'bg-orange-500'
  return 'bg-red-500'
}

function getProfitColor(profit) {
  if (profit > 0) return 'text-green-500'
  if (profit < 0) return 'text-red-500'
  return 'text-muted-foreground'
}

export default function TimeTracking() {
  const { user, profile, isAdmin } = useAuth()
  const { toast } = useToast()
  const { trackTimeLogged } = useGamification()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // Data
  const [employees, setEmployees] = useState([])
  const [clients, setClients] = useState([])
  const [clientRates, setClientRates] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [myTimeEntries, setMyTimeEntries] = useState([])
  
  // Selected month/year
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Dialogs
  const [addTimeDialogOpen, setAddTimeDialogOpen] = useState(false)
  const [editEmployeeDialogOpen, setEditEmployeeDialogOpen] = useState(false)
  const [editClientRateDialogOpen, setEditClientRateDialogOpen] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState(null)
  const [selectedClient, setSelectedClient] = useState(null)
  
  // Edit time entry
  const [editTimeDialogOpen, setEditTimeDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [editEntryData, setEditEntryData] = useState({
    description: '',
    minutes: 0,
    billable: true,
  })
  const [savingEntry, setSavingEntry] = useState(false)
  const [deletingEntry, setDeletingEntry] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState(null)
  
  // Time entry form
  const [timeEntry, setTimeEntry] = useState({
    client_id: '',
    ticket_id: '',
    description: '',
    hours: '',
    minutes: '',
    date: new Date().toISOString().split('T')[0],
    billable: true,
  })
  const [availableTickets, setAvailableTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  // Fetch tickets when client changes
  const fetchTicketsForClient = async (clientId) => {
    if (!clientId) {
      setAvailableTickets([])
      return
    }
    setLoadingTickets(true)
    try {
      const { data } = await supabase
        .from('tickets')
        .select('id, title, ticket_id, status')
        .eq('client_id', clientId)
        .neq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(50)
      setAvailableTickets(data || [])
    } catch (error) {
      console.error('Error fetching tickets:', error)
      setAvailableTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }

  const [fetchError, setFetchError] = useState(null)

  // Fetch all data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)

    try {
      // Validate session before fetching - this refreshes token if expiring
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[TimeTracking] Session invalid, cannot fetch data')
        setFetchError('Session expired. Please refresh the page or log in again.')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
      const endDate = selectedMonth === 12
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`

      // Fetch time entries with a simpler, more reliable query
      // We'll filter by date OR start_time, handling entries that might only have one
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
        // Simpler query: fetch all entries without complex joins
        supabase
          .from('time_entries')
          .select('*')
          .order('created_at', { ascending: false }),
      ])

      // Filter time entries by date range client-side for reliability
      const allEntries = timeEntriesRes.data || []
      const filteredEntries = allEntries.filter(entry => {
        // Determine the entry date from multiple possible fields
        const entryDate = entry.date || 
          (entry.start_time ? entry.start_time.split('T')[0] : null) ||
          (entry.created_at ? entry.created_at.split('T')[0] : null)
        
        if (!entryDate) return false
        
        return entryDate >= startDate && entryDate < endDate
      })

      // Fetch user profiles for display
      const userIds = [...new Set(filteredEntries.map(e => e.user_id).filter(Boolean))]
      let userMap = {}
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, hourly_cost')
          .in('id', userIds)
        userMap = (users || []).reduce((acc, u) => ({ ...acc, [u.id]: u }), {})
      }

      // Fetch tickets for display (including client_id)
      const ticketIds = [...new Set(filteredEntries.map(e => e.ticket_id).filter(Boolean))]
      let ticketMap = {}
      if (ticketIds.length > 0) {
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, title, ticket_id, client_id')
          .in('id', ticketIds)
        ticketMap = (tickets || []).reduce((acc, t) => ({ ...acc, [t.id]: t }), {})
      }

      // Build client map for quick lookup
      const clientMap = (clientsRes.data || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {})

      const normalizedEntries = filteredEntries.map((entry) => {
        const ticket = ticketMap[entry.ticket_id] || null
        const client = ticket?.client_id ? clientMap[ticket.client_id] : null
        
        return {
          ...entry,
          minutes: entry.minutes ?? entry.duration_minutes ?? 0,
          date:
            entry.date ||
            (entry.start_time ? entry.start_time.split('T')[0] : entry.created_at?.split('T')[0]),
          billable: entry.billable ?? true,
          user: userMap[entry.user_id] || null,
          ticket,
          client,
        }
      })

      setEmployees(employeesRes.data || [])
      setClients(clientsRes.data || [])
      setClientRates(clientRatesRes.data || [])
      setTimeEntries(normalizedEntries)
      
      // Filter for current user's entries
      const currentUserId = user?.id
      const myEntries = currentUserId 
        ? normalizedEntries.filter(te => te.user_id === currentUserId)
        : []
      setMyTimeEntries(myEntries)
      
      // Debug logging for troubleshooting
      console.log('[TimeTracking] Fetched entries:', {
        totalFetched: allEntries.length,
        afterDateFilter: filteredEntries.length,
        normalized: normalizedEntries.length,
        myEntries: myEntries.length,
        dateRange: { startDate, endDate },
        userId: currentUserId,
        sampleEntry: allEntries[0] || 'none',
        timeEntriesError: timeEntriesRes.error,
      })
    } catch (error) {
      console.error('Error fetching time tracking data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (user?.id) {
      fetchData()
    }
  }, [selectedMonth, selectedYear, user?.id])

  // Calculate employee stats
  const getEmployeeStats = (employeeId) => {
    const entries = timeEntries.filter(te => te.user_id === employeeId)
    const employee = employees.find(e => e.id === employeeId)
    
    const totalMinutes = entries.reduce((sum, te) => sum + te.minutes, 0)
    const billableMinutes = entries.filter(te => te.billable).reduce((sum, te) => sum + te.minutes, 0)
    const targetMinutes = (employee?.target_hours_monthly || 120) * 60
    const efficiency = targetMinutes > 0 ? (totalMinutes / targetMinutes) * 100 : 0
    const cost = (totalMinutes / 60) * (employee?.hourly_cost || 0)
    
    return {
      totalHours: totalMinutes / 60,
      billableHours: billableMinutes / 60,
      targetHours: employee?.target_hours_monthly || 120,
      efficiency: Math.round(efficiency),
      cost,
      entriesCount: entries.length,
    }
  }

  // Calculate client stats
  const getClientStats = (clientId) => {
    const entries = timeEntries.filter(te => te.client_id === clientId)
    const client = clients.find(c => c.id === clientId)
    const rate = clientRates.find(cr => cr.client_id === clientId)?.hourly_rate || 75
    
    const totalMinutes = entries.reduce((sum, te) => sum + te.minutes, 0)
    const billableMinutes = entries.filter(te => te.billable).reduce((sum, te) => sum + te.minutes, 0)
    const revenue = (billableMinutes / 60) * rate
    const cost = entries.reduce((sum, te) => sum + (te.minutes / 60) * (te.user?.hourly_cost || 0), 0)
    const profit = revenue - cost
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0
    
    return {
      totalHours: totalMinutes / 60,
      billableHours: billableMinutes / 60,
      budgetedHours: client?.monthly_hours || 0,
      billingRate: rate,
      revenue,
      cost,
      profit,
      margin: Math.round(margin),
    }
  }

  // Add time entry
  const handleAddTimeEntry = async () => {
    if (!timeEntry.client_id) {
      toast({ title: 'Select a client', variant: 'destructive' })
      return
    }

    const totalMinutes = (parseInt(timeEntry.hours) || 0) * 60 + (parseInt(timeEntry.minutes) || 0)
    if (totalMinutes <= 0) {
      toast({ title: 'Enter valid time', variant: 'destructive' })
      return
    }

    try {
      const startTime = new Date(timeEntry.date)
      startTime.setHours(9, 0, 0, 0)
      const endTime = new Date(startTime.getTime() + totalMinutes * 60000)

      await supabase.from('time_entries').insert({
        user_id: user.id,
        client_id: timeEntry.client_id,
        ticket_id: timeEntry.ticket_id || null,
        description: timeEntry.description,
        minutes: totalMinutes,
        date: timeEntry.date,
        billable: timeEntry.billable,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_minutes: totalMinutes,
        is_running: false,
      })

      const taskName = availableTickets.find(t => t.id === timeEntry.ticket_id)?.title
      toast({ 
        title: '✅ Time logged!', 
        description: taskName ? `Logged to: ${taskName}` : undefined,
        variant: 'success' 
      })
      
      // Track for gamification (XP, achievements)
      trackTimeLogged(totalMinutes)
      
      setAddTimeDialogOpen(false)
      setTimeEntry({
        client_id: '',
        ticket_id: '',
        description: '',
        hours: '',
        minutes: '',
        date: new Date().toISOString().split('T')[0],
        billable: true,
      })
      setAvailableTickets([])
      fetchData(true)
    } catch (error) {
      toast({ title: 'Error logging time', variant: 'destructive' })
    }
  }

  // Open edit dialog for a time entry
  const openEditDialog = (entry) => {
    setEditingEntry(entry)
    setEditEntryData({
      description: entry.description || '',
      minutes: entry.minutes || 0,
      billable: entry.billable ?? true,
    })
    setEditTimeDialogOpen(true)
  }

  // Save edited time entry
  const handleSaveEntry = async () => {
    if (!editingEntry) return
    
    setSavingEntry(true)
    try {
      const { error } = await supabase
        .from('time_entries')
        .update({
          description: editEntryData.description,
          minutes: editEntryData.minutes,
          billable: editEntryData.billable,
        })
        .eq('id', editingEntry.id)
      
      if (error) throw error
      
      toast({ title: '✅ Time entry updated', variant: 'success' })
      setEditTimeDialogOpen(false)
      setEditingEntry(null)
      fetchData(true)
    } catch (error) {
      console.error('Error updating time entry:', error)
      toast({ title: 'Error updating entry', variant: 'destructive' })
    } finally {
      setSavingEntry(false)
    }
  }

  // Open delete confirmation dialog
  const confirmDeleteEntry = (entryId) => {
    setEntryToDelete(entryId)
    setDeleteConfirmOpen(true)
  }
  
  // Delete a time entry (after confirmation)
  const handleDeleteEntry = async () => {
    if (!entryToDelete) return
    
    setDeletingEntry(true)
    try {
      const { error } = await supabase
        .from('time_entries')
        .delete()
        .eq('id', entryToDelete)
      
      if (error) throw error
      
      toast({ title: '🗑️ Time entry deleted', variant: 'success' })
      setDeleteConfirmOpen(false)
      setEditTimeDialogOpen(false)
      setEditingEntry(null)
      setEntryToDelete(null)
      fetchData(true)
    } catch (error) {
      console.error('Error deleting time entry:', error)
      toast({ title: 'Error deleting entry', variant: 'destructive' })
    } finally {
      setDeletingEntry(false)
    }
  }

  // Update employee settings (admin only)
  const handleUpdateEmployee = async () => {
    if (!selectedEmployee) return

    try {
      await supabase
        .from('profiles')
        .update({
          hourly_cost: selectedEmployee.hourly_cost,
          target_hours_monthly: selectedEmployee.target_hours_monthly,
        })
        .eq('id', selectedEmployee.id)

      toast({ title: 'Employee updated', variant: 'success' })
      setEditEmployeeDialogOpen(false)
      fetchData(true)
    } catch (error) {
      toast({ title: 'Error updating employee', variant: 'destructive' })
    }
  }

  // Update client rate (admin only)
  const handleUpdateClientRate = async () => {
    if (!selectedClient) return

    try {
      const existing = clientRates.find(cr => cr.client_id === selectedClient.id)
      
      if (existing) {
        await supabase
          .from('client_rates')
          .update({ hourly_rate: selectedClient.hourly_rate })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('client_rates')
          .insert({
            client_id: selectedClient.id,
            hourly_rate: selectedClient.hourly_rate,
          })
      }

      toast({ title: 'Client rate updated', variant: 'success' })
      setEditClientRateDialogOpen(false)
      fetchData(true)
    } catch (error) {
      toast({ title: 'Error updating rate', variant: 'destructive' })
    }
  }

  // My stats
  const myStats = getEmployeeStats(user?.id)
  const myTotalMinutes = myTimeEntries.reduce((sum, te) => sum + te.minutes, 0)
  const myBillableMinutes = myTimeEntries.filter(te => te.billable).reduce((sum, te) => sum + te.minutes, 0)

  // Privacy: non-admins only see their own time data
  const visibleEmployees = isAdmin ? employees : employees.filter(e => e.id === user?.id)
  const visibleTimeEntries = isAdmin ? timeEntries : myTimeEntries

  // Calculate totals
  const totalTrackedMinutes = visibleTimeEntries.reduce((sum, te) => sum + te.minutes, 0)
  const totalBillableMinutes = visibleTimeEntries.filter(te => te.billable).reduce((sum, te) => sum + te.minutes, 0)
  const totalTrackedHours = totalTrackedMinutes / 60
  const totalBillableHours = totalBillableMinutes / 60
  const totalRevenue = visibleTimeEntries.reduce((sum, entry) => {
    const rate = clientRates.find(cr => cr.client_id === entry.client_id)?.hourly_rate || 75
    return sum + (entry.billable ? (entry.minutes / 60) * rate : 0)
  }, 0)
  const totalCost = visibleTimeEntries.reduce((sum, entry) => {
    const costRate = entry.user?.hourly_cost || 0
    return sum + (entry.minutes / 60) * costRate
  }, 0)
  const totalProfit = totalRevenue - totalCost
  const avgEfficiency = visibleEmployees.length > 0
    ? visibleEmployees.reduce((sum, e) => sum + getEmployeeStats(e.id).efficiency, 0) / visibleEmployees.length
    : 0

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto overflow-x-hidden"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-blue to-brand-teal">
                <Clock className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold">Time Tracking</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Track time, monitor efficiency, and analyze profitability
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button onClick={() => setAddTimeDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Log Time
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Month Selector */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3 mb-8">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (selectedMonth === 1) {
              setSelectedMonth(12)
              setSelectedYear(y => y - 1)
            } else {
              setSelectedMonth(m => m - 1)
            }
          }}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={selectedMonth.toString()}
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
          >
            <SelectTrigger className="w-40 max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={selectedYear.toString()}
            onValueChange={(v) => setSelectedYear(parseInt(v))}
          >
            <SelectTrigger className="w-24 max-w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026, 2027].map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            if (selectedMonth === 12) {
              setSelectedMonth(1)
              setSelectedYear(y => y + 1)
            } else {
              setSelectedMonth(m => m + 1)
            }
          }}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </motion.div>

      {/* My Stats Card (for team members) */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="bg-gradient-to-r from-brand-orange/10 via-brand-coral/5 to-transparent border-brand-orange/20">
          <CardContent className="p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-lg bg-brand-orange text-white">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="text-xl font-bold">{profile?.full_name}'s Time This Month</h3>
                <p className="text-sm text-muted-foreground">
                  Target: {myStats.targetHours}h/month
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-6 sm:gap-8">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {(Math.round(myStats.totalHours * 10) / 10).toFixed(1)}h
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDuration(myTotalMinutes)}</p>
                  <p className="text-sm text-muted-foreground">Tracked</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {(Math.round(myStats.billableHours * 10) / 10).toFixed(1)}h
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDuration(myBillableMinutes)}</p>
                  <p className="text-sm text-muted-foreground">Billable</p>
                </div>
                <div className="text-center">
                  <div className={cn("text-3xl font-bold", getEfficiencyColor(myStats.efficiency))}>
                    {Math.round(myStats.efficiency)}%
                  </div>
                  <p className="text-sm text-muted-foreground">Efficiency</p>
                </div>
                <div className="w-full sm:w-32">
                  <Progress value={Math.min(100, myStats.efficiency)} className="h-3" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 md:grid-cols-5 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                  <p className="text-2xl font-bold mt-1">
                    {Math.round(totalTrackedHours)}h
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDuration(totalTrackedMinutes)}</p>
                </div>
                <Clock className="h-8 w-8 text-brand-blue/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Billable Hours</p>
                  <p className="text-2xl font-bold mt-1">
                    {Math.round(totalBillableHours)}h
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDuration(totalBillableMinutes)}</p>
                </div>
                <Target className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Profit</p>
                  <p className={cn("text-2xl font-bold mt-1", getProfitColor(totalProfit))}>
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
                {totalProfit >= 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-500/50" />
                ) : (
                  <TrendingDown className="h-8 w-8 text-red-500/50" />
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Avg Efficiency</p>
                  <p className={cn("text-2xl font-bold mt-1", getEfficiencyColor(avgEfficiency))}>
                    {Math.round(avgEfficiency)}%
                  </p>
                </div>
                <Zap className="h-8 w-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Tabs */}
      <Tabs defaultValue={isAdmin ? "employees" : "entries"} className="space-y-6">
        <TabsList className="bg-muted/50">
          {isAdmin && (
            <TabsTrigger value="employees" className="gap-2">
              <Users className="h-4 w-4" />
              Team Efficiency
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="clients" className="gap-2">
              <Building2 className="h-4 w-4" />
              Client Profitability
            </TabsTrigger>
          )}
          <TabsTrigger value="entries" className="gap-2">
            <Clock className="h-4 w-4" />
            Time Entries
          </TabsTrigger>
        </TabsList>

        {/* Team Efficiency Tab */}
        {isAdmin && (
        <TabsContent value="employees">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Employee Efficiency Ratio</CardTitle>
                  {isAdmin && (
                    <p className="text-sm text-muted-foreground">
                      Click on an employee to edit their rate & target
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-brand-blue text-white">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Employee</th>
                        <th className="text-right py-3 px-4 font-medium">Hourly Cost</th>
                        <th className="text-right py-3 px-4 font-medium">Target Hours</th>
                        <th className="text-right py-3 px-4 font-medium">Tracked Hours</th>
                        <th className="text-right py-3 px-4 font-medium">Billable Hours</th>
                        <th className="text-center py-3 px-4 font-medium">Efficiency</th>
                        <th className="text-right py-3 px-4 font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleEmployees.map((employee, index) => {
                        const stats = getEmployeeStats(employee.id)
                        
                        return (
                          <motion.tr
                            key={employee.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => {
                              if (isAdmin) {
                                setSelectedEmployee({
                                  ...employee,
                                  hourly_cost: employee.hourly_cost || 0,
                                  target_hours_monthly: employee.target_hours_monthly || 120,
                                })
                                setEditEmployeeDialogOpen(true)
                              }
                            }}
                            className={cn(
                              "border-b hover:bg-muted/30 transition-colors",
                              isAdmin && "cursor-pointer",
                              index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                            )}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={employee.avatar_url} />
                                  <AvatarFallback className="text-xs">
                                    {getInitials(employee.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{employee.full_name}</p>
                                  <p className="text-xs text-muted-foreground capitalize">{employee.role}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {formatCurrency(employee.hourly_cost || 0)}/hr
                            </td>
                            <td className="py-3 px-4 text-right">
                              {stats.targetHours}h
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {Math.round(stats.totalHours * 10) / 10}h
                            </td>
                            <td className="py-3 px-4 text-right">
                              {Math.round(stats.billableHours * 10) / 10}h
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-20">
                                  <Progress 
                                    value={Math.min(100, stats.efficiency)} 
                                    className={cn("h-2", getEfficiencyBg(stats.efficiency))}
                                  />
                                </div>
                                <span className={cn("font-bold", getEfficiencyColor(stats.efficiency))}>
                                  {stats.efficiency}%
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-red-500">
                              {formatCurrency(stats.cost)}
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        )}

        {/* Client Profitability Tab */}
        {isAdmin && (
        <TabsContent value="clients">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Client Profitability Analysis</CardTitle>
                  {isAdmin && (
                    <p className="text-sm text-muted-foreground">
                      Click on a client to edit their billing rate
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-brand-purple text-white">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Client</th>
                        <th className="text-right py-3 px-4 font-medium">Billing Rate</th>
                        <th className="text-right py-3 px-4 font-medium">Budget Hours</th>
                        <th className="text-right py-3 px-4 font-medium">Worked Hours</th>
                        <th className="text-right py-3 px-4 font-medium text-green-200">Revenue</th>
                        <th className="text-right py-3 px-4 font-medium text-red-200">Cost</th>
                        <th className="text-right py-3 px-4 font-medium">Profit</th>
                        <th className="text-center py-3 px-4 font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client, index) => {
                        const stats = getClientStats(client.id)
                        
                        return (
                          <motion.tr
                            key={client.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            onClick={() => {
                              if (isAdmin) {
                                setSelectedClient({
                                  ...client,
                                  hourly_rate: stats.billingRate,
                                })
                                setEditClientRateDialogOpen(true)
                              }
                            }}
                            className={cn(
                              "border-b hover:bg-muted/30 transition-colors",
                              isAdmin && "cursor-pointer",
                              index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                            )}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: client.color || '#F7931E' }}
                                />
                                <span className="font-medium">{client.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {formatCurrency(stats.billingRate)}/hr
                            </td>
                            <td className="py-3 px-4 text-right">
                              {stats.budgetedHours}h
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              {Math.round(stats.totalHours * 10) / 10}h
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-green-600">
                              {formatCurrency(stats.revenue)}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-red-500">
                              {formatCurrency(stats.cost)}
                            </td>
                            <td className={cn("py-3 px-4 text-right font-mono font-bold", getProfitColor(stats.profit))}>
                              {formatCurrency(stats.profit)}
                              {stats.profit >= 0 ? (
                                <ArrowUpRight className="inline h-4 w-4 ml-1" />
                              ) : (
                                <ArrowDownRight className="inline h-4 w-4 ml-1" />
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center justify-center">
                                <Badge className={cn(
                                  stats.margin >= 30 ? "bg-green-500" :
                                  stats.margin >= 15 ? "bg-yellow-500" :
                                  stats.margin >= 0 ? "bg-orange-500" : "bg-red-500"
                                )}>
                                  {stats.margin}%
                                </Badge>
                              </div>
                            </td>
                          </motion.tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="bg-muted/50 font-bold">
                      <tr>
                        <td className="py-3 px-4">TOTALS</td>
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4"></td>
                        <td className="py-3 px-4 text-right">{Math.round(totalTrackedHours)}h</td>
                        <td className="py-3 px-4 text-right text-green-600">{formatCurrency(totalRevenue)}</td>
                        <td className="py-3 px-4 text-right text-red-500">{formatCurrency(totalCost)}</td>
                        <td className={cn("py-3 px-4 text-right", getProfitColor(totalProfit))}>
                          {formatCurrency(totalProfit)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
        )}

        {/* Time Entries Tab */}
        <TabsContent value="entries">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Time Entries</CardTitle>
                  <Badge variant="outline">
                      {visibleTimeEntries.length} entries
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium">Date</th>
                        <th className="text-left py-3 px-4 font-medium">Employee</th>
                        <th className="text-left py-3 px-4 font-medium">Client</th>
                        <th className="text-left py-3 px-4 font-medium">Task/Description</th>
                        <th className="text-right py-3 px-4 font-medium">Duration</th>
                        <th className="text-center py-3 px-4 font-medium">Billable</th>
                        <th className="text-center py-3 px-4 font-medium w-16">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleTimeEntries.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-muted-foreground">
                            No time entries for this month
                          </td>
                        </tr>
                      ) : (
                        visibleTimeEntries.map((entry, index) => {
                          const canEdit = entry.user_id === user?.id || isAdmin
                          return (
                            <motion.tr
                              key={entry.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: index * 0.02 }}
                              className={cn(
                                "border-b hover:bg-muted/30 transition-colors group",
                                index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                              )}
                            >
                              <td className="py-3 px-4 text-sm">
                                {formatDate(entry.date)}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7">
                                    <AvatarImage src={entry.user?.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                      {getInitials(entry.user?.full_name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="text-sm">{entry.user?.full_name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                {entry.client ? (
                                  <div className="flex items-center gap-2">
                                    {entry.client.logo_url ? (
                                      <img 
                                        src={entry.client.logo_url} 
                                        alt={entry.client.name}
                                        className="h-7 w-7 rounded-md object-contain bg-white border"
                                      />
                                    ) : (
                                      <div 
                                        className="h-7 w-7 rounded-md flex items-center justify-center text-white text-xs font-bold"
                                        style={{ backgroundColor: entry.client.color || '#F7931E' }}
                                      >
                                        {entry.client.name?.charAt(0)}
                                      </div>
                                    )}
                                    <span className="text-sm truncate max-w-[120px]">{entry.client.name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">—</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-sm max-w-xs">
                                <div>
                                  {entry.ticket?.title && (
                                    <p className="font-medium truncate">{entry.ticket.title}</p>
                                  )}
                                  <p className="text-muted-foreground truncate">
                                    {entry.description || (entry.ticket?.title ? '' : 'No description')}
                                  </p>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-medium">
                                {formatHours(entry.minutes)}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {entry.billable ? (
                                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {canEdit && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => openEditDialog(entry)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Edit Entry
                                      </DropdownMenuItem>
                                      <DropdownMenuItem 
                                        onClick={() => handleDeleteEntry(entry.id)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Entry
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </td>
                            </motion.tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Add Time Entry Dialog */}
      <Dialog open={addTimeDialogOpen} onOpenChange={setAddTimeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-orange" />
              Log Time
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Quick Time Templates */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Quick Add</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: '15m', minutes: 15 },
                  { label: '30m', minutes: 30 },
                  { label: '1h', minutes: 60 },
                  { label: '1.5h', minutes: 90 },
                  { label: '2h', minutes: 120 },
                  { label: '4h', minutes: 240 },
                  { label: '8h', minutes: 480 },
                ].map(preset => (
                  <Button
                    key={preset.label}
                    type="button"
                    variant={timeEntry.hours === String(preset.minutes / 60) ? "default" : "outline"}
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setTimeEntry(e => ({ 
                      ...e, 
                      hours: String(preset.minutes / 60),
                      minutes: preset.minutes 
                    }))}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="border-t pt-4">
              <Label>Client *</Label>
              <Select
                value={timeEntry.client_id}
                onValueChange={(v) => {
                  setTimeEntry(e => ({ ...e, client_id: v, ticket_id: '' }))
                  fetchTicketsForClient(v)
                }}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: c.color || '#F7931E' }}
                        />
                        {c.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Task Selection (Optional) */}
            {timeEntry.client_id && (
              <div>
                <Label>Task (optional)</Label>
                <Select
                  value={timeEntry.ticket_id}
                  onValueChange={(v) => setTimeEntry(e => ({ ...e, ticket_id: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={loadingTickets ? "Loading tasks..." : "Select task (optional)"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific task</SelectItem>
                    {availableTickets.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{t.ticket_id || t.id.substring(0, 6)}</span>
                          <span className="truncate max-w-[200px]">{t.title}</span>
                          {t.status === 'inprogress' && (
                            <span className="text-xs text-blue-500">• In Progress</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    {availableTickets.length === 0 && !loadingTickets && (
                      <div className="text-sm text-muted-foreground px-2 py-1">No active tasks for this client</div>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Link this time entry to a specific task</p>
              </div>
            )}
            
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={timeEntry.date}
                onChange={(e) => setTimeEntry(t => ({ ...t, date: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Duration *</Label>
              <div className="flex gap-2 mt-1.5">
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Hours"
                    value={timeEntry.hours}
                    onChange={(e) => setTimeEntry(t => ({ ...t, hours: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Input
                    type="number"
                    placeholder="Minutes"
                    max={59}
                    value={timeEntry.minutes}
                    onChange={(e) => setTimeEntry(t => ({ ...t, minutes: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Input
                value={timeEntry.description}
                onChange={(e) => setTimeEntry(t => ({ ...t, description: e.target.value }))}
                placeholder="What did you work on?"
                className="mt-1.5"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="billable"
                checked={timeEntry.billable}
                onChange={(e) => setTimeEntry(t => ({ ...t, billable: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="billable" className="cursor-pointer">Billable time</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTimeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTimeEntry}>
              <Check className="h-4 w-4 mr-2" />
              Log Time
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Employee Dialog (Admin) */}
      <Dialog open={editEmployeeDialogOpen} onOpenChange={setEditEmployeeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-blue" />
              Edit Employee Settings
            </DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar>
                  <AvatarImage src={selectedEmployee.avatar_url} />
                  <AvatarFallback>{getInitials(selectedEmployee.full_name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{selectedEmployee.full_name}</p>
                  <p className="text-sm text-muted-foreground capitalize">{selectedEmployee.role}</p>
                </div>
              </div>
              
              <div>
                <Label>Hourly Cost Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={selectedEmployee.hourly_cost}
                  onChange={(e) => setSelectedEmployee(emp => ({ 
                    ...emp, 
                    hourly_cost: parseFloat(e.target.value) || 0 
                  }))}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What you pay this employee per hour
                </p>
              </div>

              <div>
                <Label>Target Hours / Month</Label>
                <Input
                  type="number"
                  value={selectedEmployee.target_hours_monthly}
                  onChange={(e) => setSelectedEmployee(emp => ({ 
                    ...emp, 
                    target_hours_monthly: parseInt(e.target.value) || 0 
                  }))}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expected billable hours per month
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmployeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Rate Dialog (Admin) */}
      <Dialog open={editClientRateDialogOpen} onOpenChange={setEditClientRateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              Edit Client Billing Rate
            </DialogTitle>
          </DialogHeader>
          {selectedClient && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedClient.color || '#F7931E' }}
                >
                  {selectedClient.name?.[0]}
                </div>
                <div>
                  <p className="font-medium">{selectedClient.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Budget: {selectedClient.monthly_hours || 0} hrs/month
                  </p>
                </div>
              </div>
              
              <div>
                <Label>Hourly Billing Rate ($)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={selectedClient.hourly_rate}
                  onChange={(e) => setSelectedClient(c => ({ 
                    ...c, 
                    hourly_rate: parseFloat(e.target.value) || 0 
                  }))}
                  className="mt-1.5"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  What you charge this client per hour
                </p>
              </div>

              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200">
                <p className="text-sm">
                  <strong>Monthly Revenue:</strong>{' '}
                  <span className="text-green-600">
                    {formatCurrency((selectedClient.monthly_hours || 0) * (selectedClient.hourly_rate || 0))}
                  </span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClientRateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateClientRate}>
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Time Entry Dialog */}
      <Dialog open={editTimeDialogOpen} onOpenChange={setEditTimeDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-brand-orange" />
              Edit Time Entry
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={editingEntry.user?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(editingEntry.user?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">{editingEntry.user?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(editingEntry.date)}</p>
                  </div>
                </div>
                {editingEntry.ticket?.title && (
                  <Badge variant="outline" className="mt-1">
                    {editingEntry.ticket.title}
                  </Badge>
                )}
              </div>

              <div>
                <Label>Description / Notes</Label>
                <Input
                  value={editEntryData.description}
                  onChange={(e) => setEditEntryData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="What did you work on?"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    value={Math.floor(editEntryData.minutes / 60)}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value) || 0
                      const mins = editEntryData.minutes % 60
                      setEditEntryData(prev => ({ ...prev, minutes: hours * 60 + mins }))
                    }}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    value={editEntryData.minutes % 60}
                    onChange={(e) => {
                      const mins = Math.min(59, parseInt(e.target.value) || 0)
                      const hours = Math.floor(editEntryData.minutes / 60)
                      setEditEntryData(prev => ({ ...prev, minutes: hours * 60 + mins }))
                    }}
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-billable"
                  checked={editEntryData.billable}
                  onChange={(e) => setEditEntryData(prev => ({ ...prev, billable: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="edit-billable" className="cursor-pointer">
                  Billable time
                </Label>
              </div>
            </div>
          )}
          <DialogFooter className="flex justify-between">
            <Button 
              variant="destructive" 
              onClick={() => editingEntry && confirmDeleteEntry(editingEntry.id)}
              disabled={deletingEntry}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditTimeDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEntry} disabled={savingEntry}>
                {savingEntry ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Time Entry?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            Are you sure you want to delete this time entry? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteConfirmOpen(false)
                setEntryToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteEntry}
              disabled={deletingEntry}
            >
              {deletingEntry ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
