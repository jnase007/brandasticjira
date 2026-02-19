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
  FolderPlus,
  Circle,
  PlayCircle,
  Eye,
  UserCheck,
  ThumbsUp,
  Receipt,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Pencil,
  Trash2,
  Palette,
  Loader2,
  DollarSign,
  CalendarDays,
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
  
  // Default empty form state
  const emptyTicketForm = {
    title: '',
    description: '',
    assigned_to: '',
    reporter_id: '',  // Will default to current user
    estimated_hours: '',
    ticket_type: 'task',
    category_id: '',
    due_date: '',
  }
  const [newTicket, setNewTicket] = useState(emptyTicketForm)
  
  // Reset form when dialog closes
  const handleDialogChange = (open) => {
    setCreateDialogOpen(open)
    if (!open) {
      // Reset form when closing
      setNewTicket(emptyTicketForm)
    }
  }
  const [saving, setSaving] = useState(false)

  // Category management
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '📁', color: '#6366F1' })
  const [savingCategory, setSavingCategory] = useState(false)

  const [fetchError, setFetchError] = useState(null)
  
  // Client rate (for displaying when creating tasks)
  const [clientRate, setClientRate] = useState(175)

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

      if (boardRes.data) {
        setBoard(boardRes.data)
        
        // Fetch client rate if we have a client_id
        if (boardRes.data.client_id) {
          try {
            const { data: rateData } = await supabase
              .from('client_rates')
              .select('hourly_rate')
              .eq('client_id', boardRes.data.client_id)
              .order('effective_date', { ascending: false })
              .limit(1)
              .maybeSingle()
            
            if (rateData?.hourly_rate) {
              setClientRate(rateData.hourly_rate)
            }
          } catch (err) {
            console.log('Client rates table may not exist:', err)
          }
        }
      }
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
        priority: 'medium',
        assigned_to: newTicket.assigned_to && newTicket.assigned_to !== 'unassigned' ? newTicket.assigned_to : null,
        reporter_id: newTicket.reporter_id || user.id,  // Default to current user
        estimated_hours: newTicket.estimated_hours ? parseFloat(newTicket.estimated_hours) : null,
        ticket_type: newTicket.ticket_type || 'task',
        category_id: newTicket.category_id && newTicket.category_id !== 'no-category' ? newTicket.category_id : null,
        due_date: newTicket.due_date || null,
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
      setNewTicket(emptyTicketForm)

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

  // Category management functions
  const openCategoryDialog = (category = null) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({ name: category.name, icon: category.icon || '📁', color: category.color || '#6366F1' })
    } else {
      setEditingCategory(null)
      setCategoryForm({ name: '', icon: '📁', color: '#6366F1' })
    }
    setCategoryDialogOpen(true)
  }

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) {
      toast({ title: 'Category name required', variant: 'destructive' })
      return
    }

    setSavingCategory(true)
    try {
      if (editingCategory) {
        // Update existing
        const { error } = await supabase
          .from('ticket_categories')
          .update({ name: categoryForm.name, icon: categoryForm.icon, color: categoryForm.color })
          .eq('id', editingCategory.id)
        
        if (error) throw error
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? { ...c, ...categoryForm } : c))
        toast({ title: 'Category updated', variant: 'success' })
      } else {
        // Create new
        const { data, error } = await supabase
          .from('ticket_categories')
          .insert({
            name: categoryForm.name,
            icon: categoryForm.icon,
            color: categoryForm.color,
            board_id: boardId,
            client_id: board?.client_id,
            position: categories.length,
          })
          .select()
          .single()
        
        if (error) throw error
        setCategories(prev => [...prev, data])
        toast({ title: 'Category created', variant: 'success' })
      }
      setCategoryDialogOpen(false)
    } catch (error) {
      console.error('Error saving category:', error)
      toast({ title: 'Failed to save category', variant: 'destructive' })
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (categoryId) => {
    if (!confirm('Delete this category? Tasks in this category will become uncategorized.')) return
    
    try {
      const { error } = await supabase
        .from('ticket_categories')
        .delete()
        .eq('id', categoryId)
      
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== categoryId))
      setSelectedCategory('all')
      toast({ title: 'Category deleted', variant: 'success' })
    } catch (error) {
      console.error('Error deleting category:', error)
      toast({ title: 'Failed to delete category', variant: 'destructive' })
    }
  }

  // Common emoji options for categories
  const CATEGORY_ICONS = ['📁', '🎨', '💻', '📝', '📊', '🔧', '🚀', '📱', '🌐', '📈', '💡', '🎯', '⚡', '🔥', '✨']
  const CATEGORY_COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6']

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
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-44">
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
              <div className="border-t mt-1 pt-1">
                <button
                  onClick={(e) => { e.stopPropagation(); openCategoryDialog(); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                >
                  <FolderPlus className="h-4 w-4" />
                  New Category
                </button>
              </div>
            </SelectContent>
          </Select>
          
          {/* Category Management Button */}
          {categories.length > 0 && (
            <Button variant="ghost" size="icon" onClick={() => openCategoryDialog()} title="Manage Categories">
              <FolderPlus className="h-4 w-4" />
            </Button>
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
      <Dialog open={createDialogOpen} onOpenChange={handleDialogChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <div className="flex items-center justify-between gap-4 mt-1">
              <p className="text-sm text-muted-foreground">
                Create a task and assign it to a team member
              </p>
              <div className="flex items-center gap-2">
                {/* Billing Type Indicator */}
                {board?.client?.engagement_type && (
                  <div className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium",
                    board.client.engagement_type === 'retainer' 
                      ? "bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400"
                      : "bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                  )}>
                    {board.client.engagement_type === 'retainer' ? '📅 Retainer' : '🎯 A La Carte'}
                  </div>
                )}
                {/* Client Rate Reminder */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                    ${clientRate}/hr
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-500">client rate</span>
                </div>
              </div>
            </div>
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
                <Label>Assignee</Label>
                <Select
                  value={newTicket.assigned_to}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Reporter</Label>
                <Select
                  value={newTicket.reporter_id || user?.id || ''}
                  onValueChange={(value) => setNewTicket((prev) => ({ ...prev, reporter_id: value }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Select reporter" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                        {member.id === user?.id && <span className="text-muted-foreground ml-1">(you)</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Defaults to you</p>
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

            {/* Due Date */}
            <div>
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Due Date
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="date"
                value={newTicket.due_date}
                onChange={(e) => setNewTicket((prev) => ({ ...prev, due_date: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            {/* Category */}
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
                  <SelectItem value="no-category">No Category</SelectItem>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDialogChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTicket} disabled={saving}>
              {saving ? 'Creating...' : 'Create Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5 text-brand-orange" />
              {editingCategory ? 'Edit Category' : 'New Category'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="categoryName">Name *</Label>
              <Input
                id="categoryName"
                placeholder="e.g., Design, Development, Content"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2 mt-1.5 p-2 border rounded-lg bg-muted/30">
                {CATEGORY_ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setCategoryForm(prev => ({ ...prev, icon }))}
                    className={cn(
                      "w-9 h-9 text-lg rounded-lg flex items-center justify-center transition-all",
                      categoryForm.icon === icon 
                        ? "bg-brand-orange text-white ring-2 ring-brand-orange ring-offset-2" 
                        : "hover:bg-muted"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1.5 p-2 border rounded-lg bg-muted/30">
                {CATEGORY_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setCategoryForm(prev => ({ ...prev, color }))}
                    className={cn(
                      "w-9 h-9 rounded-lg transition-all",
                      categoryForm.color === color && "ring-2 ring-offset-2 ring-foreground"
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Existing categories list for management */}
            {categories.length > 0 && !editingCategory && (
              <div>
                <Label>Existing Categories</Label>
                <div className="mt-1.5 space-y-2 max-h-40 overflow-y-auto">
                  {categories.map((cat) => (
                    <div 
                      key={cat.id} 
                      className="flex items-center justify-between p-2 bg-muted/50 rounded-lg group"
                    >
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-6 h-6 rounded flex items-center justify-center text-white text-sm"
                          style={{ backgroundColor: cat.color }}
                        >
                          {cat.icon}
                        </span>
                        <span className="font-medium text-sm">{cat.name}</span>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon-sm"
                          onClick={() => openCategoryDialog(cat)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon-sm"
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={savingCategory}>
              {savingCategory ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingCategory ? 'Update Category' : 'Create Category'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
