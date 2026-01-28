import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, 
  Clock, CheckCircle, AlertCircle, Users, Building2, 
  Plus, Filter, Eye, ArrowRight, Timer, Zap
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

const PRIORITY_COLORS = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

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
  const [timeEntries, setTimeEntries] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [viewFilter, setViewFilter] = useState('all') // all, my-tasks, due-dates, time-logged

  useEffect(() => {
    fetchData()
  }, [currentMonth])

  const fetchData = async () => {
    setLoading(true)
    try {
      const monthStart = startOfMonth(currentMonth)
      const monthEnd = endOfMonth(currentMonth)
      
      // Fetch tickets with due dates in this month range (with buffer for week view)
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
      
      const [ticketsRes, timeRes, clientsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, client:client_id(id, name), assignee:assigned_to(id, full_name, avatar_url)')
          .gte('due_date', calendarStart.toISOString().split('T')[0])
          .lte('due_date', calendarEnd.toISOString().split('T')[0])
          .order('due_date'),
        supabase
          .from('time_entries')
          .select('*, client:client_id(id, name)')
          .gte('date', calendarStart.toISOString().split('T')[0])
          .lte('date', calendarEnd.toISOString().split('T')[0]),
        supabase
          .from('clients')
          .select('id, name')
          .eq('is_active', true)
      ])
      
      setTickets(ticketsRes.data || [])
      setTimeEntries(timeRes.data || [])
      setClients(clientsRes.data || [])
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
    
    const dayTickets = tickets.filter(t => {
      if (!t.due_date) return false
      return t.due_date === dayStr || t.due_date.startsWith(dayStr)
    })
    
    const dayTimeEntries = timeEntries.filter(t => t.date === dayStr)
    const totalMinutes = dayTimeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
    
    // Apply filter
    let filteredTickets = dayTickets
    if (viewFilter === 'my-tasks') {
      filteredTickets = dayTickets.filter(t => t.assigned_to === user?.id)
    }
    
    return {
      tickets: filteredTickets,
      timeEntries: dayTimeEntries,
      totalHours: totalMinutes / 60,
    }
  }

  // Get selected day details
  const selectedDayEvents = useMemo(() => {
    if (!selectedDate) return null
    return getEventsForDay(selectedDate)
  }, [selectedDate, tickets, timeEntries, viewFilter])

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

  // Stats for current month
  const monthStats = useMemo(() => {
    const monthTickets = tickets.filter(t => 
      t.due_date && isSameMonth(parseISO(t.due_date), currentMonth)
    )
    const myTickets = monthTickets.filter(t => t.assigned_to === user?.id)
    const totalHours = timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60
    
    return {
      totalTasks: monthTickets.length,
      myTasks: myTickets.length,
      overdue: monthTickets.filter(t => 
        t.status !== 'done' && new Date(t.due_date) < new Date()
      ).length,
      totalHours: totalHours.toFixed(1),
    }
  }, [tickets, timeEntries, currentMonth, user])

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
        
        <div className="flex items-center gap-2">
          <Select value={viewFilter} onValueChange={setViewFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="my-tasks">My Tasks</SelectItem>
            </SelectContent>
          </Select>
          
          <Button variant="outline" onClick={goToToday}>
            Today
          </Button>
        </div>
      </div>

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
                              className={cn(
                                "w-2 h-2 rounded-full",
                                PRIORITY_COLORS[ticket.priority] || 'bg-gray-400'
                              )}
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
                              <div className="flex items-center gap-2 mt-1">
                                {ticket.client && (
                                  <Badge variant="outline" className="text-xs">
                                    {ticket.client.name}
                                  </Badge>
                                )}
                                <Badge 
                                  variant="outline"
                                  className={cn(
                                    "text-xs",
                                    ticket.priority === 'urgent' && "border-red-500 text-red-500",
                                    ticket.priority === 'high' && "border-orange-500 text-orange-500"
                                  )}
                                >
                                  {ticket.priority}
                                </Badge>
                              </div>
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
