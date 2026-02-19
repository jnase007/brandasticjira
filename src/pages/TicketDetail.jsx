import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useLocation, Link, useNavigate } from 'react-router-dom'
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
  Clock,
  User,
  Tag,
  Check,
  Loader2,
  Save,
  Circle,
  PlayCircle,
  CheckCircle2,
  ChevronRight,
  Eye,
  UserCheck,
  ThumbsUp,
  Receipt,
  XCircle,
  AlertTriangle,
  Target,
  ClipboardList,
  RefreshCw,
  Pencil,
} from 'lucide-react'
import {
  getTicket,
  getTicketByTicketId,
  updateTicket,
  deleteTicket,
  getComments,
  createComment,
  logActivity,
  getTeamMembers,
  getTimeEntries,
  deleteTimeEntry,
  updateTimeEntry,
  uploadAttachment,
  deleteAttachment,
  ensureValidSession,
} from '../lib/supabase'
import { useCommentsRealtime } from '../hooks/useRealtime'
import { useAuth } from '../contexts/AuthContext'
import {
  cn,
  formatDate,
  formatDuration,
  formatRelativeDate,
  getStatusInfo,
  getInitials,
  formatFileSize,
  getFileIcon,
  isUuid,
} from '../lib/utils'
import TimeTracker from '../components/TimeTracker'
import MentionInput, { sendMentionNotifications, MentionText } from '../components/MentionInput'
import DescriptionEditor from '../components/DescriptionEditor'
import MarkdownContent from '../components/MarkdownContent'
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

// Status Pipeline Component - Shows ticket's position in the workflow
// 7 statuses for tasks, 3 for client homework
const TASK_STATUS_STEPS = [
  { id: 'new', label: 'New', icon: Circle, color: 'bg-slate-400', activeColor: 'bg-slate-500', glowColor: 'shadow-slate-500/50' },
  { id: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'bg-slate-400', activeColor: 'bg-amber-500', glowColor: 'shadow-amber-500/50' },
  { id: 'internal_review', label: 'Internal Review', icon: Eye, color: 'bg-slate-400', activeColor: 'bg-purple-500', glowColor: 'shadow-purple-500/50' },
  { id: 'client_review', label: 'Client Review', icon: UserCheck, color: 'bg-slate-400', activeColor: 'bg-blue-500', glowColor: 'shadow-blue-500/50' },
  { id: 'approved', label: 'Approved', icon: ThumbsUp, color: 'bg-slate-400', activeColor: 'bg-emerald-500', glowColor: 'shadow-emerald-500/50' },
  { id: 'ready_for_billing', label: 'Ready for Billing', icon: Receipt, color: 'bg-slate-400', activeColor: 'bg-orange-500', glowColor: 'shadow-orange-500/50' },
  { id: 'closed', label: 'Closed', icon: CheckCircle2, color: 'bg-slate-400', activeColor: 'bg-green-500', glowColor: 'shadow-green-500/50' },
]

const HOMEWORK_STATUS_STEPS = [
  { id: 'new', label: 'New', icon: Circle, color: 'bg-slate-400', activeColor: 'bg-slate-500', glowColor: 'shadow-slate-500/50' },
  { id: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'bg-slate-400', activeColor: 'bg-amber-500', glowColor: 'shadow-amber-500/50' },
  { id: 'closed', label: 'Closed', icon: CheckCircle2, color: 'bg-slate-400', activeColor: 'bg-green-500', glowColor: 'shadow-green-500/50' },
]

// Legacy status mapping for backwards compatibility
const STATUS_MAP = {
  'todo': 'new',
  'inprogress': 'in_progress',
  'done': 'closed',
}

// Fallback for old code
const STATUS_STEPS = TASK_STATUS_STEPS

function StatusPipeline({ currentStatus, onStatusChange, disabled, ticketType = 'task' }) {
  // Use appropriate status steps based on ticket type
  const statusSteps = ticketType === 'client_homework' ? HOMEWORK_STATUS_STEPS : TASK_STATUS_STEPS
  
  // Map legacy status to new status
  const normalizedStatus = STATUS_MAP[currentStatus] || currentStatus
  const currentIndex = statusSteps.findIndex(s => s.id === normalizedStatus)
  
  // Generate gradient based on progress
  const getGradient = () => {
    const progress = currentIndex / (statusSteps.length - 1)
    if (normalizedStatus === 'closed') return 'linear-gradient(90deg, #64748b, #f59e0b, #22c55e)'
    if (progress > 0.7) return 'linear-gradient(90deg, #64748b, #8b5cf6, #3b82f6, #f59e0b)'
    if (progress > 0.3) return 'linear-gradient(90deg, #64748b, #8b5cf6, #f59e0b)'
    return 'linear-gradient(90deg, #64748b, #64748b)'
  }
  
  return (
    <div className="relative">
      {/* Background track */}
      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-gradient-to-r from-slate-200 via-slate-200 to-slate-200 dark:from-slate-700 dark:via-slate-700 dark:to-slate-700 rounded-full" />
      
      {/* Progress fill */}
      <motion.div 
        className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full"
        initial={false}
        animate={{ 
          width: `${Math.max(0, (currentIndex / (statusSteps.length - 1)) * 100)}%`,
          background: getGradient()
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
      
      {/* Status steps */}
      <div className="relative flex justify-between items-center">
        {statusSteps.map((step, index) => {
          const Icon = step.icon
          const isActive = step.id === normalizedStatus
          const isPast = index < currentIndex
          const isFuture = index > currentIndex
          
          return (
            <motion.button
              key={step.id}
              onClick={() => !disabled && onStatusChange?.(step.id)}
              disabled={disabled}
              className={cn(
                "relative flex flex-col items-center gap-2 p-1 sm:p-2 rounded-xl transition-all duration-300",
                !disabled && "cursor-pointer hover:bg-white/50 dark:hover:bg-slate-800/50",
                disabled && "cursor-default"
              )}
              whileHover={!disabled ? { scale: 1.05 } : {}}
              whileTap={!disabled ? { scale: 0.95 } : {}}
            >
              {/* Icon circle */}
              <motion.div
                className={cn(
                  "relative flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-full border-2 transition-all duration-300",
                  isActive && `${step.activeColor} border-transparent shadow-lg ${step.glowColor}`,
                  isPast && "bg-green-500 border-transparent",
                  isFuture && "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600"
                )}
                animate={isActive ? { 
                  boxShadow: ['0 0 0 0 rgba(99,102,241,0.4)', '0 0 0 10px rgba(99,102,241,0)']
                } : {}}
                transition={isActive ? { duration: 1.5, repeat: Infinity } : {}}
              >
                <Icon className={cn(
                  "w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 transition-colors duration-300",
                  isActive && "text-white",
                  isPast && "text-white",
                  isFuture && "text-slate-400 dark:text-slate-500"
                )} />
                
                {/* Active indicator pulse */}
                {isActive && (
                  <motion.div
                    className={cn("absolute inset-0 rounded-full", step.activeColor)}
                    initial={{ opacity: 0.5, scale: 1 }}
                    animate={{ opacity: 0, scale: 1.5 }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                )}
              </motion.div>
              
              {/* Label - hidden on small screens, visible on medium+ */}
              <span className={cn(
                "hidden sm:block text-[10px] sm:text-xs font-medium transition-colors duration-300 whitespace-nowrap",
                isActive && "text-foreground font-semibold",
                isPast && "text-green-600 dark:text-green-400",
                isFuture && "text-muted-foreground"
              )}>
                {step.label}
              </span>
              
              {/* Current status badge */}
              {isActive && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "absolute -bottom-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white",
                    step.activeColor
                  )}
                >
                  CURRENT
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

export default function TicketDetail() {
  const { ticketId, clientSlug } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [ticket, setTicket] = useState(null)
  const [resolvedTicketId, setResolvedTicketId] = useState(null)
  const [comments, setComments] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const editSnapshotRef = useRef(null) // ticket state when edit mode was opened (for Cancel revert)
  const [editedTicket, setEditedTicket] = useState({})
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState([])
  const [sendingComment, setSendingComment] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [showAttachments, setShowAttachments] = useState(false)
  const [editingTimeEntry, setEditingTimeEntry] = useState(null)
  const [savingTimeEntry, setSavingTimeEntry] = useState(false)

  const activeTicketId = resolvedTicketId || (isUuid(ticketId) ? ticketId : null)

  const startAfterDueError = useMemo(() => {
    const start = editedTicket.start_date
    const due = editedTicket.due_date
    if (!start || !due) return null
    if (new Date(start) > new Date(due)) return 'Start date cannot be after due date.'
    return null
  }, [editedTicket.start_date, editedTicket.due_date])

  // Snapshot ticket only when entering edit mode so Cancel can revert to that state
  const prevEditModeRef = useRef(false)
  useEffect(() => {
    if (editMode && !prevEditModeRef.current && ticket) {
      editSnapshotRef.current = { ...ticket }
    }
    if (!editMode) editSnapshotRef.current = null
    prevEditModeRef.current = editMode
  }, [editMode, ticket])

  // Autosave function - use server response so Updated and other fields stay in sync
  const autosaveFn = useCallback(async (data) => {
    if (!activeTicketId || !editMode) return
    if (data.start_date && data.due_date && new Date(data.start_date) > new Date(data.due_date)) return

    const res = await updateTicket(activeTicketId, {
      title: data.title,
      description: data.description,
      status: data.status,
      assigned_to: data.assigned_to || null,
      reporter_id: data.reporter_id || null,
      due_date: data.due_date || null,
      start_date: data.start_date || null,
      estimated_hours: data.estimated_hours || null,
      tags: data.tags || [],
    })
    if (res.data) setTicket((prev) => ({ ...prev, ...res.data }))
  }, [activeTicketId, editMode])

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

  const [fetchError, setFetchError] = useState(null)

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!ticketId) return

    setLoading(true)
    setFetchError(null)
    
    try {
      // Validate session before fetching - this refreshes token if expiring
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[TicketDetail] Session invalid, cannot fetch data')
        setFetchError('Session expired. Please refresh the page or log in again.')
        setLoading(false)
        return
      }
      
      const ticketRes = isUuid(ticketId)
        ? await getTicket(ticketId)
        : await getTicketByTicketId(ticketId)

      if (ticketRes.data) {
        setTicket(ticketRes.data)
        setEditedTicket(ticketRes.data)
        setResolvedTicketId(ticketRes.data.id)
      }

      const [commentsRes, teamRes, timeRes] = await Promise.all([
        ticketRes.data ? getComments(ticketRes.data.id) : Promise.resolve({ data: [] }),
        getTeamMembers(),
        ticketRes.data ? getTimeEntries(ticketRes.data.id) : Promise.resolve({ data: [] }),
      ])

      if (commentsRes.data) setComments(commentsRes.data)
      if (teamRes.data) {
        let members = teamRes.data
        // Ensure the assigned user is in the list even if they aren't a standard team member
        // This fixes the bug where assigned users don't show in the dropdown
        if (ticketRes.data?.assigned_user && !members.find(m => m.id === ticketRes.data.assigned_to)) {
          members = [...members, ticketRes.data.assigned_user]
        }
        setTeamMembers(members)
      }
      if (timeRes.data) {
        const normalizedEntries = timeRes.data.map((entry) => ({
          ...entry,
          minutes: entry.minutes ?? entry.duration_minutes ?? 0,
          date:
            entry.date ||
            (entry.start_time ? entry.start_time.split('T')[0] : entry.created_at?.split('T')[0]),
        }))
        setTimeEntries(normalizedEntries)
      }
    } catch (error) {
      console.error('Error fetching ticket:', error)
      setFetchError(error.message || 'Failed to load ticket')
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchData()
  }, [fetchData, authLoading, user?.id])

  // Use short ticket URL (e.g. /clients/brandastic/tickets/BC-1) whenever we have a short ticket_id
  const isShortTicketKey = ticket?.ticket_id && /^[A-Z]{2,3}-\d+$/.test(ticket.ticket_id)
  useEffect(() => {
    if (!ticket?.ticket_id || !isShortTicketKey) return
    const slug = ticket.client?.slug || clientSlug
    const canonicalPath = slug
      ? `/clients/${slug}/tickets/${ticket.ticket_id}`
      : `/tickets/${ticket.ticket_id}`
    if (location.pathname !== canonicalPath) {
      navigate(canonicalPath, { replace: true })
    }
  }, [ticket?.id, ticket?.ticket_id, ticket?.client?.slug, ticketId, clientSlug, location.pathname, navigate, isShortTicketKey])

  // Real-time comments
  useCommentsRealtime(activeTicketId, {
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
    if (!activeTicketId) {
      toast({
        title: 'Unable to save',
        description: 'Ticket is still loading. Please try again in a moment.',
        variant: 'destructive',
      })
      return
    }
    setSaving(true)
    try {
      const { data, error } = await updateTicket(activeTicketId, {
        title: editedTicket.title,
        description: editedTicket.description,
        status: editedTicket.status,
        assigned_to: editedTicket.assigned_to || null,
        reporter_id: editedTicket.reporter_id || null,
        due_date: editedTicket.due_date || null,
        start_date: editedTicket.start_date || null,
        estimated_hours: editedTicket.estimated_hours || null,
        ticket_type: editedTicket.ticket_type || 'task',
        resolution: editedTicket.resolution || 'unresolved',
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
    if (!activeTicketId) {
      toast({
        title: 'Unable to delete',
        description: 'Ticket is still loading. Please try again in a moment.',
        variant: 'destructive',
      })
      return
    }
    try {
      const { error } = await deleteTicket(activeTicketId)
      if (error) throw error

      toast({
        title: 'Task deleted',
        description: 'The task has been removed.',
      })
      navigate(ticket?.board_id ? `/boards/${ticket.board_id}` : '/boards')
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
    if (!activeTicketId) {
      toast({
        title: 'Unable to add comment',
        description: 'Ticket is still loading. Please try again in a moment.',
        variant: 'destructive',
      })
      return
    }

    setSendingComment(true)
    try {
      const { data, error } = await createComment({
        ticket_id: activeTicketId,
        user_id: user.id,
        content: newComment,
      })

      if (error) throw error

      setComments((prev) => [...prev, { ...data, user: profile }])
      
      // Send mention notifications
      if (mentionedUserIds.length > 0) {
        await sendMentionNotifications({
          mentionedUserIds,
          fromUserId: user.id,
          fromUserName: profile?.full_name || 'Someone',
          entityType: 'ticket',
          entityId: activeTicketId,
          entityName: ticket?.ticket_id || ticket?.title,
          messagePreview: newComment,
          clientId: ticket?.client_id || ticket?.client?.id,
        })
      }
      
      setNewComment('')
      setMentionedUserIds([])
      logActivity({
        activity_type: 'comment_added',
        user_id: user?.id,
        client_id: ticket?.client_id || ticket?.client?.id,
        entity_type: 'ticket',
        entity_id: activeTicketId,
        entity_name: ticket?.ticket_id || ticket?.title,
      })
    } catch (error) {
      const errorMessage = error?.message || 'Failed to add comment.'
      toast({
        title: 'Error',
        description: errorMessage,
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
    if (!activeTicketId) {
      toast({
        title: 'Unable to upload files',
        description: 'Ticket is still loading. Please try again in a moment.',
        variant: 'destructive',
      })
      return
    }

    setUploadingFile(true)
    try {
      const uploadPromises = Array.from(files).map((file) =>
        uploadAttachment(file, ticket.client_id, activeTicketId)
      )
      const results = await Promise.all(uploadPromises)

      const newAttachments = results
        .filter((r) => r.data)
        .map((r) => r.data)

      if (newAttachments.length > 0) {
        const updatedAttachments = [...(ticket.attachments || []), ...newAttachments]
        const { data, error } = await updateTicket(activeTicketId, { attachments: updatedAttachments })

        if (error) throw error

        setTicket((prev) => (data ? { ...prev, ...data } : { ...prev, attachments: updatedAttachments }))
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
      const { data } = await updateTicket(activeTicketId, { attachments: updatedAttachments })
      setTicket((prev) => (data ? { ...prev, ...data } : { ...prev, attachments: updatedAttachments }))
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
        <div className="flex items-center gap-3 mb-6">
          <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
          <span className="text-muted-foreground">Loading task...</span>
        </div>
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-6" />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-48 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
          </div>
          <div className="h-96 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />
        </div>
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="p-6 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-medium mb-2">Error loading task</h2>
        <p className="text-muted-foreground mb-4">
          {fetchError}
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Page
          </Button>
          <Button asChild>
            <Link to="/taskboard">Back to Task Board</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium mb-2">Task not found</h2>
        <p className="text-muted-foreground mb-4">
          This task may have been deleted or you don't have access.
        </p>
        <p className="text-xs text-muted-foreground mb-4 font-mono">
          Attempted ID: {ticketId}
        </p>
        <Button asChild>
          <Link to="/taskboard">Back to Task Board</Link>
        </Button>
      </div>
    )
  }

  const boardLink = ticket?.board_id ? `/boards/${ticket.board_id}` : '/boards'
  const displayTicketKey = (() => {
    const key = ticket?.ticket_id || (ticket?.id ? `TASK-${String(ticket.id).slice(0, 8)}` : ticketId) || ''
    return String(key).trim() || '—'
  })()

  // Handle status change from pipeline
  const handleStatusChange = async (newStatus) => {
    if (newStatus === ticket.status) return
    
    setSaving(true)
    try {
      const { data, error } = await updateTicket(ticket.id, { status: newStatus })
      if (error) throw error
      
      setTicket(data)
      logActivity({
        activity_type: 'status_changed',
        user_id: user?.id,
        client_id: ticket.client?.id,
        entity_type: 'ticket',
        entity_id: ticket.id,
        entity_name: ticket.ticket_id,
        metadata: { from_status: ticket.status, to_status: newStatus },
      })
      
      toast({
        title: 'Status updated',
        description: `Moved to ${getStatusInfo(newStatus).label}`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update status.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* Client Banner - Prominent display at top */}
      {ticket.client && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Link 
            to={`/clients/${ticket.client_id}`}
            className="flex items-center gap-4 p-4 rounded-xl border bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 hover:shadow-md transition-all group"
          >
            {/* Client Logo */}
            {ticket.client.logo_url ? (
              <div className="flex-shrink-0 w-14 h-14 rounded-xl overflow-hidden bg-white shadow-sm border">
                <img 
                  src={ticket.client.logo_url} 
                  alt={ticket.client.name} 
                  className="w-full h-full object-contain p-1"
                />
              </div>
            ) : (
              <div 
                className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center text-white text-xl font-bold shadow-sm"
                style={{ backgroundColor: ticket.client.color || '#F7931E' }}
              >
                {ticket.client.name?.charAt(0) || 'C'}
              </div>
            )}
            
            {/* Client Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold truncate group-hover:text-brand-orange transition-colors">
                  {ticket.client.name}
                </h2>
                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-sm text-muted-foreground">
                Client • Click to view client details
              </p>
            </div>
            
            {/* Client Color Indicator */}
            <div 
              className="flex-shrink-0 w-3 h-12 rounded-full"
              style={{ backgroundColor: ticket.client.color || '#F7931E' }}
            />
          </Link>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate(-1)}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <div>
            {/* Ticket number - always visible at top of page (QA: ticket key on task) */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-flex items-center font-mono text-base font-semibold min-w-[4rem] text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 border border-orange-200 dark:border-orange-700 px-2.5 py-1 rounded-md"
                title="Ticket number"
              >
                {displayTicketKey}
              </span>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-brand-orange"
                onClick={() => {
                  // Copy a URL that actually resolves: use real ticket_id from DB, or full UUID
                  const linkKey = ticket.ticket_id?.trim() || ticket.id
                  const path = (ticket.client?.slug || ticket.client_id)
                    ? `/clients/${ticket.client?.slug || ticket.client_id}/tickets/${linkKey}`
                    : `/tickets/${linkKey}`
                  const url = `${window.location.origin}${path}`
                  navigator.clipboard.writeText(url)
                  toast({
                    title: 'Link copied!',
                    description: `${displayTicketKey} link copied to clipboard`,
                    variant: 'success',
                  })
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                </svg>
              </Button>
            </div>
            <h1 className="text-2xl font-display font-bold">{ticket.title}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              {/* Saved indicator + Close (grouped so Close is clearly to the right of Saved) */}
              <div className="flex items-center gap-2 mr-2">
                <AnimatePresence>
                  {autosaveEnabled && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditMode(false)
                    setEditedTicket(ticket)
                  }}
                >
                  Close
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const snapshot = editSnapshotRef.current
                  if (snapshot && activeTicketId) {
                    try {
                      const { data, error } = await updateTicket(activeTicketId, {
                        title: snapshot.title,
                        description: snapshot.description,
                        status: snapshot.status,
                        assigned_to: snapshot.assigned_to ?? null,
                        reporter_id: snapshot.reporter_id ?? null,
                        due_date: snapshot.due_date ?? null,
                        start_date: snapshot.start_date ?? null,
                        estimated_hours: snapshot.estimated_hours ?? null,
                        tags: snapshot.tags ?? [],
                      })
                      if (error) throw error
                      if (data) {
                        setTicket(data)
                        setEditedTicket(data)
                      } else {
                        setTicket(snapshot)
                        setEditedTicket(snapshot)
                      }
                    } catch (err) {
                      toast({
                        title: 'Error',
                        description: 'Could not revert changes.',
                        variant: 'destructive',
                      })
                      return
                    }
                  } else {
                    await fetchData()
                  }
                  setEditMode(false)
                }}
              >
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
      
      {/* Status Pipeline - Visual workflow indicator */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8 p-6 rounded-xl border bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800 shadow-sm"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Workflow Status
            </h3>
            {ticket.ticket_type === 'client_homework' && (
              <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                <UserCheck className="h-3 w-3 mr-1" />
                Client Homework
              </Badge>
            )}
            {ticket.resolution === 'resolved' && (
              <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Resolved
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Click a status to move this task
          </span>
        </div>
        <StatusPipeline 
          currentStatus={ticket.status} 
          onStatusChange={handleStatusChange}
          disabled={saving}
          ticketType={ticket.ticket_type}
        />
      </motion.div>

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
                  <DescriptionEditor
                    value={editedTicket.description || ''}
                    onChange={(value) => setEditedTicket((prev) => ({ ...prev, description: value }))}
                    onFileUpload={async (file) => {
                      // Add dropped file to ticket attachments
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
                      const { data, error } = await updateTicket(activeTicketId, { attachments: updatedAttachments })
                      if (!error) {
                        setTicket((prev) => (data ? { ...prev, ...data } : { ...prev, attachments: updatedAttachments }))
                      }
                    }}
                    bucket="documents"
                    folder={`${ticket.client_id}/${activeTicketId || ticketId}`}
                    className="mt-1.5"
                    minHeight="150px"
                  />
                </div>
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
                      <SelectItem value="new">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3 text-slate-500" />
                          New
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <PlayCircle className="h-3 w-3 text-amber-500" />
                          In Progress
                        </div>
                      </SelectItem>
                      <SelectItem value="internal_review">
                        <div className="flex items-center gap-2">
                          <Eye className="h-3 w-3 text-purple-500" />
                          Internal Review
                        </div>
                      </SelectItem>
                      <SelectItem value="client_review">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-3 w-3 text-blue-500" />
                          Client Review
                        </div>
                      </SelectItem>
                      <SelectItem value="approved">
                        <div className="flex items-center gap-2">
                          <ThumbsUp className="h-3 w-3 text-emerald-500" />
                          Approved
                        </div>
                      </SelectItem>
                      <SelectItem value="ready_for_billing">
                        <div className="flex items-center gap-2">
                          <Receipt className="h-3 w-3 text-orange-500" />
                          Ready for Billing
                        </div>
                      </SelectItem>
                      <SelectItem value="closed">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                          Closed
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Assignee</Label>
                    <Select
                      value={editedTicket.assigned_to || 'unassigned'}
                      onValueChange={(value) => setEditedTicket((prev) => ({ 
                        ...prev, 
                        assigned_to: value === 'unassigned' ? null : value 
                      }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select assignee..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">Unassigned</span>
                        </SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={member.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {getInitials(member.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              {member.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Reporter</Label>
                    <Select
                      value={editedTicket.reporter_id || 'unassigned'}
                      onValueChange={(value) => setEditedTicket((prev) => ({ 
                        ...prev, 
                        reporter_id: value === 'unassigned' ? null : value 
                      }))}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder="Select reporter..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">No reporter</span>
                        </SelectItem>
                        {teamMembers.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={member.avatar_url} />
                                <AvatarFallback className="text-[8px]">
                                  {getInitials(member.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              {member.full_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={editedTicket.start_date || ''}
                      onChange={(e) => setEditedTicket((prev) => ({ ...prev, start_date: e.target.value }))}
                      className={cn("mt-1.5", startAfterDueError && "border-destructive")}
                      aria-invalid={!!startAfterDueError}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={editedTicket.due_date || ''}
                      onChange={(e) => setEditedTicket((prev) => ({ ...prev, due_date: e.target.value }))}
                      className={cn("mt-1.5", startAfterDueError && "border-destructive")}
                      aria-invalid={!!startAfterDueError}
                    />
                  </div>
                  {startAfterDueError && (
                    <p className="col-span-2 text-sm text-destructive font-medium flex items-center gap-1.5" role="alert">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {startAfterDueError}
                    </p>
                  )}
                  <div>
                    <Label>Estimated Hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g., 4"
                      value={editedTicket.estimated_hours || ''}
                      onChange={(e) => setEditedTicket((prev) => ({ ...prev, estimated_hours: e.target.value ? parseFloat(e.target.value) : null }))}
                      className="mt-1.5"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">Description</h3>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setEditMode(true)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                </div>
                <MarkdownContent 
                  content={ticket.description}
                  onClick={() => setEditMode(true)}
                />

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mt-6 pt-6 border-t">
                  <div 
                    className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                    onClick={() => setEditMode(true)}
                    title="Click to edit assignee"
                  >
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <User className="h-3 w-3" /> Assignee
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
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
                      <span className="text-sm text-brand-orange font-medium">Click to assign</span>
                    )}
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                    onClick={() => setEditMode(true)}
                    title="Click to edit reporter"
                  >
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <User className="h-3 w-3" /> Reporter
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </p>
                    {(() => {
                      const reporter = teamMembers.find(m => m.id === ticket.reporter_id)
                      return reporter ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={reporter.avatar_url} />
                            <AvatarFallback className="text-[10px]">
                              {getInitials(reporter.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{reporter.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Not set</span>
                      )
                    })()}
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                    onClick={() => setEditMode(true)}
                    title="Click to set start date"
                  >
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Start Date
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </p>
                    <span className={cn("text-sm", !ticket.start_date && "text-muted-foreground")}>
                      {ticket.start_date ? formatDate(ticket.start_date) : 'Not set'}
                    </span>
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                    onClick={() => setEditMode(true)}
                    title="Click to set due date"
                  >
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Due Date
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </p>
                    <span className={cn("text-sm", !ticket.due_date && "text-brand-orange font-medium")}>
                      {ticket.due_date ? formatDate(ticket.due_date) : 'Click to set'}
                    </span>
                  </div>
                  <div 
                    className="cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors group"
                    onClick={() => setEditMode(true)}
                    title="Click to edit"
                  >
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      Estimated
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                    </p>
                    <span className={cn("text-sm", !ticket.estimated_hours && "text-brand-orange font-medium")}>
                      {ticket.estimated_hours ? `${ticket.estimated_hours}h` : 'Click to set'}
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
                <TabsTrigger value="time">
                  <Clock className="mr-2 h-4 w-4" />
                  Time Entries ({timeEntries.length})
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
                          <MentionText text={comment.content} className="text-sm whitespace-pre-wrap" />
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
                  <div className="flex-1 flex flex-col gap-2">
                    <MentionInput
                      value={newComment}
                      onChange={setNewComment}
                      onMentionsChange={setMentionedUserIds}
                      placeholder="Add a comment... Type @ to mention someone"
                      multiline={false}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          handleAddComment()
                        }
                      }}
                    />
                    <div className="flex justify-end">
                    <Button
                      onClick={handleAddComment}
                      disabled={!newComment.trim() || sendingComment}
                        size="sm"
                      >
                        {sendingComment ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </>
                        )}
                    </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="mt-4">
                <FileUpload
                  bucket="documents"
                  folder={`${ticket.client_id}/${activeTicketId || ticketId}`}
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
                    const { data, error } = await updateTicket(activeTicketId, { attachments: updatedAttachments })
                    if (error) {
                      toast({
                        title: 'Error',
                        description: error.message || 'Failed to save attachment.',
                        variant: 'destructive',
                      })
                      return
                    }
                    setTicket((prev) => (data ? { ...prev, ...data } : { ...prev, attachments: updatedAttachments }))
                  }}
                  onRemove={async (file) => {
                    // Remove from ticket attachments
                    const updatedAttachments = (ticket.attachments || []).filter(
                      (a) => a.path !== file.path && a.url !== file.url
                    )
                    const { data } = await updateTicket(activeTicketId, { attachments: updatedAttachments })
                    setTicket((prev) => (data ? { ...prev, ...data } : { ...prev, attachments: updatedAttachments }))
                  }}
                />
              </TabsContent>

              <TabsContent value="time" className="mt-4">
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {timeEntries.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No time entries yet. Track time to see it here.
                    </p>
                  ) : (
                    timeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={entry.user?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(entry.user?.full_name || 'NA')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {entry.user?.full_name || 'Team Member'}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.description || entry.notes || 'Time entry'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatDate(entry.date || entry.start_time || entry.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-sm font-semibold w-14 text-right tabular-nums" title="Time">
                            {formatDuration(entry.minutes ?? entry.duration_minutes ?? 0)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => setEditingTimeEntry(entry)}
                            title="Edit entry"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete entry"
                            onClick={async () => {
                              const { error } = await deleteTimeEntry(entry.id)
                              if (error) {
                                toast({ title: 'Failed to delete entry', variant: 'destructive' })
                                return
                              }
                              toast({ title: 'Entry removed' })
                              fetchData()
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
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
              ticketId={activeTicketId || ticketId}
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
                  to={boardLink}
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

      {/* Edit Time Entry Dialog */}
      <Dialog open={!!editingTimeEntry} onOpenChange={(open) => !open && setEditingTimeEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          {editingTimeEntry && (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const form = e.target
                const minutes = parseInt(form.minutes?.value || '0', 10)
                const date = form.date?.value || editingTimeEntry.date
                const notes = form.notes?.value ?? editingTimeEntry.notes ?? ''
                setSavingTimeEntry(true)
                const { error } = await updateTimeEntry(editingTimeEntry.id, {
                  minutes,
                  duration_minutes: minutes,
                  date: date.includes('T') ? date.split('T')[0] : date,
                  notes: notes || null,
                  description: notes || null,
                })
                setSavingTimeEntry(false)
                if (error) {
                  toast({ title: 'Failed to update entry', variant: 'destructive' })
                  return
                }
                toast({ title: 'Entry updated' })
                setEditingTimeEntry(null)
                fetchData()
              }}
            >
              <div>
                <Label>Minutes</Label>
                <Input
                  type="number"
                  name="minutes"
                  min={0}
                  defaultValue={editingTimeEntry.minutes ?? editingTimeEntry.duration_minutes ?? 0}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  name="date"
                  defaultValue={(editingTimeEntry.date || editingTimeEntry.start_time || editingTimeEntry.created_at || '').toString().slice(0, 10)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  name="notes"
                  rows={2}
                  defaultValue={editingTimeEntry.notes || editingTimeEntry.description || ''}
                  className="mt-1.5"
                  placeholder="What was worked on?"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTimeEntry(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={savingTimeEntry}>
                  {savingTimeEntry ? 'Saving...' : 'Save'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

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
