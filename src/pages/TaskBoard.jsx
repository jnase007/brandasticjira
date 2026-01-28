import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Kanban, User, Users, Building2, Clock, AlertCircle,
  ChevronDown, Filter, RefreshCw, CheckCircle, Circle, 
  PlayCircle, Eye, Plus, Search, Calendar, ArrowRight
} from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatRelativeDate, formatDate } from '../lib/utils'
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
import { Input } from '../components/ui/input'
import { Skeleton } from '../components/ui/skeleton'
import { useToast } from '../hooks/useToast'

const COLUMNS = [
  { id: 'todo', title: 'To Do', icon: Circle, color: 'bg-gray-500' },
  { id: 'in_progress', title: 'In Progress', icon: PlayCircle, color: 'bg-blue-500' },
  { id: 'review', title: 'Review', icon: Eye, color: 'bg-purple-500' },
  { id: 'done', title: 'Done', icon: CheckCircle, color: 'bg-green-500' },
]

const PRIORITY_COLORS = {
  urgent: 'border-l-red-500 bg-red-500/5',
  high: 'border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-yellow-500 bg-yellow-500/5',
  low: 'border-l-gray-400 bg-gray-400/5',
}

export default function TaskBoard() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  
  // View mode: 'personal' or 'company'
  const [viewMode, setViewMode] = useState(searchParams.get('view') || 'personal')
  const [selectedMember, setSelectedMember] = useState(searchParams.get('member') || 'all')
  const [selectedClient, setSelectedClient] = useState(searchParams.get('client') || 'all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchData()
  }, [user])

  useEffect(() => {
    // Update URL params
    const params = new URLSearchParams()
    if (viewMode !== 'personal') params.set('view', viewMode)
    if (selectedMember !== 'all') params.set('member', selectedMember)
    if (selectedClient !== 'all') params.set('client', selectedClient)
    setSearchParams(params)
  }, [viewMode, selectedMember, selectedClient])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    
    try {
      await ensureValidSession()
      
      const [ticketsRes, membersRes, clientsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*, client:client_id(id, name, color), assignee:assigned_to(id, full_name, avatar_url)')
          .order('updated_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .eq('is_active', true),
        supabase
          .from('clients')
          .select('id, name, color')
          .eq('is_active', true)
          .order('name')
      ])
      
      setTickets(ticketsRes.data || [])
      setTeamMembers(membersRes.data || [])
      setClients(clientsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({ title: 'Error loading board', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Filter tickets based on view mode and filters
  const filteredTickets = useMemo(() => {
    let filtered = tickets

    // View mode filter
    if (viewMode === 'personal') {
      filtered = filtered.filter(t => t.assigned_to === user?.id)
    } else if (viewMode === 'company' && selectedMember !== 'all') {
      filtered = filtered.filter(t => t.assigned_to === selectedMember)
    }

    // Client filter
    if (selectedClient !== 'all') {
      filtered = filtered.filter(t => t.client_id === selectedClient)
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(t => 
        t.title?.toLowerCase().includes(query) ||
        t.ticket_id?.toLowerCase().includes(query) ||
        t.client?.name?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [tickets, viewMode, selectedMember, selectedClient, searchQuery, user])

  // Group tickets by status
  const ticketsByStatus = useMemo(() => {
    const grouped = {}
    COLUMNS.forEach(col => {
      grouped[col.id] = filteredTickets.filter(t => t.status === col.id)
    })
    return grouped
  }, [filteredTickets])

  // Handle drag and drop
  const handleDragEnd = async (result) => {
    if (!result.destination) return
    
    const { draggableId, source, destination } = result
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const newStatus = destination.droppableId
    const ticketId = draggableId

    // Optimistic update
    setTickets(prev => prev.map(t => 
      t.id === ticketId ? { ...t, status: newStatus } : t
    ))

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId)

      if (error) throw error
      
      toast({ title: 'Task updated', variant: 'success' })
    } catch (error) {
      console.error('Error updating task:', error)
      toast({ title: 'Failed to update task', variant: 'destructive' })
      fetchData() // Revert on error
    }
  }

  // Stats
  const stats = useMemo(() => {
    const myTasks = tickets.filter(t => t.assigned_to === user?.id)
    return {
      total: filteredTickets.length,
      myTotal: myTasks.length,
      inProgress: myTasks.filter(t => t.status === 'in_progress').length,
      overdue: myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length,
    }
  }, [tickets, filteredTickets, user])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 md:p-6 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-brand-orange to-orange-600 rounded-xl text-white">
              <Kanban className="h-6 w-6" />
            </div>
            Task Board
          </h1>
          <p className="text-muted-foreground mt-1">
            {viewMode === 'personal' ? 'Your tasks across all clients' : 'All team tasks'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* View Toggle & Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Personal / Company Toggle */}
        <div className="flex bg-muted rounded-lg p-1">
          <button
            onClick={() => {
              setViewMode('personal')
              setSelectedMember('all')
            }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === 'personal' 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-4 w-4" />
            My Board
          </button>
          <button
            onClick={() => setViewMode('company')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              viewMode === 'company' 
                ? "bg-background shadow-sm text-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Company Board
          </button>
        </div>

        {/* Team Member Filter (Company View) */}
        {viewMode === 'company' && (
          <Select value={selectedMember} onValueChange={setSelectedMember}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Team Members" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Team Members</SelectItem>
              {teamMembers.map(member => (
                <SelectItem key={member.id} value={member.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-[10px]">{member.full_name?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    {member.full_name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Client Filter */}
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
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

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Showing:</span>
          <Badge variant="outline" className="font-bold">{filteredTickets.length} tasks</Badge>
        </div>
        {viewMode === 'personal' && (
          <>
            <div className="flex items-center gap-2 text-blue-600">
              <PlayCircle className="h-4 w-4" />
              <span>{stats.inProgress} in progress</span>
            </div>
            {stats.overdue > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-4 w-4" />
                <span>{stats.overdue} overdue</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-4 gap-4 flex-1">
          {COLUMNS.map(col => (
            <div key={col.id} className="space-y-3">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 overflow-x-auto">
            {COLUMNS.map(column => (
              <div key={column.id} className="flex flex-col min-w-[280px]">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", column.color)} />
                    <h3 className="font-semibold text-sm">{column.title}</h3>
                    <Badge variant="secondary" className="text-xs">
                      {ticketsByStatus[column.id]?.length || 0}
                    </Badge>
                  </div>
                </div>

                {/* Column Content */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 p-2 rounded-xl border-2 border-dashed transition-colors min-h-[200px]",
                        snapshot.isDraggingOver 
                          ? "border-brand-orange bg-brand-orange/5" 
                          : "border-transparent bg-muted/30"
                      )}
                    >
                      <AnimatePresence>
                        {ticketsByStatus[column.id]?.map((ticket, index) => (
                          <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                            {(provided, snapshot) => (
                              <motion.div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className={cn(
                                  "mb-2 p-3 rounded-lg bg-card border border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                                  PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium,
                                  snapshot.isDragging && "shadow-lg ring-2 ring-brand-orange"
                                )}
                              >
                                {/* Ticket ID */}
                                {ticket.ticket_id && (
                                  <p className="text-xs font-mono text-muted-foreground mb-1">
                                    {ticket.ticket_id}
                                  </p>
                                )}
                                
                                {/* Title */}
                                <Link 
                                  to={`/clients/${ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
                                  className="font-medium text-sm hover:text-brand-orange transition-colors line-clamp-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {ticket.title}
                                </Link>
                                
                                {/* Client & Meta */}
                                <div className="flex items-center justify-between mt-2">
                                  <div className="flex items-center gap-2">
                                    {ticket.client && (
                                      <Badge 
                                        variant="outline" 
                                        className="text-[10px] px-1.5"
                                        style={{ borderColor: ticket.client.color }}
                                      >
                                        {ticket.client.name}
                                      </Badge>
                                    )}
                                  </div>
                                  
                                  {ticket.assignee && viewMode === 'company' && (
                                    <Avatar className="h-5 w-5">
                                      <AvatarImage src={ticket.assignee.avatar_url} />
                                      <AvatarFallback className="text-[8px]">
                                        {ticket.assignee.full_name?.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                </div>

                                {/* Due Date */}
                                {ticket.due_date && (
                                  <div className={cn(
                                    "flex items-center gap-1 mt-2 text-xs",
                                    new Date(ticket.due_date) < new Date() && ticket.status !== 'done'
                                      ? "text-red-600"
                                      : "text-muted-foreground"
                                  )}>
                                    <Calendar className="h-3 w-3" />
                                    {formatDate(ticket.due_date)}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </Draggable>
                        ))}
                      </AnimatePresence>
                      {provided.placeholder}
                      
                      {/* Empty State */}
                      {ticketsByStatus[column.id]?.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <column.icon className="h-8 w-8 mx-auto mb-2 opacity-30" />
                          <p>No tasks</p>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </DragDropContext>
      )}
    </motion.div>
  )
}
