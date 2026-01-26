import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Kanban,
  Archive,
  MoreVertical,
  Edit,
  Trash2,
  Clock,
} from 'lucide-react'
import { getBoards, getClients, createBoard, updateBoard, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatRelativeDate, slugify } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { useToast } from '../hooks/useToast'
import { Skeleton, SkeletonBoard } from '../components/ui/skeleton'

export default function Boards() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()

  const [boards, setBoards] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === 'true')
  const [newBoard, setNewBoard] = useState({
    name: '',
    description: '',
    client_id: '',
    type: 'kanban',
  })
  const [saving, setSaving] = useState(false)

  const [fetchError, setFetchError] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      setFetchError(null)
      
      try {
        // Validate session before fetching - this refreshes token if expiring
        const sessionValid = await ensureValidSession()
        if (!sessionValid) {
          console.warn('[Boards] Session invalid, cannot fetch data')
          setFetchError('Session expired. Please refresh the page or log in again.')
          setLoading(false)
          return
        }
        
        console.log('[Boards] Fetching data...')
        const [boardsRes, clientsRes] = await Promise.all([
          getBoards(),
          getClients(),
        ])
        setBoards(boardsRes.data || [])
        setClients(clientsRes.data || [])
      } catch (error) {
        console.error('Error fetching boards:', error)
        setFetchError(error.message || 'Failed to load boards')
      } finally {
        setLoading(false)
      }
    }

    // Wait for auth to be ready
    if (authLoading) {
      console.log('[Boards] Auth still loading, waiting...')
      return
    }
    
    if (!user) {
      console.log('[Boards] No user after auth loaded')
      setLoading(false)
      return
    }

    fetchData()
  }, [authLoading, user?.id])

  // Filter boards
  const filteredBoards = boards.filter((board) => {
    const matchesSearch = board.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesClient = selectedClient === 'all' || board.client_id === selectedClient
    return matchesSearch && matchesClient
  })

  const handleCreateBoard = async () => {
    if (!newBoard.name || !newBoard.client_id) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      const { data, error } = await createBoard({
        ...newBoard,
        created_by: user.id,
      })

      if (error) throw error

      setBoards((prev) => [{ ...data, client: clients.find(c => c.id === data.client_id) }, ...prev])
      setDialogOpen(false)
      setNewBoard({ name: '', description: '', client_id: '', type: 'kanban' })
      searchParams.delete('new')
      setSearchParams(searchParams)

      toast({
        title: 'Board created',
        description: `${data.name} has been created successfully.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create board. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleArchiveBoard = async (boardId) => {
    try {
      const { error } = await updateBoard(boardId, { is_archived: true })
      if (error) throw error

      setBoards((prev) => prev.filter((b) => b.id !== boardId))
      toast({
        title: 'Board archived',
        description: 'The board has been archived.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to archive board.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
        
        {/* Filters Skeleton */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
          <Skeleton className="h-10 flex-1 max-w-md rounded-lg" />
          <Skeleton className="h-10 w-48 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
        </div>
        
        {/* Grid Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <SkeletonBoard />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold">Boards</h1>
          <p className="text-muted-foreground mt-1">
            Manage your projects across all clients
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Board
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search boards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                  {client.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="icon-sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Boards Grid/List */}
      {filteredBoards.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Kanban className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium mb-2">No boards found</h3>
          <p className="text-muted-foreground mb-6">
            {searchQuery || selectedClient !== 'all'
              ? 'Try adjusting your filters'
              : 'Create your first board to get started'}
          </p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Board
          </Button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={cn(
            viewMode === 'grid'
              ? 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'
              : 'space-y-4'
          )}
        >
          <AnimatePresence mode="popLayout">
            {filteredBoards.map((board, index) => (
              <motion.div
                key={board.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="group card-hover overflow-hidden cursor-pointer">
                  <Link to={`/boards/${board.id}`}>
                    {/* Color bar with animation */}
                    <div
                      className="h-2 transition-all duration-300 group-hover:h-3"
                      style={{ backgroundColor: board.client?.color || '#F7931E' }}
                    />
                    <CardContent className={cn("pt-4", viewMode === 'list' && 'flex items-center gap-4')}>
                      <div className={cn("flex-1", viewMode === 'list' && 'flex items-center gap-4')}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="font-display font-semibold text-lg group-hover:text-brand-orange transition-colors duration-300">
                              {board.name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {board.client?.name || 'No client'}
                            </p>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.preventDefault()}>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.preventDefault()
                                  handleArchiveBoard(board.id)
                                }}
                                className="text-destructive"
                              >
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {board.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                            {board.description}
                          </p>
                        )}

                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Kanban className="h-3.5 w-3.5" />
                            {board.type}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatRelativeDate(board.created_at)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Link>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create Board Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Board</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="boardName">Board Name *</Label>
              <Input
                id="boardName"
                placeholder="e.g., Q1 Marketing Campaign"
                value={newBoard.name}
                onChange={(e) => setNewBoard((prev) => ({ ...prev, name: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="client">Client *</Label>
              <Select
                value={newBoard.client_id}
                onValueChange={(value) => setNewBoard((prev) => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: client.color }}
                        />
                        {client.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="boardType">Board Type</Label>
              <Select
                value={newBoard.type}
                onValueChange={(value) => setNewBoard((prev) => ({ ...prev, type: value }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kanban">
                    <div className="flex items-center gap-2">
                      <Kanban className="h-4 w-4" />
                      Kanban Board
                    </div>
                  </SelectItem>
                  <SelectItem value="list">
                    <div className="flex items-center gap-2">
                      <List className="h-4 w-4" />
                      List View
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                placeholder="Brief description of the board"
                value={newBoard.description}
                onChange={(e) => setNewBoard((prev) => ({ ...prev, description: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateBoard} disabled={saving}>
              {saving ? 'Creating...' : 'Create Board'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
