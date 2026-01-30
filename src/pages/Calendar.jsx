import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, AlertCircle, Users, Building2, 
  Plus, Filter, Eye, ArrowRight, Timer, Zap, CalendarPlus,
  CalendarX, ListTodo, CircleDashed, RefreshCw
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, 
         isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek,
         parseISO, isWithinInterval } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
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
} from '../components/ui/dialog'
import { Skeleton } from '../components/ui/skeleton'

const STATUS_COLORS = {
  todo: 'bg-gray-400',
  in_progress: 'bg-blue-500',
  review: 'bg-purple-500',
  done: 'bg-green-500',
}

export default function Calendar() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [tickets, setTickets] = useState([])
  const [unscheduledTickets, setUnscheduledTickets] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [clients, setClients] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [viewFilter, setViewFilter] = useState('all') // all, my-tasks
  const [clientFilter, setClientFilter] = useState('all') // all or client id
  const [memberFilter, setMemberFilter] = useState('all') // all or user id
  const [showUnscheduled, setShowUnscheduled] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [currentMonth])
  
  // Refetch when page becomes visible (user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [currentMonth])
  
  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      
      // Fetch tickets with due dates in this month range (with buffer for week view)
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
      
      const [ticketsRes, unscheduledRes, timeRes, clientsRes, membersRes] = await Promise.all([
        // Tickets WITH due dates in this month
        supabase
          .from('tickets')
          .select('*, client:client_id(id, name, logo_url), assignee:assigned_to(id, full_name, avatar_url)')
          .gte('due_date', calendarStart.toISOString().split('T')[0])
          .lte('due_date', calendarEnd.toISOString().split('T')[0])
          .order('due_date'),
        // Tickets WITHOUT due dates (unscheduled) - only active ones
        supabase
          .from('tickets')
          .select('*, client:client_id(id, name, logo_url), assignee:assigned_to(id, full_name, avatar_url)')
          .is('due_date', null)
          .not('status', 'in', '("closed","done")')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('time_entries')
          .select('*, client:client_id(id, name, logo_url), user:user_id(id, full_name, avatar_url)')
          .gte('date', calendarStart.toISOString().split('T')[0])
          .lte('date', calendarEnd.toISOString().split('T')[0]),
        supabase
          .from('clients')
          .select('id, name, logo_url')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('is_active', true)
          .order('full_name')
      ])
      
      setTickets(ticketsRes.data || [])
      setUnscheduledTickets(unscheduledRes.data || [])
      setTimeEntries(timeRes.data || [])
      setClients(clientsRes.data || [])
      setTeamMembers(membersRes.data || [])
    } catch (error) {
      console.error('Error fetching calendar data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
  }, [currentMonth])

  // Get events for a specific day
  const getEventsForDay = (day) => {
    const dayStr = format(day, 'yyyy-MM-dd')
    
    let dayTickets = tickets.filter(t => {
      if (!t.due_date) return false
      return t.due_date === dayStr || t.due_date.startsWith(dayStr)
    })
    
    let dayTimeEntries = timeEntries.filter(t => t.date === dayStr)
    
    // Apply view filter (my tasks)
    if (viewFilter === 'my-tasks') {
      dayTickets = dayTickets.filter(t => t.assigned_to === user?.id)
      dayTimeEntries = dayTimeEntries.filter(e => e.user_id === user?.id)
    }
    
    // Apply client filter
    if (clientFilter !== 'all') {
      dayTickets = dayTickets.filter(t => t.client_id === clientFilter)
      dayTimeEntries = dayTimeEntries.filter(e => e.client_id === clientFilter)
    }
    
    // Apply team member filter
    if (memberFilter !== 'all') {
      dayTickets = dayTickets.filter(t => t.assigned_to === memberFilter)
      dayTimeEntries = dayTimeEntries.filter(e => e.user_id === memberFilter)
    }
    
    const totalMinutes = dayTimeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
    
    return {
      tickets: dayTickets,
      timeEntries: dayTimeEntries,
      totalHours: totalMinutes / 60,
    }
  }

  // Get selected day details
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return null
    return getEventsForDay(selectedDate)
  }, [selectedDate, tickets, timeEntries, viewFilter, clientFilter, memberFilter, user])

  const navigateMonth = (direction) => {
    setCurrentMonth(prev => 
      direction === 'next' ? addMonths(prev, 1) : subMonths(prev, 1)
    )
  }

  const goToToday = () => {
    setCurrentMonth(new Date())
    setSelectedDate(new Date())
    setDetailsOpen(true)
  }

  // Stats for current month (respecting filters)
  const monthStats = useMemo(() => {
    let monthTickets = tickets.filter(t => 
      t.due_date && isSameMonth(parseISO(t.due_date), currentMonth)
    )
    let monthTimeEntries = timeEntries
    
    // Apply client filter
    if (clientFilter !== 'all') {
      monthTickets = monthTickets.filter(t => t.client_id === clientFilter)
      monthTimeEntries = monthTimeEntries.filter(e => e.client_id === clientFilter)
    }
    
    // Apply member filter
    if (memberFilter !== 'all') {
      monthTickets = monthTickets.filter(t => t.assigned_to === memberFilter)
      monthTimeEntries = monthTimeEntries.filter(e => e.user_id === memberFilter)
    }
    
    // Apply view filter
    if (viewFilter === 'my-tasks') {
      monthTickets = monthTickets.filter(t => t.assigned_to === user?.id)
      monthTimeEntries = monthTimeEntries.filter(e => e.user_id === user?.id)
    }
    
    const myTickets = monthTickets.filter(t => t.assigned_to === user?.id)
    const totalHours = monthTimeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60
    
    return {
      totalTasks: monthTickets.length,
      myTasks: myTickets.length,
      overdue: monthTickets.filter(t => 
        t.status !== 'done' && t.status !== 'closed' && new Date(t.due_date) < new Date()
      ).length,
      totalHours: totalHours.toFixed(1),
    }
  }, [tickets, timeEntries, currentMonth, user, clientFilter, memberFilter, viewFilter])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-orange to-orange-600 rounded-xl text-white">
              <CalendarIcon className="h-6 w-6" />
            </div>
            Calendar
          </h1>
          <p className="text-muted-foreground mt-1">
            View tasks, deadlines, and time logged
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* View Filter */}
          <Select value={viewFilter} onValueChange={setViewFilter}>
            <SelectTrigger className="w-[130px]">
              <Eye className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="my-tasks">My Tasks</SelectItem>
            </SelectContent>
          </Select>
          
          {/* Client Filter */}
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[160px]">
              <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map(client => (
                <SelectItem key={client.id} value={client.id}>
                  <div className="flex items-center gap-2">
                    {client.logo_url ? (
                      <img src={client.logo_url} alt="" className="w-4 h-4 rounded object-cover" />
                    ) : (
                      <div className="w-4 h-4 rounded bg-brand-orange/20 flex items-center justify-center text-[8px] font-bold text-brand-orange">
                        {client.name?.charAt(0)}
                      </div>
                    )}
                    <span className="truncate">{client.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Team Member Filter */}
          <Select value={memberFilter} onValueChange={setMemberFilter}>
            <SelectTrigger className="w-[160px]">
              <Users className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team</SelectItem>
              {teamMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-[8px]">
                        {member.full_name?.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{member.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
          
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
          
          {/* Clear filters button */}
          {(clientFilter !== 'all' || memberFilter !== 'all' || viewFilter !== 'all') && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                setClientFilter('all')
                setMemberFilter('all')
                setViewFilter('all')
              }}
              className="text-muted-foreground"
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>
      
      {/* Active Filters Indicator */}
      {(clientFilter !== 'all' || memberFilter !== 'all') && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">Showing:</span>
          {clientFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <Building2 className="h-3 w-3" />
              {clients.find(c => c.id === clientFilter)?.name || 'Client'}
            </Badge>
          )}
          {memberFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {teamMembers.find(m => m.id === memberFilter)?.full_name || 'Team Member'}
            </Badge>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <CheckCircle className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{monthStats.totalTasks}</p>
                <p className="text-xs text-muted-foreground">Tasks Due</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Users className="h-4 w-4 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{monthStats.myTasks}</p>
                <p className="text-xs text-muted-foreground">My Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{monthStats.overdue}</p>
                <p className="text-xs text-muted-foreground">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Timer className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{monthStats.totalHours}h</p>
                <p className="text-xs text-muted-foreground">Hours Logged</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">
              {format(currentMonth, 'MMMM yyyy')}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div 
                    key={day} 
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const events = getEventsForDay(day)
                  const isCurrentMonth = isSameMonth(day, currentMonth)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  
                  return (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        setSelectedDate(day)
                        setDetailsOpen(true)
                      }}
                      className={cn(
                        "min-h-[80px] md:min-h-[100px] p-1.5 rounded-lg border text-left transition-all",
                        isCurrentMonth 
                          ? "bg-card hover:border-brand-orange/50" 
                          : "bg-muted/30 text-muted-foreground",
                        isToday(day) && "ring-2 ring-brand-orange ring-offset-2 ring-offset-background",
                        isSelected && "border-brand-orange bg-brand-orange/5"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-1",
                        isToday(day) && "text-brand-orange"
                      )}>
                        {format(day, 'd')}
                      </div>
                      
                      {/* Task dots */}
                      {events.tickets.length > 0 && (
                        <div className="flex flex-wrap gap-0.5 mb-1">
                          {events.tickets.slice(0, 3).map((ticket, i) => (
                            <div
                              key={i}
                              className="w-2 h-2 rounded-full bg-brand-orange"
                              title={ticket.title}
                            />
                          ))}
                          {events.tickets.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{events.tickets.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Time logged indicator */}
                      {events.totalHours > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400">
                          <Clock className="h-2.5 w-2.5" />
                          {events.totalHours.toFixed(1)}h
                        </div>
                      )}
                      
                      {/* Task count on mobile */}
                      {events.tickets.length > 0 && (
                        <div className="hidden text-[10px] text-muted-foreground mt-auto">
                          {events.tickets.length} task{events.tickets.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </motion.button>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Unscheduled Tasks Section */}
      {unscheduledTickets.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarX className="h-5 w-5 text-amber-500" />
                Unscheduled Tasks
                <Badge variant="outline" className="ml-2 bg-amber-500/10 text-amber-600 border-amber-300">
                  {unscheduledTickets.length}
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUnscheduled(!showUnscheduled)}
              >
                {showUnscheduled ? 'Hide' : 'Show'}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              These tasks don't have due dates set. Click a task to add a deadline.
            </p>
          </CardHeader>
          
          <AnimatePresence>
            {showUnscheduled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <CardContent className="pt-2">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {unscheduledTickets
                      .filter(t => {
                        if (clientFilter !== 'all' && t.client_id !== clientFilter) return false
                        if (memberFilter !== 'all' && t.assigned_to !== memberFilter) return false
                        if (viewFilter === 'my-tasks' && t.assigned_to !== user?.id) return false
                        return true
                      })
                      .map(ticket => (
                        <Link
                          key={ticket.id}
                          to={`/clients/${ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
                          className="block"
                        >
                          <div className="p-3 rounded-lg border bg-card hover:bg-accent hover:border-amber-500/50 transition-all group">
                            <div className="flex items-start gap-3">
                              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                                <CircleDashed className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{ticket.title}</p>
                                {ticket.client && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 mt-1">
                                    {ticket.client.name}
                                  </Badge>
                                )}
                                {ticket.assignee && (
                                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                                    <Avatar className="h-4 w-4">
                                      <AvatarImage src={ticket.assignee.avatar_url} />
                                      <AvatarFallback className="text-[8px]">
                                        {ticket.assignee.full_name?.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span>{ticket.assignee.full_name}</span>
                                  </div>
                                )}
                              </div>
                              <CalendarPlus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </div>
                        </Link>
                      ))}
                  </div>
                  
                  {unscheduledTickets.filter(t => {
                    if (clientFilter !== 'all' && t.client_id !== clientFilter) return false
                    if (memberFilter !== 'all' && t.assigned_to !== memberFilter) return false
                    if (viewFilter === 'my-tasks' && t.assigned_to !== user?.id) return false
                    return true
                  }).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No unscheduled tasks match your current filters
                    </p>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {/* Day Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-brand-orange" />
              {selectedDate && format(selectedDate, 'EEEE, MMMM d, yyyy')}
              {selectedDate && isToday(selectedDate) && (
                <Badge className="bg-brand-orange text-white">Today</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedDayEvents && (
            <div className="space-y-4">
              {/* Tasks due */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Tasks Due ({selectedDayEvents.tickets.length})
                </h3>
                
                {selectedDayEvents.tickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No tasks due this day</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.tickets.map(ticket => (
                      <Link
                        key={ticket.id}
                        to={`/clients/${ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
                        className="block"
                        onClick={() => setDetailsOpen(false)}
                      >
                        <div className="p-3 rounded-lg border bg-card hover:bg-accent transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{ticket.title}</p>
                              {ticket.client && (
                                <Badge variant="outline" className="text-xs mt-1">
                                  {ticket.client.name}
                                </Badge>
                              )}
                            </div>
                            {ticket.assignee && (
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={ticket.assignee.avatar_url} />
                                <AvatarFallback className="text-xs">
                                  {ticket.assignee.full_name?.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Time logged */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Time Logged ({selectedDayEvents.totalHours.toFixed(1)}h)
                </h3>
                
                {selectedDayEvents.timeEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No time logged this day</p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.timeEntries.map(entry => (
                      <div 
                        key={entry.id}
                        className="p-3 rounded-lg border bg-green-500/5 border-green-500/20"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {entry.client?.name || 'Unknown Client'}
                            </p>
                            {entry.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {entry.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            {(entry.minutes / 60).toFixed(1)}h
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Quick actions */}
              <div className="flex gap-2 pt-2 border-t">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    setDetailsOpen(false)
                    navigate('/time')
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Log Time
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
