import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Kanban,
  CheckCircle,
  CheckCircle2,
  Circle,
  AlertCircle,
  TrendingUp,
  MessageSquare,
  FileText,
  Image,
  Calendar,
  Bell,
  ThumbsUp,
  ThumbsDown,
  Send,
  Paperclip,
  ChevronRight,
  ChevronDown,
  Star,
  Sparkles,
  ExternalLink,
  Download,
  Eye,
  BarChart3,
  Zap,
  Award,
  Target,
  Users,
  Mail,
  Plus,
  X,
  ArrowRight,
  Play,
  Loader2,
  Rocket,
  Heart,
  Flame,
  TrendingDown,
  Activity,
  MessageCircle,
  PlusCircle,
  Filter,
  Search,
  LayoutGrid,
  List,
  RefreshCw,
  ArrowUpRight,
  Timer,
  Coffee,
  Lightbulb,
  Wand2,
} from 'lucide-react'
import { supabase, getClient, getBoards, getTickets, getClientHoursSummary, getComments, createComment, ensureValidSession } from '../lib/supabase'
import MentionInput, { sendMentionNotifications, MentionText } from '../components/MentionInput'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDuration, calculateProgress, getProgressColor, getStatusInfo, formatDate, formatRelativeDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Textarea } from '../components/ui/textarea'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.98 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: { type: "spring", stiffness: 300, damping: 24 }
  },
}

const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.02, y: -4, transition: { type: "spring", stiffness: 400 } }
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const REQUEST_TYPES = {
  approval: { icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Approval Needed' },
  assets: { icon: Image, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Assets Requested' },
  feedback: { icon: MessageSquare, color: 'text-violet-500', bg: 'bg-violet-500/10', border: 'border-violet-500/20', label: 'Feedback Needed' },
  content: { icon: FileText, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Content Needed' },
  payment: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Payment Due' },
  meeting: { icon: Users, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20', label: 'Meeting Request' },
  general: { icon: Bell, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20', label: 'Request' },
  feature: { icon: Lightbulb, color: 'text-brand-orange', bg: 'bg-brand-orange/10', border: 'border-brand-orange/20', label: 'Feature Request' },
  bug: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Bug Report' },
  question: { icon: MessageCircle, color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', label: 'Question' },
}

// Status config supporting both legacy and new 7-status workflow
const STATUS_CONFIG = {
  // New 7-status workflow
  new: { label: 'New', icon: Circle, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
  in_progress: { label: 'In Progress', icon: Play, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  internal_review: { label: 'Internal Review', icon: Eye, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/30' },
  client_review: { label: 'Awaiting Your Review', icon: Eye, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30', clientAction: true },
  approved: { label: 'Approved', icon: ThumbsUp, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
  ready_for_billing: { label: 'Ready for Billing', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
  closed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' },
  
  // Legacy status mappings
  todo: { label: 'Planned', icon: Circle, color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800' },
  inprogress: { label: 'In Progress', icon: Play, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  done: { label: 'Completed', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
}

// Client Homework status options (restricted for clients)
const HOMEWORK_STATUS_OPTIONS = [
  { value: 'new', label: 'Not Started', icon: Circle },
  { value: 'in_progress', label: 'Working on it', icon: Play },
  { value: 'closed', label: 'Completed', icon: CheckCircle2 },
]

// Greeting based on time of day
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' }
  return { text: 'Good evening', emoji: '🌙' }
}

// Stat Card Component
function StatCard({ icon: Icon, iconBg, iconColor, label, value, suffix, subtext, delay = 0 }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover="hover"
      initial="rest"
      animate="rest"
    >
      <motion.div variants={cardHover}>
        <Card className="relative overflow-hidden group border-0 shadow-lg shadow-black/5 hover:shadow-xl hover:shadow-brand-orange/10 transition-shadow">
          <div className="absolute inset-0 bg-gradient-to-br from-white to-slate-50/50 dark:from-slate-900 dark:to-slate-800/50" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand-orange/5 to-transparent rounded-full blur-2xl transform translate-x-8 -translate-y-8 group-hover:scale-150 transition-transform duration-500" />
          <CardContent className="relative p-5">
            <div className="flex items-start justify-between">
              <div className={cn("p-3 rounded-2xl", iconBg)}>
                <Icon className={cn("h-6 w-6", iconColor)} />
              </div>
              <Badge variant="outline" className="text-xs font-normal opacity-60">
                This Month
              </Badge>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground mb-1">{label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight">
                  {Math.round(value)}
                </span>
                {suffix && <span className="text-muted-foreground text-lg">{suffix}</span>}
              </div>
              {subtext && (
                <p className="text-xs text-muted-foreground mt-2">{subtext}</p>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}

// Ticket Card for Activity View
function TicketActivityCard({ ticket, onViewDetails, onComment, onStatusChange }) {
  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.new
  const StatusIcon = statusConfig.icon
  const isClientHomework = ticket.ticket_type === 'client_homework'
  const needsClientAction = ticket.status === 'client_review'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, x: 4 }}
      className="group"
    >
      <div className={cn(
        "p-4 rounded-xl border bg-card/50 backdrop-blur-sm transition-all",
        "hover:shadow-lg hover:shadow-brand-orange/5 hover:border-brand-orange/20",
        "cursor-pointer",
        isClientHomework && "border-l-4 border-l-orange-500",
        needsClientAction && "ring-2 ring-blue-400/50 border-blue-300"
      )}
        onClick={() => onViewDetails(ticket)}
      >
        <div className="flex items-start gap-4">
          {/* Status indicator */}
          <div className={cn("p-2.5 rounded-xl shrink-0", statusConfig.bg)}>
            <StatusIcon className={cn("h-5 w-5", statusConfig.color)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-sm truncate group-hover:text-brand-orange transition-colors">
                    {ticket.title}
                  </h4>
                  {isClientHomework && (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-[10px] px-1.5 py-0">
                      Your Task
                    </Badge>
                  )}
                  {needsClientAction && (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-[10px] px-1.5 py-0 animate-pulse">
                      Review Needed
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ticket.ticket_id}
                </p>
              </div>
            </div>

            {ticket.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                {ticket.description}
              </p>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed">
              <div className="flex items-center gap-2">
                {ticket.assigned_user && (
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={ticket.assigned_user.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-brand-orange/10 text-brand-orange">
                        {ticket.assigned_user.full_name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">
                      {ticket.assigned_user.full_name?.split(' ')[0]}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 px-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onComment(ticket)
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5 mr-1" />
                  Comment
                </Button>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// New Request Dialog
function NewRequestDialog({ open, onOpenChange, clientId, userId, onSuccess }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'feature',
    priority: 'medium',
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) return

    setLoading(true)
    try {
      const { error } = await supabase.from('client_requests').insert({
        client_id: clientId,
        created_by: userId,
        title: formData.title,
        description: formData.description,
        type: formData.type,
        priority: formData.priority,
        status: 'pending',
      })

      if (error) throw error

      toast({
        title: '🚀 Request Submitted!',
        description: 'Our team will review it shortly.',
      })
      
      setFormData({ title: '', description: '', type: 'feature', priority: 'medium' })
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Error submitting request:', error)
      toast({
        title: 'Oops!',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-brand-orange/10">
              <Wand2 className="h-5 w-5 text-brand-orange" />
            </div>
            Submit a Request
          </DialogTitle>
          <DialogDescription>
            Tell us what you need and we'll make it happen! ✨
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">What do you need?</Label>
            <Input
              id="title"
              placeholder="e.g., Update homepage banner, Create new landing page..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-12"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">
                    <span className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-brand-orange" />
                      New Feature
                    </span>
                  </SelectItem>
                  <SelectItem value="content">
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-amber-500" />
                      Content Update
                    </span>
                  </SelectItem>
                  <SelectItem value="bug">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      Bug Fix
                    </span>
                  </SelectItem>
                  <SelectItem value="question">
                    <span className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-cyan-500" />
                      Question
                    </span>
                  </SelectItem>
                  <SelectItem value="general">
                    <span className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-slate-500" />
                      Other
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea
              id="description"
              placeholder="Any additional context, links, or specific requirements..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim()}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Rocket className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Ticket Detail Dialog with Comments
function TicketDetailDialog({ ticket, open, onOpenChange, userId, clientId, clientName, onStatusChange }) {
  const { toast } = useToast()
  const [comments, setComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [mentionedUserIds, setMentionedUserIds] = useState([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [sendingComment, setSendingComment] = useState(false)
  const [changingStatus, setChangingStatus] = useState(false)
  
  const isClientHomework = ticket?.ticket_type === 'client_homework'
  const needsClientReview = ticket?.status === 'client_review'
  const canChangeStatus = isClientHomework || needsClientReview

  useEffect(() => {
    if (open && ticket) {
      fetchComments()
    }
  }, [open, ticket])

  const fetchComments = async () => {
    if (!ticket) return
    setLoadingComments(true)
    try {
      const { data, error } = await getComments(ticket.id)
      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoadingComments(false)
    }
  }

  const handleSendComment = async () => {
    if (!newComment.trim() || !ticket) return

    setSendingComment(true)
    try {
      const { data, error } = await createComment({
        ticket_id: ticket.id,
        user_id: userId,
        content: newComment,
      })

      if (error) throw error

      // Send mention notifications
      if (mentionedUserIds.length > 0) {
        await sendMentionNotifications({
          mentionedUserIds,
          fromUserId: userId,
          fromUserName: clientName || 'A client',
          entityType: 'ticket',
          entityId: ticket.id,
          entityName: ticket.title,
          messagePreview: newComment,
          clientId,
        })
      }

      toast({
        title: '💬 Comment posted!',
        description: mentionedUserIds.length > 0 
          ? `Notified ${mentionedUserIds.length} team member(s)`
          : 'The team will be notified.',
      })

      setNewComment('')
      setMentionedUserIds([])
      fetchComments()
    } catch (error) {
      console.error('Error posting comment:', error)
      toast({
        title: 'Failed to post comment',
        variant: 'destructive',
      })
    } finally {
      setSendingComment(false)
    }
  }

  const handleStatusChange = async (newStatus) => {
    if (!ticket || !onStatusChange) return
    setChangingStatus(true)
    try {
      await onStatusChange(ticket.id, newStatus)
      toast({
        title: '✅ Status updated!',
        description: `Task marked as ${STATUS_CONFIG[newStatus]?.label || newStatus}`,
      })
    } catch (error) {
      toast({
        title: 'Failed to update status',
        variant: 'destructive',
      })
    } finally {
      setChangingStatus(false)
    }
  }

  if (!ticket) return null

  const statusConfig = STATUS_CONFIG[ticket.status] || STATUS_CONFIG.new
  const StatusIcon = statusConfig.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-start gap-4">
            <div className={cn("p-3 rounded-xl shrink-0", statusConfig.bg)}>
              <StatusIcon className={cn("h-6 w-6", statusConfig.color)} />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl mb-1">
                <div className="flex items-center gap-2">
                  {ticket.title}
                  {isClientHomework && (
                    <Badge className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                      Your Task
                    </Badge>
                  )}
                </div>
              </DialogTitle>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {ticket.ticket_id}
                </Badge>
                <Badge className={cn(statusConfig.bg, statusConfig.color, "border-0")}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
          
          {/* Client Status Change Section */}
          {canChangeStatus && (
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-orange-500" />
                <span className="font-medium text-sm">
                  {needsClientReview ? 'Review Required' : 'Update Your Progress'}
                </span>
              </div>
              
              {needsClientReview ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange('approved')}
                    disabled={changingStatus}
                    className="bg-green-500 hover:bg-green-600 text-white"
                  >
                    {changingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <ThumbsUp className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange('in_progress')}
                    disabled={changingStatus}
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  >
                    Request Changes
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 flex-wrap">
                  {HOMEWORK_STATUS_OPTIONS.map((option) => {
                    const OptionIcon = option.icon
                    const isActive = ticket.status === option.value
                    return (
                      <Button
                        key={option.value}
                        size="sm"
                        variant={isActive ? 'default' : 'outline'}
                        onClick={() => handleStatusChange(option.value)}
                        disabled={changingStatus || isActive}
                        className={cn(
                          isActive && "bg-green-500 hover:bg-green-500"
                        )}
                      >
                        {changingStatus ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <OptionIcon className="h-4 w-4 mr-1" />
                        )}
                        {option.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-6">
          {/* Description */}
          {ticket.description && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Description</h4>
              <p className="text-sm leading-relaxed">{ticket.description}</p>
            </div>
          )}

          {/* Assigned */}
          {ticket.assigned_user && (
            <div>
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Working on this</h4>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={ticket.assigned_user.avatar_url} />
                  <AvatarFallback className="bg-brand-orange/10 text-brand-orange">
                    {ticket.assigned_user.full_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{ticket.assigned_user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{ticket.assigned_user.email}</p>
                </div>
              </div>
            </div>
          )}

          {/* Comments Section */}
          <div>
            <h4 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Comments ({comments.length})
            </h4>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {loadingComments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                comments.map((comment) => (
                  <motion.div
                    key={comment.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3"
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarImage src={comment.user?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {comment.user?.full_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{comment.user?.full_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(new Date(comment.created_at))}
                        </span>
                      </div>
                      <MentionText text={comment.content} className="text-sm text-muted-foreground" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Comment Input */}
        <div className="pt-4 border-t">
          <MentionInput
              value={newComment}
            onChange={setNewComment}
            onMentionsChange={setMentionedUserIds}
            placeholder="Add a comment... Type @ to mention someone"
            rows={3}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  handleSendComment()
                }
              }}
            />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter to send • Type @ to mention
            </p>
            <Button 
              onClick={handleSendComment}
              disabled={!newComment.trim() || sendingComment}
            >
              {sendingComment ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Send Comment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Main Component
export default function ClientPortal() {
  const { profile, user, clientPreviewMode, previewClientId, isActualAdmin, loading: authLoading } = useAuth()
  const { toast } = useToast()
  const [client, setClient] = useState(null)
  const [boards, setBoards] = useState([])
  const [tickets, setTickets] = useState([])
  const [hoursSummary, setHoursSummary] = useState(null)
  const [requests, setRequests] = useState([])
  const [messages, setMessages] = useState([])
  const [projects, setProjects] = useState([])
  const [recaps, setRecaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [newRequestOpen, setNewRequestOpen] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketDetailOpen, setTicketDetailOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('grid')
  const [previewClient, setPreviewClient] = useState(null)
  const greeting = getGreeting()

  // Determine which client ID to use (preview mode or actual client)
  const effectiveClientId = clientPreviewMode ? (previewClientId || previewClient?.id) : profile?.client_id
  const isPreviewMode = clientPreviewMode && isActualAdmin

  // For preview mode, fetch a client to preview
  useEffect(() => {
    const fetchPreviewClient = async () => {
      if (clientPreviewMode && !previewClientId && isActualAdmin) {
        // Fetch the first available client for preview
        const { data } = await supabase
          .from('clients')
          .select('*')
          .eq('is_active', true)
          .order('name')
          .limit(1)
          .single()
        
        if (data) {
          setPreviewClient(data)
        }
      }
    }
    fetchPreviewClient()
  }, [clientPreviewMode, previewClientId, isActualAdmin])

  const [fetchError, setFetchError] = useState(null)

  const fetchData = useCallback(async (showRefresh = false) => {
    const clientIdToUse = clientPreviewMode ? (previewClientId || previewClient?.id) : profile?.client_id
    if (!clientIdToUse) return

    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)
    
      try {
        // Validate session before fetching - this refreshes token if expiring
        const sessionValid = await ensureValidSession()
        if (!sessionValid) {
          console.warn('[ClientPortal] Session invalid, cannot fetch data')
          setFetchError('Session expired. Please refresh the page or log in again.')
          setLoading(false)
          setRefreshing(false)
          return
        }
        
        const [clientRes, boardsRes, ticketsRes, hoursRes] = await Promise.all([
        getClient(clientIdToUse),
        getBoards(clientIdToUse),
        getTickets(null, clientIdToUse),
          getClientHoursSummary(),
        ])

        if (clientRes.data) setClient(clientRes.data)
        if (boardsRes.data) setBoards(boardsRes.data)
        if (ticketsRes.data) setTickets(ticketsRes.data)
        
      const summary = hoursRes.data?.find((h) => h.client_id === clientIdToUse)
        if (summary) setHoursSummary(summary)

        const [requestsRes, projectsRes, recapsRes] = await Promise.all([
          supabase
            .from('client_requests')
            .select('*, creator:profiles!client_requests_created_by_fkey(full_name, avatar_url)')
          .eq('client_id', clientIdToUse)
            .order('created_at', { ascending: false }),
          supabase
            .from('client_projects')
            .select('*')
          .eq('client_id', clientIdToUse)
            .eq('is_visible_to_client', true)
            .order('completed_date', { ascending: false }),
          supabase
            .from('client_monthly_recaps')
            .select('*')
          .eq('client_id', clientIdToUse)
            .eq('status', 'published')
            .order('year', { ascending: false })
            .order('month', { ascending: false })
            .limit(6),
        ])

        setRequests(requestsRes.data || [])
        setProjects(projectsRes.data || [])
        setRecaps(recapsRes.data || [])
      } catch (error) {
        console.error('Error fetching client portal data:', error)
      } finally {
        setLoading(false)
      setRefreshing(false)
      }
  }, [profile?.client_id, clientPreviewMode, previewClientId, previewClient?.id])

  useEffect(() => {
    // Wait for auth to be ready
    if (authLoading) return
    // Wait for previewClient to be loaded in preview mode
    if (clientPreviewMode && !previewClientId && !previewClient) return
    fetchData()
  }, [fetchData, clientPreviewMode, previewClientId, previewClient, authLoading])

  // Fetch messages for a request
  const fetchMessages = async (requestId) => {
    const { data } = await supabase
      .from('client_messages')
      .select('*, sender:profiles(full_name, avatar_url)')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true })
    
    setMessages(data || [])
  }

  // Send a message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedRequest) return

    setSendingMessage(true)
    try {
      const { error } = await supabase.from('client_messages').insert({
        client_id: profile.client_id,
        request_id: selectedRequest.id,
        sender_id: user.id,
        message: newMessage,
        is_from_client: true,
      })

      if (error) throw error

      toast({ title: '✉️ Message sent!', variant: 'success' })
      setNewMessage('')
      fetchMessages(selectedRequest.id)
    } catch (error) {
      toast({ title: 'Failed to send message', variant: 'destructive' })
    } finally {
      setSendingMessage(false)
    }
  }

  // Approve or respond to a request
  const handleRequestAction = async (request, action) => {
    try {
      const { error } = await supabase
        .from('client_requests')
        .update({ 
          status: action,
          completed_at: action === 'approved' || action === 'completed' ? new Date().toISOString() : null,
          completed_by: user.id,
        })
        .eq('id', request.id)

      if (error) throw error

      toast({
        title: action === 'approved' ? '✅ Approved!' : '📝 Updated',
        variant: 'success',
      })

      fetchData()
    } catch (error) {
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  // Handle viewing ticket details
  const handleViewTicketDetails = (ticket) => {
    setSelectedTicket(ticket)
    setTicketDetailOpen(true)
  }

  // Handle opening comment dialog
  const handleCommentTicket = (ticket) => {
    setSelectedTicket(ticket)
    setTicketDetailOpen(true)
  }

  // Handle ticket status change (for client homework and client review)
  const handleTicketStatusChange = async (ticketId, newStatus) => {
    try {
      // Update resolution if closing
      const updateData = { 
        status: newStatus,
        resolution: newStatus === 'closed' ? 'resolved' : undefined
      }
      
      const { error } = await supabase
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId)
      
      if (error) throw error
      
      // Update local state
      setTickets(prev => prev.map(t => 
        t.id === ticketId ? { ...t, status: newStatus } : t
      ))
      
      // Update selected ticket if it's the one we changed
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(prev => ({ ...prev, status: newStatus }))
      }
      
      return { success: true }
    } catch (error) {
      console.error('Error updating ticket status:', error)
      throw error
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
            <Skeleton className="h-20 w-20 rounded-3xl" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!client && !loading) {
    // In preview mode, show loading or a message to select a client
    if (isPreviewMode) {
    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/20 flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-brand-orange animate-spin" />
        </div>
            <h2 className="text-2xl font-bold mb-3">Loading Preview...</h2>
            <p className="text-muted-foreground">
              Fetching client data for preview mode.
            </p>
          </motion.div>
        </div>
      )
    }
    
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/20 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-brand-orange" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Account Not Linked</h2>
          <p className="text-muted-foreground mb-6">
            Your account isn't connected to a client profile yet. Let's get you set up!
          </p>
          <Button asChild size="lg" className="gap-2">
            <a href="mailto:support@brandastic.com">
              <Mail className="h-5 w-5" />
              Contact Support
            </a>
        </Button>
        </motion.div>
      </div>
    )
  }

  // Calculate stats
  const todoCount = tickets.filter((t) => t.status === 'todo').length
  const inProgressCount = tickets.filter((t) => t.status === 'inprogress').length
  const doneCount = tickets.filter((t) => t.status === 'done').length
  const hoursProgress = calculateProgress(hoursSummary?.hours_used || 0, client.monthly_hours || 1)
  const pendingRequests = requests.filter(r => r.status === 'pending')
  
  // Filter tickets
  const filteredTickets = statusFilter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === statusFilter)

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
        className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
        {/* Hero Header */}
      <motion.div variants={itemVariants} className="mb-8">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 lg:p-10">
            {/* Background decoration */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-brand-orange/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-blue/20 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-brand-coral/10 rounded-full blur-2xl transform -translate-x-1/2 -translate-y-1/2" />
            </div>

            <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="flex items-center gap-5">
            {client.logo_url ? (
                  <motion.img
                    whileHover={{ scale: 1.05, rotate: 3 }}
                src={client.logo_url}
                alt={client.name}
                    className="h-20 w-20 rounded-2xl object-contain bg-white shadow-2xl"
              />
            ) : (
                  <motion.div
                    whileHover={{ scale: 1.05, rotate: 3 }}
                    className="h-20 w-20 rounded-2xl flex items-center justify-center text-white font-display font-bold text-3xl shadow-2xl"
                style={{ backgroundColor: client.color || '#F7931E' }}
              >
                {client.name[0]}
                  </motion.div>
            )}
            <div>
                  <p className="text-white/60 text-sm mb-1 flex items-center gap-2">
                    {greeting.emoji} {greeting.text}
                  </p>
                  <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
                    {client.name}
                  </h1>
                <p className="text-white/60 mt-1 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-orange" />
                    {isPreviewMode ? 'Preview Mode - This is what your clients see' : 'Your project dashboard'}
                  </p>
                  {isPreviewMode && (
                    <Badge className="mt-2 bg-brand-coral/20 text-brand-coral border-brand-coral/30">
                      <Eye className="h-3 w-3 mr-1" />
                      Admin Preview
                    </Badge>
                  )}
            </div>
          </div>
          
              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => fetchData(true)}
                  disabled={refreshing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Refresh
                </Button>
                <Button 
                  onClick={() => setNewRequestOpen(true)}
                  size="lg"
                  className="bg-brand-orange hover:bg-brand-orange/90 text-white shadow-lg shadow-brand-orange/25 gap-2"
                >
                  <PlusCircle className="h-5 w-5" />
                  New Request
                </Button>
        </div>
            </div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-6 p-4 rounded-2xl bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-orange/20">
                    <Bell className="h-5 w-5 text-brand-orange animate-pulse" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">Action needed!</p>
                    <p className="text-sm text-white/70">
                      {pendingRequests.length} request{pendingRequests.length > 1 ? 's' : ''} awaiting your response
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={() => document.getElementById('requests-tab')?.click()}
                  className="gap-1"
                >
                  View
                  <ArrowRight className="h-4 w-4" />
                </Button>
        </motion.div>
      )}
          </div>
        </motion.div>

      {/* Stats Grid */}
        <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            icon={Clock}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            label="Hours Used"
            value={Math.round(hoursSummary?.hours_used || 0)}
            suffix={`/ ${client.monthly_hours}h`}
            subtext={`${Math.round(hoursSummary?.hours_remaining || client.monthly_hours)}h remaining`}
          />
          <StatCard
            icon={Play}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-500"
            label="In Progress"
            value={inProgressCount}
            subtext="Tasks being worked on"
          />
          <StatCard
            icon={CheckCircle2}
            iconBg="bg-emerald-500/10"
            iconColor="text-emerald-500"
            label="Completed"
            value={doneCount}
            subtext={`${todoCount} more planned`}
          />
          <StatCard
            icon={Target}
            iconBg="bg-brand-orange/10"
            iconColor="text-brand-orange"
            label="Active Projects"
            value={boards.length}
            subtext="Currently in progress"
          />
        </motion.div>

        {/* Hours Progress Bar */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="border-0 shadow-lg shadow-black/5">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-blue/10">
                    <Timer className="h-5 w-5 text-brand-blue" />
                </div>
                  <div>
                    <h3 className="font-semibold">Monthly Hours</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1))} - {formatDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))}
                    </p>
                </div>
              </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{hoursProgress.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">utilized</p>
                </div>
              </div>
              <div className="relative">
                <Progress 
                  value={hoursProgress} 
                  className="h-3 bg-slate-100 dark:bg-slate-800" 
                />
                <div 
                  className="absolute top-0 h-3 rounded-full bg-gradient-to-r from-brand-blue via-brand-orange to-brand-coral transition-all duration-500"
                  style={{ width: `${Math.min(hoursProgress, 100)}%` }}
                />
              </div>
            </CardContent>
          </Card>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div variants={itemVariants}>
          <Tabs defaultValue="activity" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
                <TabsTrigger value="activity" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  <Activity className="h-4 w-4" />
                  <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
                <TabsTrigger value="requests" id="requests-tab" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">Requests</span>
              {pendingRequests.length > 0 && (
                    <Badge className="ml-1 h-5 px-1.5 bg-brand-orange text-white text-xs">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
                <TabsTrigger value="portfolio" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Star className="h-4 w-4" />
                  <span className="hidden sm:inline">Portfolio</span>
            </TabsTrigger>
                <TabsTrigger value="recaps" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Recaps</span>
            </TabsTrigger>
          </TabsList>
                  </div>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-6">
              {/* Filter Bar */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({tickets.length})
                  </Button>
                  <Button
                    variant={statusFilter === 'inprogress' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('inprogress')}
                    className={statusFilter === 'inprogress' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    In Progress ({inProgressCount})
                  </Button>
                  <Button
                    variant={statusFilter === 'done' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter('done')}
                    className={statusFilter === 'done' ? 'bg-emerald-500 hover:bg-emerald-600' : ''}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Done ({doneCount})
                  </Button>
                          </div>
                        </div>

              {/* Activity Grid */}
              {filteredTickets.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                      <Coffee className="h-8 w-8 text-muted-foreground" />
                      </div>
                    <h3 className="font-semibold text-lg mb-2">No tasks yet</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                      When the team starts working on your projects, you'll see all the activity here.
                    </p>
              </CardContent>
            </Card>
              ) : (
                <div className="grid gap-3">
                  {filteredTickets.map((ticket) => (
                    <TicketActivityCard
                      key={ticket.id}
                      ticket={ticket}
                      onViewDetails={handleViewTicketDetails}
                      onComment={handleCommentTicket}
                    />
                  ))}
                  </div>
                )}
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Your Requests</h3>
                  <p className="text-sm text-muted-foreground">Track and manage your requests</p>
                </div>
                <Button onClick={() => setNewRequestOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Request
                </Button>
              </div>

            {requests.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-emerald-500" />
                    </div>
                  <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                    <p className="text-muted-foreground mb-4">No pending requests at this time.</p>
                    <Button onClick={() => setNewRequestOpen(true)} variant="outline" className="gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Submit a Request
                    </Button>
                </CardContent>
              </Card>
            ) : (
                <div className="space-y-3">
                  {requests.map((request) => {
                const typeConfig = REQUEST_TYPES[request.type] || REQUEST_TYPES.general
                const Icon = typeConfig.icon
                
                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                  >
                    <Card className={cn(
                          "transition-all overflow-hidden",
                          request.status === 'pending' && "border-brand-orange/30 shadow-lg shadow-brand-orange/5"
                    )}>
                      <CardContent className="p-5">
                          <div className="flex items-start gap-4">
                              <div className={cn("p-3 rounded-xl shrink-0", typeConfig.bg)}>
                              <Icon className={cn("h-6 w-6", typeConfig.color)} />
                            </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                            <div>
                                    <h4 className="font-semibold mb-1">{request.title}</h4>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Badge variant="outline" className={cn("text-xs", typeConfig.bg, typeConfig.color, typeConfig.border)}>
                                        {typeConfig.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {formatRelativeDate(new Date(request.created_at))}
                                      </span>
                            </div>
                          </div>
                          <Badge
                                    className={cn(
                                      request.status === 'pending' && 'bg-brand-orange text-white',
                                      request.status === 'approved' && 'bg-emerald-500 text-white',
                                      request.status === 'completed' && 'bg-emerald-500 text-white',
                                      request.status === 'in_review' && 'bg-blue-500 text-white',
                                      request.status === 'rejected' && 'bg-red-500 text-white',
                                    )}
                                  >
                                    {request.status === 'pending' ? 'Awaiting Review' : request.status}
                          </Badge>
                        </div>

                                {request.description && (
                                  <p className="text-sm text-muted-foreground mt-3 line-clamp-2">
                                    {request.description}
                                  </p>
                                )}

                                {request.status === 'pending' && request.type === 'approval' && (
                                  <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                                <Button
                                  onClick={() => handleRequestAction(request, 'approved')}
                                      size="sm"
                                      className="gap-1"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleRequestAction(request, 'rejected')}
                                      size="sm"
                                      className="gap-1"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                  Request Changes
                                </Button>
                            <Button
                                      variant="ghost"
                              onClick={() => {
                                setSelectedRequest(request)
                                fetchMessages(request.id)
                              }}
                                      size="sm"
                                      className="gap-1"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Reply
                            </Button>
                          </div>
                        )}
                              </div>
                            </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                )
                  })}
                </div>
            )}
          </TabsContent>

          {/* Portfolio Tab */}
            <TabsContent value="portfolio">
            {projects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                      <Star className="h-8 w-8 text-amber-500" />
                    </div>
                  <h3 className="font-semibold text-lg mb-2">Portfolio Coming Soon</h3>
                  <p className="text-muted-foreground">
                      Your completed projects will be showcased here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                    <motion.div
                      key={project.id}
                      whileHover={{ y: -4 }}
                    >
                      <Card className="overflow-hidden group hover:shadow-xl transition-all">
                    {project.image_url && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img
                          src={project.image_url}
                          alt={project.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                        <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{project.title}</h3>
                        {project.is_featured && (
                              <Badge className="bg-amber-500 text-white gap-1">
                                <Star className="h-3 w-3" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      {project.category && (
                            <Badge variant="outline" className="mb-3">{project.category}</Badge>
                      )}
                      {project.description && (
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
                      )}
                      {project.url && (
                            <Button variant="outline" size="sm" asChild className="gap-2">
                          <a href={project.url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            View Live
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                    </motion.div>
                ))}
              </div>
            )}
          </TabsContent>

            {/* Recaps Tab */}
          <TabsContent value="recaps">
            {recaps.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-16 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-violet-500/10 flex items-center justify-center">
                      <Calendar className="h-8 w-8 text-violet-500" />
                    </div>
                  <h3 className="font-semibold text-lg mb-2">Monthly Recaps Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Your monthly progress reports will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {recaps.map((recap) => (
                    <motion.div
                      key={recap.id}
                      whileHover={{ y: -2 }}
                    >
                      <Card className="hover:shadow-lg transition-all">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-brand-orange/10">
                        <Calendar className="h-5 w-5 text-brand-orange" />
                            </div>
                        {MONTHS[recap.month - 1]} {recap.year}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {recap.summary && (
                        <p className="text-sm text-muted-foreground mb-4">{recap.summary}</p>
                      )}
                      {recap.highlights && recap.highlights.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">Highlights:</p>
                              <ul className="text-sm space-y-2">
                            {recap.highlights.slice(0, 4).map((h, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                                    <span className="text-muted-foreground">{h}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                    </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Message Dialog */}
      <AnimatePresence>
        {selectedRequest && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSelectedRequest(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            >
                <div className="p-5 border-b flex items-center justify-between">
                  <div>
                <h3 className="font-semibold">{selectedRequest.title}</h3>
                <p className="text-sm text-muted-foreground">Conversation</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedRequest(null)}>
                    <X className="h-4 w-4" />
                  </Button>
              </div>
              
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {messages.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">No messages yet. Start the conversation!</p>
                    </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.is_from_client && "flex-row-reverse"
                      )}
                    >
                        <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={msg.sender?.avatar_url} />
                          <AvatarFallback className="text-xs">
                          {msg.sender?.full_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                          "max-w-[75%] p-3 rounded-2xl",
                        msg.is_from_client
                            ? "bg-brand-orange text-white rounded-br-md"
                            : "bg-muted rounded-bl-md"
                      )}>
                        <p className="text-sm">{msg.message}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          msg.is_from_client ? "text-white/70" : "text-muted-foreground"
                        )}>
                          {formatRelativeDate(new Date(msg.created_at))}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[60px] resize-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleSendMessage()
                        }
                      }}
                  />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-xs text-muted-foreground">⌘+Enter to send</p>
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                      size="sm"
                  >
                      {sendingMessage ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                    <Send className="h-4 w-4" />
                      )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* New Request Dialog */}
        <NewRequestDialog
          open={newRequestOpen}
          onOpenChange={setNewRequestOpen}
          clientId={effectiveClientId}
          userId={user?.id}
          onSuccess={() => fetchData()}
        />

        {/* Ticket Detail Dialog */}
        <TicketDetailDialog
          ticket={selectedTicket}
          open={ticketDetailOpen}
          onOpenChange={setTicketDetailOpen}
          userId={user?.id}
          clientId={profile?.client_id}
          clientName={client?.name || profile?.full_name}
          onStatusChange={handleTicketStatusChange}
        />
    </motion.div>
    </div>
  )
}
