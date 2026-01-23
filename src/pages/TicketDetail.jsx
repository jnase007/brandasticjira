import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Edit,
  Trash2,
  MessageSquare,
  Paperclip,
  Send,
  Upload,
  X,
  File,
  Image as ImageIcon,
  Download,
  MoreVertical,
  Calendar,
  User,
  Tag,
  Check,
  Loader2,
  Save,
} from 'lucide-react'
import {
  getTicket,
  updateTicket,
  deleteTicket,
  getComments,
  createComment,
  getTeamMembers,
  uploadAttachment,
  deleteAttachment,
} from '../lib/supabase'
import { useCommentsRealtime } from '../hooks/useRealtime'
import { useAuth } from '../contexts/AuthContext'
import {
  cn,
  formatDate,
  formatRelativeDate,
  getStatusInfo,
  getPriorityInfo,
  getInitials,
  formatFileSize,
  getFileIcon,
} from '../lib/utils'
import TimeTracker from '../components/TimeTracker'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
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
  DialogFooter,
} from '../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useToast } from '../hooks/useToast'
import { useAutosave } from '../hooks/useAutosave'
import { FileUpload, InlineFileUpload } from '../components/FileUpload'

export default function TicketDetail() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { toast } = useToast()

  const [ticket, setTicket] = useState(null)
  const [comments, setComments] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [editedTicket, setEditedTicket] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)

  // Autosave function
  const autosaveFn = useCallback(async (data) => {
    if (!ticketId || !editMode) return
    
    await updateTicket(ticketId, {
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      assigned_to: data.assigned_to || null,
      due_date: data.due_date || null,
      estimated_hours: data.estimated_hours || null,
      tags: data.tags || [],
    })
    
    setTicket((prev) => ({ ...prev, ...data }))
  }, [ticketId, editMode])

  // Use autosave hook
  const { 
    isSaving: isAutosaving, 
    hasUnsavedChanges, 
    isEnabled: autosaveEnabled,
    saveNow: manualSave,
  } = useAutosave(autosaveFn, editedTicket, {
    delay: 1500,
    saveMessage: 'Ticket saved',
    showToast: true,
  })

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!ticketId) return

    setLoading(true)
    try {
      const [ticketRes, commentsRes, teamRes] = await Promise.all([
        getTicket(ticketId),
        getComments(ticketId),
        getTeamMembers(),
      ])

      if (ticketRes.data) {
        setTicket(ticketRes.data)
        setEditedTicket(ticketRes.data)
      }
      if (commentsRes.data) setComments(commentsRes.data)
      if (teamRes.data) setTeamMembers(teamRes.data)
    } catch (error) {
      console.error('Error fetching ticket:', error)
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Real-time comments
  useCommentsRealtime(ticketId, {
    onInsert: (comment) => {
      // Avoid duplicates
      setComments((prev) => {
        if (prev.find((c) => c.id === comment.id)) return prev
        return [...prev, comment]
      })
    },
  })

  // Save ticket edits
  const handleSave = async () => {
    setSaving(true)
    try {
      const { data, error } = await updateTicket(ticketId, {
        title: editedTicket.title,
        description: editedTicket.description,
        status: editedTicket.status,
        priority: editedTicket.priority,
        assigned_to: editedTicket.assigned_to || null,
        due_date: editedTicket.due_date || null,
        estimated_hours: editedTicket.estimated_hours || null,
        tags: editedTicket.tags || [],
      })

      if (error) throw error

      setTicket({ ...ticket, ...data })
      setEditMode(false)
      toast({
        title: 'Task updated',
        description: 'Your changes have been saved.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Delete ticket
  const handleDelete = async () => {
    try {
      const { error } = await deleteTicket(ticketId)
      if (error) throw error

      toast({
        title: 'Task deleted',
        description: 'The task has been removed.',
      })
      navigate(`/boards/${ticket.board_id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete task.',
        variant: 'destructive',
      })
    }
  }

  // Add comment
  const handleAddComment = async () => {
    if (!newComment.trim()) return

    setSendingComment(true)
    try {
      const { data, error } = await createComment({
        ticket_id: ticketId,
        user_id: user.id,
        content: newComment,
      })

      if (error) throw error

      setComments((prev) => [...prev, { ...data, user: profile }])
      setNewComment('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to add comment.',
        variant: 'destructive',
      })
    } finally {
      setSendingComment(false)
    }
  }

  // Upload attachment
  const handleFileUpload = async (e) => {
    const files = e.target.files
    if (!files?.length) return

    setUploadingFile(true)
    try {
      const uploadPromises = Array.from(files).map((file) =>
        uploadAttachment(file, ticket.client_id, ticketId)
      )
      const results = await Promise.all(uploadPromises)

      const newAttachments = results
        .filter((r) => r.data)
        .map((r) => r.data)

      if (newAttachments.length > 0) {
        const updatedAttachments = [...(ticket.attachments || []), ...newAttachments]
        const { error } = await updateTicket(ticketId, { attachments: updatedAttachments })

        if (error) throw error

        setTicket((prev) => ({ ...prev, attachments: updatedAttachments }))
        toast({
          title: 'Files uploaded',
          description: `${newAttachments.length} file(s) uploaded successfully.`,
          variant: 'success',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to upload files.',
        variant: 'destructive',
      })
    } finally {
      setUploadingFile(false)
      e.target.value = ''
    }
  }

  // Remove attachment
  const handleRemoveAttachment = async (attachment) => {
    try {
      await deleteAttachment(attachment.path)
      const updatedAttachments = ticket.attachments.filter((a) => a.path !== attachment.path)
      await updateTicket(ticketId, { attachments: updatedAttachments })
      setTicket((prev) => ({ ...prev, attachments: updatedAttachments }))
      toast({
        title: 'Attachment removed',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to remove attachment.',
        variant: 'destructive',
      })
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <div className="h-8 w-48 bg-muted rounded shimmer mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 bg-muted rounded-xl shimmer" />
            <div className="h-64 bg-muted rounded-xl shimmer" />
          </div>
          <div className="h-96 bg-muted rounded-xl shimmer" />
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium mb-2">Ticket not found</h2>
        <p className="text-muted-foreground mb-4">
          This ticket may have been deleted or you don't have access.
        </p>
        <Button asChild>
          <Link to="/boards">Back to Boards</Link>
        </Button>
      </div>
    )
  }

  const priorityInfo = getPriorityInfo(ticket.priority)

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={`/boards/${ticket.board_id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-muted-foreground">
                {ticket.ticket_id}
              </span>
              <Badge variant={ticket.status}>{getStatusInfo(ticket.status).label}</Badge>
            </div>
            <h1 className="text-2xl font-display font-bold mt-1">{ticket.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              {/* Autosave indicator */}
              <AnimatePresence>
                {autosaveEnabled && (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground mr-2"
                  >
                    {isAutosaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-brand-orange" />
                        <span>Saving...</span>
                      </>
                    ) : hasUnsavedChanges ? (
                      <>
                        <div className="h-2 w-2 rounded-full bg-yellow-500" />
                        <span>Unsaved</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-green-500">Saved</span>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
              
              <Button variant="outline" onClick={() => {
                setEditMode(false)
                setEditedTicket(ticket)
              }}>
                Cancel
              </Button>
              {!autosaveEnabled && (
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditMode(true)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-card p-6"
          >
            {editMode ? (
              <div className="space-y-4">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={editedTicket.title}
                    onChange={(e) => setEditedTicket((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={editedTicket.description || ''}
                    onChange={(e) => setEditedTicket((prev) => ({ ...prev, description: e.target.value }))}
                    className="mt-1.5 min-h-[150px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Status</Label>
                    <Select
                      value={editedTicket.status}
                      onValueChange={(value) => setEditedTicket((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todo">To Do</SelectItem>
                        <SelectItem value="inprogress">In Progress</SelectItem>
                        <SelectItem value="done">Done</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={editedTicket.priority}
                      onValueChange={(value) => setEditedTicket((prev) => ({ ...prev, priority: value }))}
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
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Assignee</Label>
                    <Select
                      value={editedTicket.assigned_to || ''}
                      onValueChange={(value) => setEditedTicket((prev) => ({ ...prev, assigned_to: value }))}
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
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={editedTicket.due_date || ''}
                      onChange={(e) => setEditedTicket((prev) => ({ ...prev, due_date: e.target.value }))}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-medium mb-3">Description</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {ticket.description || 'No description provided.'}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Tag className="h-3 w-3" /> Priority
                    </p>
                    <Badge variant={ticket.priority}>{priorityInfo.label}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <User className="h-3 w-3" /> Assignee
                    </p>
                    {ticket.assigned_user ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={ticket.assigned_user.avatar_url} />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(ticket.assigned_user.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{ticket.assigned_user.full_name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Due Date
                    </p>
                    <span className="text-sm">
                      {ticket.due_date ? formatDate(ticket.due_date) : 'Not set'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Estimated</p>
                    <span className="text-sm">
                      {ticket.estimated_hours ? `${ticket.estimated_hours}h` : 'Not set'}
                    </span>
                  </div>
                </div>
              </>
            )}
          </motion.div>

          {/* Tabs for Comments & Attachments */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Tabs defaultValue="comments">
              <TabsList>
                <TabsTrigger value="comments">
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Comments ({comments.length})
                </TabsTrigger>
                <TabsTrigger value="attachments">
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attachments ({ticket.attachments?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="comments" className="mt-4">
                {/* Comments List */}
                <div className="space-y-4 mb-4 max-h-[400px] overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No comments yet. Be the first to comment!
                    </p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.user?.avatar_url} />
                          <AvatarFallback className="text-xs">
                            {getInitials(comment.user?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">
                              {comment.user?.full_name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeDate(comment.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment */}
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile?.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {getInitials(profile?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                    />
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || sendingComment}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4">
                <FileUpload
                  bucket="documents"
                  folder={`tickets/${ticketId}`}
                  accept="all"
                  multiple={true}
                  maxFiles={20}
                  existingFiles={(ticket.attachments || []).map((a, i) => ({
                    id: a.path || `existing-${i}`,
                    name: a.name,
                    size: a.size,
                    type: a.type,
                    url: a.url,
                    path: a.path,
                  }))}
                  onUpload={async (file) => {
                    // Add to ticket attachments
                    const updatedAttachments = [
                      ...(ticket.attachments || []),
                      {
                        name: file.name,
                        url: file.url,
                        type: file.type,
                        size: file.size,
                        path: file.path,
                        uploadedAt: file.uploadedAt,
                      },
                    ]
                    await updateTicket(ticketId, { attachments: updatedAttachments })
                    setTicket((prev) => ({ ...prev, attachments: updatedAttachments }))
                  }}
                  onRemove={async (file) => {
                    // Remove from ticket attachments
                    const updatedAttachments = (ticket.attachments || []).filter(
                      (a) => a.path !== file.path && a.url !== file.url
                    )
                    await updateTicket(ticketId, { attachments: updatedAttachments })
                    setTicket((prev) => ({ ...prev, attachments: updatedAttachments }))
                  }}
                />
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Time Tracker */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <TimeTracker
              ticketId={ticketId}
              clientId={ticket.client_id}
              onTimeLogged={fetchData}
            />
          </motion.div>

          {/* Meta Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-xl border bg-card p-4"
          >
            <h4 className="font-medium mb-3">Details</h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Board</span>
                <Link
                  to={`/boards/${ticket.board_id}`}
                  className="text-primary hover:underline"
                >
                  {ticket.board?.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Client</span>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ticket.client?.color }}
                  />
                  <span>{ticket.client?.name}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(ticket.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatRelativeDate(ticket.updated_at)}</span>
              </div>
              {ticket.creator && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Created by</span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={ticket.creator.avatar_url} />
                      <AvatarFallback className="text-[8px]">
                        {getInitials(ticket.creator.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{ticket.creator.full_name}</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Ticket</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete <strong>{ticket.ticket_id}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
