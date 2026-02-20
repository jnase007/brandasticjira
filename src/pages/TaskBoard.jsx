import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Kanban, User, Users, Building2, Clock, AlertCircle,
  ChevronDown, Filter, RefreshCw, CheckCircle, Circle, 
  PlayCircle, Eye, Plus, Search, Calendar, ArrowRight,
  UserCheck, ThumbsUp, Receipt, CheckCircle2, Loader2,
  CheckSquare, Square, X, Trash2, UserPlus, MoveRight,
  CalendarDays, ClipboardList, DollarSign
} from 'lucide-react'
import { supabase, ensureValidSession, getOrCreateGeneralBoardForClient } from '../lib/supabase'
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
import { Textarea } from '../components/ui/textarea'
import { Skeleton } from '../components/ui/skeleton'
import { Label } from '../components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { useToast } from '../hooks/useToast'

const COLUMNS = [
  { id: 'new', title: 'New', icon: Circle, color: 'bg-green-500' },
  { id: 'in_progress', title: 'In Progress', icon: PlayCircle, color: 'bg-brand-orange' },
  { id: 'internal_review', title: 'Internal Review', icon: Eye, color: 'bg-gray-400' },
  { id: 'client_review', title: 'Client Review', icon: UserCheck, color: 'bg-gray-400' },
  { id: 'approved', title: 'Approved', icon: ThumbsUp, color: 'bg-gray-400' },
  { id: 'ready_for_billing', title: 'Ready for Billing', icon: Receipt, color: 'bg-gray-400' },
  { id: 'closed', title: 'Closed', icon: CheckCircle2, color: 'bg-gray-400' },
]

// Map legacy statuses to new workflow statuses
const normalizeStatus = (status) => {
  if (!status) return 'new'
  
  // Normalize: lowercase, replace spaces with underscores, trim
  const normalized = status.toLowerCase().trim().replace(/\s+/g, '_')
  
  const statusMap = {
    // Legacy statuses
    'todo': 'new',
    'to_do': 'new',
    'review': 'internal_review',
    'done': 'closed',
    'complete': 'closed',
    'completed': 'closed',
    'inprogress': 'in_progress',
    'in-progress': 'in_progress',
    // Standard statuses
    'new': 'new',
    'in_progress': 'in_progress',
    'internal_review': 'internal_review',
    'client_review': 'client_review',
    'approved': 'approved',
    'ready_for_billing': 'ready_for_billing',
    'ready_for__billing': 'ready_for_billing', // Handle double underscore
    'closed': 'closed',
  }
  
  const result = statusMap[normalized] || 'new'
  console.log(`normalizeStatus: "${status}" → "${normalized}" → "${result}"`)
  return result
}


export default function TaskBoard() {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Selected member filter - default to current user
  const [selectedMember, setSelectedMember] = useState(searchParams.get('member') || 'me')
  const [selectedClient, setSelectedClient] = useState(searchParams.get('client') || 'all')
  const [searchQuery, setSearchQuery] = useState('')
  
  // Create task dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(searchParams.get('new') === 'true')
  const [creating, setCreating] = useState(false)
  const emptyTaskForm = {
    title: '',
    description: '',
    client_id: '',
    assigned_to: '',
    reporter_id: '',  // Will default to current user
    estimated_hours: '',
    due_date: '',
    ticket_type: 'task',
    billing_type: 'retainer',  // 'retainer' = included in monthly hours; 'alacarte' = separate project
  }
  const [newTask, setNewTask] = useState(emptyTaskForm)
  const [createDialogClientRate, setCreateDialogClientRate] = useState(null)
  
  // Fetch client rate when client is selected in create dialog
  useEffect(() => {
    if (!newTask.client_id) {
      setCreateDialogClientRate(null)
      return
    }
    let cancelled = false
    supabase
      .from('client_rates')
      .select('hourly_rate')
      .eq('client_id', newTask.client_id)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.hourly_rate) setCreateDialogClientRate(data.hourly_rate)
        else if (!cancelled) setCreateDialogClientRate(null)
      })
    return () => { cancelled = true }
  }, [newTask.client_id])
  
  // Reset form when dialog closes
  const handleCreateDialogChange = (open) => {
    setCreateDialogOpen(open)
    if (!open) {
      setNewTask(emptyTaskForm)
    }
  }
  
  // Multi-select / Bulk actions
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkAssignDialogOpen, setBulkAssignDialogOpen] = useState(false)
  const [bulkMoveDialogOpen, setBulkMoveDialogOpen] = useState(false)
  const [bulkAssignTo, setBulkAssignTo] = useState('')
  const [bulkMoveStatus, setBulkMoveStatus] = useState('')
  
  // Toggle task selection
  const toggleTaskSelection = useCallback((taskId, e) => {
    e?.preventDefault()
    e?.stopPropagation()
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }, [])
  
  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedTasks(new Set())
  }, [])

  useEffect(() => {
    if (user && profile) {
      fetchData()
      // Auto-select current user if 'me' placeholder
      if (selectedMember === 'me') {
        setSelectedMember(profile.id)
      }
    }
  }, [user, profile])
  
  // Handle dialog URL param
  useEffect(() => {
    if (searchParams.get('new') === 'true') {
      setCreateDialogOpen(true)
      // Clear the param
      const newParams = new URLSearchParams(searchParams)
      newParams.delete('new')
      setSearchParams(newParams, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    // Update URL params - only set non-defaults
    const params = new URLSearchParams()
    // Only put member in URL if it's NOT the current user (since that's the default)
    if (selectedMember !== 'all' && selectedMember !== 'me' && selectedMember !== profile?.id) {
      params.set('member', selectedMember)
    } else if (selectedMember === 'all') {
      params.set('member', 'all')
    }
    if (selectedClient !== 'all') params.set('client', selectedClient)
    setSearchParams(params, { replace: true })
  }, [selectedMember, selectedClient, profile?.id])

  const fetchData = async () => {
    if (!user) return
    setLoading(true)
    
    try {
      await ensureValidSession()
      
      // Try simple query first, then enrich with client/assignee data
      const [ticketsRes, membersRes, clientsRes] = await Promise.all([
        supabase
          .from('tickets')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, email')
          .eq('is_active', true),
        supabase
          .from('clients')
          .select('id, name, color, logo_url, engagement_type')
          .eq('is_active', true)
          .order('name')
      ])
      
      // Log any errors
      if (ticketsRes.error) {
        console.error('[TaskBoard] Tickets query error:', ticketsRes.error)
      }
      console.log('[TaskBoard] Tickets response:', { 
        data: ticketsRes.data?.length, 
        error: ticketsRes.error,
        status: ticketsRes.status 
      })
      
      // Enrich tickets with client and assignee info
      const rawTickets = ticketsRes.data || []
      const allClients = clientsRes.data || []
      const allMembers = membersRes.data || []
      
      const allTickets = rawTickets.map(ticket => ({
        ...ticket,
        client: allClients.find(c => c.id === ticket.client_id) || null,
        assignee: allMembers.find(m => m.id === ticket.assigned_to) || null,
      }))
      
      // Use profile.id (same as Dashboard) - this is the correct ID for filtering
      const currentUserId = profile?.id || user?.id
      const userTickets = allTickets.filter(t => t.assigned_to === currentUserId)
      
      // Also check by email as fallback (for OAuth users)
      const currentUserEmail = profile?.email || user?.email
      const userTicketsByEmail = allTickets.filter(t => 
        t.assignee?.email && t.assignee.email === currentUserEmail
      )
      
      // Detailed debugging
      console.log('========== TASK BOARD DEBUG ==========')
      console.log('Total tickets in DB:', allTickets.length)
      console.log('user.id:', user?.id)
      console.log('profile.id:', profile?.id)
      console.log('Using ID for filtering:', currentUserId)
      console.log('Current user email:', currentUserEmail)
      console.log('Tickets assigned to current user (by ID):', userTickets.length)
      console.log('Tickets assigned to current user (by email):', userTicketsByEmail.length)
      
      if (userTickets.length > 0) {
        console.log('User ticket details:', userTickets.map(t => ({
          id: t.id,
          ticket_id: t.ticket_id,
          title: t.title,
          status: t.status,
          normalized: normalizeStatus(t.status),
          assigned_to: t.assigned_to
        })))
      } else {
        console.log('No tickets assigned to this user.')
        console.log('Sample ticket assigned_to values:', allTickets.slice(0, 5).map(t => ({
          title: t.title,
          assigned_to: t.assigned_to,
          assignee_name: t.assignee?.full_name
        })))
      }
      console.log('=======================================')
      
      setTickets(allTickets)
      setTeamMembers(membersRes.data || [])
      setClients(clientsRes.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({ title: 'Error loading board', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Filter tickets based on selected filters
  const filteredTickets = useMemo(() => {
    let filtered = tickets

    // Team member filter
    if (selectedMember && selectedMember !== 'all') {
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
  }, [tickets, selectedMember, selectedClient, searchQuery])

  // Group tickets by status (with legacy status mapping)
  const ticketsByStatus = useMemo(() => {
    const grouped = {}
    COLUMNS.forEach(col => {
      grouped[col.id] = filteredTickets.filter(t => normalizeStatus(t.status) === col.id)
    })
    return grouped
  }, [filteredTickets])

  // Select all visible tasks (defined after filteredTickets)
  const selectAllVisible = useCallback(() => {
    const allIds = filteredTickets.map(t => t.id)
    setSelectedTasks(new Set(allIds))
  }, [filteredTickets])
  
  // Bulk assign
  const handleBulkAssign = async () => {
    if (!bulkAssignTo || selectedTasks.size === 0) return
    setBulkActionLoading(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ assigned_to: bulkAssignTo })
        .in('id', Array.from(selectedTasks))
      
      if (error) throw error
      
      toast({
        title: `${selectedTasks.size} tasks reassigned`,
        variant: 'success',
      })
      
      clearSelection()
      setBulkAssignDialogOpen(false)
      fetchData()
    } catch (error) {
      toast({
        title: 'Failed to reassign tasks',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setBulkActionLoading(false)
    }
  }
  
  // Bulk move status
  const handleBulkMove = async () => {
    if (!bulkMoveStatus || selectedTasks.size === 0) return
    setBulkActionLoading(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: bulkMoveStatus })
        .in('id', Array.from(selectedTasks))
      
      if (error) throw error
      
      toast({
        title: `${selectedTasks.size} tasks moved to ${COLUMNS.find(c => c.id === bulkMoveStatus)?.title}`,
        variant: 'success',
      })
      
      clearSelection()
      setBulkMoveDialogOpen(false)
      fetchData()
    } catch (error) {
      toast({
        title: 'Failed to move tasks',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setBulkActionLoading(false)
    }
  }

  // Create task handler
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast({ title: 'Please enter a task title', variant: 'destructive' })
      return
    }
    if (!newTask.client_id) {
      toast({ title: 'Please select a client', variant: 'destructive' })
      return
    }
    
    setCreating(true)
    try {
      const selectedClientData = clients.find(c => c.id === newTask.client_id)
      const { data: boardId, error: boardError } = await getOrCreateGeneralBoardForClient(newTask.client_id, user.id)
      if (boardError || !boardId) {
        toast({ title: 'Error', description: 'Could not find or create a board for this client.', variant: 'destructive' })
        setCreating(false)
        return
      }
      const taskData = {
        title: newTask.title.trim(),
        description: newTask.description.trim() || null,
        client_id: newTask.client_id,
        board_id: boardId,
        assigned_to: newTask.assigned_to || user.id,
        reporter_id: newTask.reporter_id || user.id,  // Default to current user
        status: 'new',
        priority: 'medium',
        created_by: user.id,
        ticket_type: newTask.ticket_type || 'task',
        due_date: newTask.due_date || null,
        billing_type: selectedClientData?.engagement_type === 'retainer' ? (newTask.billing_type || 'retainer') : 'alacarte',
      }
      
      if (newTask.estimated_hours) {
        taskData.estimated_hours = parseFloat(newTask.estimated_hours)
      }
      
      const { data, error } = await supabase
        .from('tickets')
        .insert(taskData)
        .select('*')
        .single()
      
      if (error) throw error
      
      // Enrich with client/assignee data
      const enrichedTicket = {
        ...data,
        status: normalizeStatus(data.status),
        client: clients.find(c => c.id === data.client_id) || null,
        assignee: teamMembers.find(m => m.id === data.assigned_to) || null,
      }
      
      setTickets(prev => [enrichedTicket, ...prev])
      handleCreateDialogChange(false)
      toast({ title: '✅ Task created!', variant: 'success' })
      
      // Navigate to the newly created task
      const taskId = data.ticket_id || data.id
      navigate(`/tickets/${taskId}`)
    } catch (error) {
      console.error('Error creating task:', error)
      toast({ title: 'Error creating task', description: error.message, variant: 'destructive' })
    } finally {
      setCreating(false)
    }
  }

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
    const currentUserId = profile?.id || user?.id
    const currentUserEmail = profile?.email || user?.email
    const myTasks = tickets.filter(t => 
      t.assigned_to === currentUserId || 
      (t.assignee?.email && t.assignee.email === currentUserEmail)
    )
    return {
      total: filteredTickets.length,
      myTotal: myTasks.length,
      inProgress: myTasks.filter(t => normalizeStatus(t.status) === 'in_progress').length,
      overdue: myTasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && normalizeStatus(t.status) !== 'closed').length,
    }
  }, [tickets, filteredTickets, user, profile])

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
            {selectedMember && selectedMember !== 'all' 
              ? `Tasks assigned to ${teamMembers.find(m => m.id === selectedMember)?.full_name || 'selected member'}`
              : 'All team tasks'}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Team Member Filter - always visible */}
        <Select value={selectedMember} onValueChange={setSelectedMember}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Team Members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                All Team Members
              </div>
            </SelectItem>
            {teamMembers.map(member => (
              <SelectItem key={member.id} value={member.id}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="text-[10px]">{member.full_name?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  {member.full_name}
                  {member.id === profile?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedTasks.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mb-4"
          >
            <div className="flex items-center justify-between p-3 bg-brand-orange/10 border border-brand-orange/30 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-brand-orange" />
                <span className="font-medium text-brand-orange">
                  {selectedTasks.size} task{selectedTasks.size !== 1 ? 's' : ''} selected
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllVisible}
                  className="text-xs"
                >
                  Select All ({filteredTickets.length})
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkAssignDialogOpen(true)}
                  className="gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  Reassign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBulkMoveDialogOpen(true)}
                  className="gap-1.5"
                >
                  <MoveRight className="h-4 w-4" />
                  Move to
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 mb-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Showing:</span>
          <Badge variant="outline" className="font-bold">{filteredTickets.length} tasks</Badge>
          {selectedMember && selectedMember !== 'all' && tickets.length > filteredTickets.length && (
            <span className="text-muted-foreground">
              (of {tickets.length} total)
            </span>
          )}
        </div>
        
        {selectedMember && selectedMember !== 'all' && (
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
        
        {(!selectedMember || selectedMember === 'all') && (
          <Badge variant="outline" className="text-green-600 border-green-300">
            Showing all company tasks
          </Badge>
        )}
        
        {filteredTickets.length === 0 && tickets.length === 0 && !loading && (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            No tasks in database yet
          </Badge>
        )}
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="grid grid-cols-7 gap-3 flex-1 overflow-x-auto">
          {COLUMNS.map(col => (
            <div key={col.id} className="space-y-3 min-w-[160px]">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 flex-1 overflow-x-auto pb-4">
            {COLUMNS.map(column => (
              <div key={column.id} className="flex flex-col min-w-[180px] w-[180px] flex-shrink-0">
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
                        "flex-1 p-2 rounded-xl border-2 border-dashed min-h-[200px]",
                        snapshot.isDraggingOver 
                          ? "border-brand-orange bg-brand-orange/10" 
                          : "border-transparent bg-muted/30"
                      )}
                      style={{
                        transition: 'background-color 0.2s ease, border-color 0.2s ease',
                      }}
                    >
                      {ticketsByStatus[column.id]?.map((ticket, index) => (
                        <Draggable key={ticket.id} draggableId={ticket.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                "mb-2 p-3 rounded-lg bg-card border shadow-sm cursor-grab active:cursor-grabbing select-none group/card relative",
                                dragSnapshot.isDragging 
                                  ? "shadow-xl ring-2 ring-brand-orange rotate-2 scale-105 z-50" 
                                  : "hover:shadow-md",
                                selectedTasks.has(ticket.id) && "ring-2 ring-brand-orange bg-brand-orange/5"
                              )}
                              style={{
                                ...dragProvided.draggableProps.style,
                                transition: dragSnapshot.isDragging 
                                  ? 'box-shadow 0.15s ease, transform 0.15s ease' 
                                  : 'box-shadow 0.2s ease, transform 0.2s ease',
                              }}
                            >
                                {/* Selection Checkbox */}
                                <button
                                  onClick={(e) => toggleTaskSelection(ticket.id, e)}
                                  className={cn(
                                    "absolute -left-1 -top-1 p-0.5 rounded bg-white dark:bg-slate-800 border shadow-sm transition-all z-10",
                                    selectedTasks.has(ticket.id) 
                                      ? "opacity-100 border-brand-orange" 
                                      : "opacity-0 group-hover/card:opacity-100 border-slate-300"
                                  )}
                                >
                                  {selectedTasks.has(ticket.id) ? (
                                    <CheckSquare className="h-4 w-4 text-brand-orange" />
                                  ) : (
                                    <Square className="h-4 w-4 text-slate-400" />
                                  )}
                                </button>
                                
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
                                  
                                  {ticket.assignee && (!selectedMember || selectedMember === 'all') && (
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
                                  new Date(ticket.due_date) < new Date() && ticket.status !== 'closed'
                                    ? "text-red-600"
                                    : "text-muted-foreground"
                                )}>
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(ticket.due_date)}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
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
      
      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={handleCreateDialogChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4">
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-brand-orange" />
                Create New Task
              </DialogTitle>
            </div>
            {newTask.client_id ? (
            <div className="flex items-center justify-between gap-4 mt-1">
              <p className="text-sm text-muted-foreground">
                Create a task and assign it to a team member
              </p>
              <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const selectedClientData = clients.find(c => c.id === newTask.client_id)
              const hasType = selectedClientData?.engagement_type
              const hasRate = createDialogClientRate != null
              if (!hasType && !hasRate) return null
              return (
                <>
                  {hasType && (
                    <div className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-medium",
                      selectedClientData.engagement_type === 'retainer' 
                        ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                        : "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                    )}>
                      {selectedClientData.engagement_type === 'retainer' ? '📅 Retainer' : '🎯 A La Carte'}
                    </div>
                  )}
                  {hasRate && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                        ${createDialogClientRate}/hr
                      </span>
                      <span className="text-xs text-green-600 dark:text-green-500">client rate</span>
                    </div>
                  )}
                  {hasType && (
                    <span className="text-xs text-muted-foreground">
                      {selectedClientData.engagement_type === 'retainer' 
                        ? 'Time will be tracked against monthly retainer'
                        : 'This will be billed as project work'}
                    </span>
                  )}
                </>
              )
            })()}
              </div>
            </div>
            ) : null}
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="task-client">Client *</Label>
              <Select
                value={newTask.client_id}
                onValueChange={(value) => setNewTask(prev => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: client.color || '#6366f1' }}
                        />
                        {client.name}
                        {client.engagement_type && (
                          <span className="text-xs text-muted-foreground">
                            ({client.engagement_type === 'retainer' ? 'Retainer' : 'Project'})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="task-title">Task Title *</Label>
              <Input
                id="task-title"
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                placeholder="Add more details..."
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                className="mt-1.5"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Assign To</Label>
                <Select
                  value={newTask.assigned_to || user?.id}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-[10px]">
                              {member.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {member.full_name}
                          {member.id === user?.id && <span className="text-muted-foreground">(you)</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Reporter</Label>
                <Select
                  value={newTask.reporter_id || user?.id}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, reporter_id: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select reporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-[10px]">
                              {member.full_name?.charAt(0) || '?'}
                            </AvatarFallback>
                          </Avatar>
                          {member.full_name}
                          {member.id === user?.id && <span className="text-muted-foreground">(you)</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Bill as: Retainer vs A la carte (only when selected client is retainer) */}
            {newTask.client_id && clients.find(c => c.id === newTask.client_id)?.engagement_type === 'retainer' && (
              <div>
                <Label>Bill as</Label>
                <Select
                  value={newTask.billing_type || 'retainer'}
                  onValueChange={(v) => setNewTask(prev => ({ ...prev, billing_type: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retainer">📅 Retainer (included in monthly hours)</SelectItem>
                    <SelectItem value="alacarte">🎯 A la carte (separate project / out of scope)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Use a la carte for out-of-scope work (e.g. photoshoot) billed separately.</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g., 2"
                  value={newTask.estimated_hours}
                  onChange={(e) => setNewTask(prev => ({ ...prev, estimated_hours: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select
                  value={newTask.ticket_type}
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, ticket_type: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">
                      <span className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4" />
                        Task
                      </span>
                    </SelectItem>
                    <SelectItem value="client_homework">
                      <span className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-orange-500" />
                        Client Homework
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Due Date
                </Label>
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => handleCreateDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Assign Dialog */}
      <Dialog open={bulkAssignDialogOpen} onOpenChange={setBulkAssignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-orange" />
              Reassign {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Label>Assign to team member</Label>
            <Select value={bulkAssignTo} onValueChange={setBulkAssignTo}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="text-[10px]">
                          {member.full_name?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      {member.full_name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={bulkActionLoading || !bulkAssignTo}>
              {bulkActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Reassign Tasks'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Bulk Move Dialog */}
      <Dialog open={bulkMoveDialogOpen} onOpenChange={setBulkMoveDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="h-5 w-5 text-brand-orange" />
              Move {selectedTasks.size} Task{selectedTasks.size !== 1 ? 's' : ''}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <Label>Move to status</Label>
            <Select value={bulkMoveStatus} onValueChange={setBulkMoveStatus}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {COLUMNS.map((column) => (
                  <SelectItem key={column.id} value={column.id}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", column.color)} />
                      {column.title}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkMoveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkMove} disabled={bulkActionLoading || !bulkMoveStatus}>
              {bulkActionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Move Tasks'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
