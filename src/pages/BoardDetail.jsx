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
} from 'lucide-react'
import { 
  getBoard, 
  getTickets, 
  createTicket, 
  updateTicketPositions,
  getTeamMembers,
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

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'status-todo' },
  { id: 'inprogress', label: 'In Progress', color: 'status-inprogress' },
  { id: 'done', label: 'Done', color: 'status-done' },
]

export default function BoardDetail() {
  const { boardId } = useParams()
  const { user } = useAuth()
  const { toast } = useToast()

  const [board, setBoard] = useState(null)
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    estimated_hours: '',
  })
  const [saving, setSaving] = useState(false)

  // Fetch board and tickets
  const fetchData = useCallback(async () => {
    if (!boardId) return

    setLoading(true)
    try {
      const [boardRes, ticketsRes, teamRes] = await Promise.all([
        getBoard(boardId),
        getTickets(boardId),
        getTeamMembers(),
      ])

      if (boardRes.data) setBoard(boardRes.data)
      if (ticketsRes.data) setTickets(ticketsRes.data)
      if (teamRes.data) setTeamMembers(teamRes.data)
    } catch (error) {
      console.error('Error fetching board data:', error)
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

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

  // Group tickets by status
  const groupedTickets = groupTicketsByStatus(
    tickets.filter((t) => 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.ticket_id.toLowerCase().includes(searchQuery.toLowerCase())
    )
  )

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
          description: 'Failed to update ticket position.',
          variant: 'destructive',
        })
        // Revert on error
        fetchData()
      }
    }
  }

  // Create ticket
  const handleCreateTicket = async () => {
    if (!newTicket.title.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please enter a ticket title.',
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
        board_id: boardId,
        client_id: board.client_id,
        created_by: user.id,
        status: 'todo',
        position: groupedTickets.todo.length,
      }

      const { data, error } = await createTicket(ticketData)
      if (error) throw error

      setTickets((prev) => [...prev, data])
      setCreateDialogOpen(false)
      setNewTicket({
        title: '',
        description: '',
        priority: 'medium',
        assigned_to: '',
        estimated_hours: '',
      })

      toast({
        title: 'Ticket created',
        description: `${data.ticket_id} has been created.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create ticket.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-48 bg-muted rounded shimmer mb-8" />
        <div className="flex gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-80 h-96 bg-muted rounded-xl shimmer" />
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
    <div className="p-6">
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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tickets..."
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
            Add Ticket
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar">
          {COLUMNS.map((column) => {
            const columnTickets = groupedTickets[column.id] || []
            const statusInfo = getStatusInfo(column.id)

            return (
              <div key={column.id} className="kanban-column flex-shrink-0">
                {/* Column Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={column.id} className="font-medium">
                      {column.label}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {columnTickets.length}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setCreateDialogOpen(true)}
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
                        <div className="text-center py-8 text-sm text-muted-foreground">
                          No tickets
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

      {/* Create Ticket Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
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
