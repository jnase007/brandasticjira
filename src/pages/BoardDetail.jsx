import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Plus,
  ArrowLeft,
  MoreHorizontal,
  Filter,
  Search,
  X,
  Clock,
  Play,
  FolderOpen,
  Circle,
  PlayCircle,
  Eye,
  UserCheck,
  ThumbsUp,
  Receipt,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
} from 'lucide-react'
import { 
  getBoard, 
  getTickets, 
  createTicket, 
  updateTicketPositions,
  getTeamMembers,
  logActivity,
  ensureValidSession,
  supabase,
} from '../lib/supabase'
import { useBoardRealtime } from '../hooks/useRealtime'
import { useAuth } from '../contexts/AuthContext'
import { cn, groupTicketsByStatus, getStatusInfo } from '../lib/utils'
import TicketCard from '../components/TicketCard'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
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

// New 7-status workflow columns
const COLUMNS = [
  { id: 'new', label: 'New', color: 'bg-slate-500', icon: Circle },
  { id: 'in_progress', label: 'In Progress', color: 'bg-amber-500', icon: PlayCircle },
  { id: 'internal_review', label: 'Internal Review', color: 'bg-purple-500', icon: Eye },
  { id: 'client_review', label: 'Client Review', color: 'bg-blue-500', icon: UserCheck },
  { id: 'approved', label: 'Approved', color: 'bg-emerald-500', icon: ThumbsUp },
  { id: 'ready_for_billing', label: 'Ready for Billing', color: 'bg-orange-500', icon: Receipt },
  { id: 'closed', label: 'Closed', color: 'bg-green-500', icon: CheckCircle2 },
]

// Legacy status mapping
const STATUS_MAP = {
  'todo': 'new',
  'inprogress': 'in_progress', 
  'done': 'closed',
}

// Normalize status for backwards compatibility
const normalizeStatus = (status) => STATUS_MAP[status] || status

export default function BoardDetail() {
  const { boardId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [board, setBoard] = useState(null)
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    estimated_hours: '',
    ticket_type: 'task',
    category_id: '',
  })
  const [saving, setSaving] = useState(false)

  const [fetchError, setFetchError] = useState(null)

  // Fetch board and tickets
  const fetchData = useCallback(async () => {
    if (!boardId) return

    setLoading(true)
    setFetchError(null)
    
    try {
      // Validate session before fetching - this refreshes token if expiring
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[BoardDetail] Session invalid, cannot fetch data')
        setFetchError('Session expired. Please refresh the page or log in again.')
        setLoading(false)
        return
      }
      
      const [boardRes, ticketsRes, teamRes, categoriesRes] = await Promise.all([
        getBoard(boardId),
        getTickets(boardId),
        getTeamMembers(),
        supabase.from('ticket_categories').select('*').eq('board_id', boardId).order('position'),
      ])

      if (boardRes.data) setBoard(boardRes.data)
      if (ticketsRes.data) {
        // Normalize statuses for backwards compatibility
        const normalizedTickets = ticketsRes.data.map(t => ({
          ...t,
          status: normalizeStatus(t.status)
        }))
        setTickets(normalizedTickets)
      }
      if (teamRes.data) setTeamMembers(teamRes.data)
      if (categoriesRes.data) setCategories(categoriesRes.data)
    } catch (error) {
      console.error('Error fetching board data:', error)
      setFetchError(error.message || 'Failed to load board data')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchData()
  }, [fetchData, authLoading, user?.id])

  // Real-time updates
  useBoardRealtime(boardId, {
    onTicketInsert: (ticket) => {
      setTickets((prev) => [...prev, ticket])
    },
    onTicketUpdate: (ticket) => {
      setTickets((prev) => prev.map((t) => (t.id === ticket.id ? { ...t, ...ticket } : t)))
    },
    onTicketDelete: (ticket) => {
      setTickets((prev) => prev.filter((t) => t.id !== ticket.id))
    },
  })

  // Filter and group tickets
  const filteredTickets = tickets.filter((t) => {
    const matchesSearch = 
      (t.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.ticket_id || '').toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = selectedCategory === 'all' || t.category_id === selectedCategory
    return matchesSearch && matchesCategory
  })
  
  // Group tickets by status using the new column IDs
  const groupedTickets = COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredTickets
      .filter(t => t.status === col.id)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
    return acc
  }, {})

  // Handle drag end
  const handleDragEnd = async (result) => {
    const { source, destination, draggableId } = result

    // Dropped outside
    if (!destination) return

    // Same position
    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return
    }

    // Get the ticket
    const ticket = tickets.find((t) => t.id === draggableId)
    if (!ticket) return

    // Optimistic update
    const newStatus = destination.droppableId
    const newTickets = tickets.map((t) => {
      if (t.id === draggableId) {
        return { ...t, status: newStatus, position: destination.index }
      }
      return t
    })
    setTickets(newTickets)

    // Update positions in database
    const updates = []
    const newGrouped = groupTicketsByStatus(newTickets)
    
    Object.entries(newGrouped).forEach(([status, statusTickets]) => {
      statusTickets.forEach((t, index) => {
        if (t.position !== index || t.status !== status) {
          updates.push({ id: t.id, position: index, status })
        }
      })
    })

    if (updates.length > 0) {
      const { error } = await updateTicketPositions(updates)
      if (error) {
        toast({
          title: 'Error',
          description: 'Failed to update task position.',
          variant: 'destructive',
        })
        // Revert on error
        fetchData()
      } else {
        logActivity({
          activity_type: 'status_changed',
          user_id: user?.id,
          client_id: board?.client_id,
          entity_type: 'ticket',
          entity_id: ticket.id,
          entity_name: ticket.ticket_id || ticket.title,
          metadata: {
            from_status: ticket.status,
            to_status: newStatus,
          },
        })
      }
    }
  }

  // Create ticket
  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please enter a task title.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const ticketData = {
        title: newTicket.title,
        description: newTicket.description,
        priority: newTicket.priority,
        assigned_to: newTicket.assigned_to || null,
        estimated_hours: newTicket.estimated_hours ? parseFloat(newTicket.estimated_hours) : null,
        ticket_type: newTicket.ticket_type || 'task',
        category_id: newTicket.category_id || null,
        board_id: boardId,
        client_id: board.client_id,
        created_by: user.id,
        status: 'new',
        resolution: 'unresolved',
        position: (groupedTickets.new?.length || 0),
      }

      const { data, error } = await createTicket(ticketData)
      if (error) throw error

      setTickets((prev) => [...prev, data])
      logActivity({
        activity_type: 'ticket_created',
        user_id: user?.id,
        client_id: board?.client_id,
        entity_type: 'ticket',
        entity_id: data.id,
        entity_name: data.ticket_id || data.title,
        metadata: { board_id: boardId },
      })
      setCreateDialogOpen(false)
      setNewTicket({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        estimated_hours: '',
        ticket_type: 'task',
        category_id: '',
      })

      toast({
        title: 'Task created',
        description: `${data.ticket_id} has been created.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create task.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6">
        <div className="h-8 w-48 bg-muted rounded shimmer mb-8" />
        <div className="flex gap-4 sm:gap-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-[85vw] sm:w-80 h-96 bg-muted rounded-xl shimmer flex-shrink-0" />
          ))}
        </div>
      </div>
    )
  }

  if (!board) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium mb-2">Board not found</h2>
        <p className="text-muted-foreground mb-4">
          This board may have been deleted or you don't have access.
        </p>
        <Button asChild>
          <Link to="/boards">Back to Boards</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/boards">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: board.client?.color }}
              />
              <h1 className="text-2xl font-display font-bold">{board.name}</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {board.client?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-8"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {/* Category Filter */}
          {categories.length > 0 && (
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-40">
                <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icon}</span>
                      <span>{cat.name}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button 
            variant="outline"
            onClick={() => {
              if (window.openTimerWithClient && board?.client) {
                window.openTimerWithClient(
                  { id: board.client.id, name: board.client.name, color: board.client.color },
                  `Working on ${board.name}`
                )
              }
            }}
            className="gap-2"
          >
            <Play className="h-4 w-4 text-green-500 fill-green-500" />
            Start Timer
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory sm:snap-none hide-scrollbar">
          {COLUMNS.map((column) => {
            const columnTickets = groupedTickets[column.id] || []
            const ColumnIcon = column.icon

            return (
              <div key={column.id} className="kanban-column flex-shrink-0 w-[72vw] sm:w-64 md:w-72 lg:w-80 snap-center sm:snap-align-none">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white text-sm font-medium",
                      column.color
                    )}>
                      <ColumnIcon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{column.label}</span>
                      <span className="sm:hidden">{column.label.split(' ')[0]}</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground bg-muted rounded-full px-2 py-0.5">
                      {columnTickets.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCreateDialogOpen(true)}
                    className="opacity-50 hover:opacity-100"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Droppable Area */}
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-1 space-y-3 min-h-[200px] rounded-lg p-1 transition-colors",
                        snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/20"
                      )}
                    >
                      <AnimatePresence mode="popLayout">
                        {columnTickets.map((ticket, index) => (
                          <Draggable
                            key={ticket.id}
                            draggableId={ticket.id}
                            index={index}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                              >
                                <TicketCard
                                  ticket={ticket}
                                  isDragging={snapshot.isDragging}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                      </AnimatePresence>
                      {provided.placeholder}

                      {/* Empty state */}
                      {columnTickets.length === 0 && !snapshot.isDraggingOver && (
                        <div className="text-center py-8 text-sm text-muted-foreground space-y-3">
                          <p>No tasks yet.</p>
                          <Button variant="outline" size="sm" onClick={() => setCreateDialogOpen(true)}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add a Task
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="ticketTitle">Title *</Label>
              <Input
                id="ticketTitle"
                placeholder="e.g., Design landing page hero section"
                value={newTicket.title}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, title: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="ticketDescription">Description</Label>
              <Textarea
                id="ticketDescription"
                placeholder="Add more details about this ticket..."
                value={newTicket.description}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1.5 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select
                  value={newTicket.priority}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assignee</Label>
                <Select
                  value={newTicket.assigned_to}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="estimatedHours">Estimated Hours</Label>
                <Input
                  id="estimatedHours"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="e.g., 4"
                  value={newTicket.estimated_hours}
                  onChange={(e) => setNewTicket((prev) => ({ ...prev, estimated_hours: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              
              <div>
                <Label>Type</Label>
                <Select
                  value={newTicket.ticket_type}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, ticket_type: value }))}
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
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <Label>Category</Label>
                <Select
                  value={newTicket.category_id}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, category_id: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No Category</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={saving}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
