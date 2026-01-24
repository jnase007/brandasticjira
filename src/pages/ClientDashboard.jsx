import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import {
  Plus,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  MessageSquare,
  FileText,
  Calendar,
  Send,
  Paperclip,
  ChevronRight,
  ExternalLink,
  Loader2,
  LogOut,
  Building2,
  Rocket,
  Sparkles,
  TrendingUp,
  Bell,
  X,
  RefreshCw,
  Filter,
  Search,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, formatRelativeDate, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
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
import MentionInput, { MentionText } from '../components/MentionInput'

const LOGO_WHITE = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/BrandasticLogo-White%20(4).png'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// Status helper
function getStatusBadge(status) {
  const statusMap = {
    'To Do': { color: 'bg-slate-500', icon: Circle },
    'In Progress': { color: 'bg-blue-500', icon: Clock },
    'In Review': { color: 'bg-purple-500', icon: AlertCircle },
    'Done': { color: 'bg-green-500', icon: CheckCircle2 },
  }
  return statusMap[status] || statusMap['To Do']
}

export default function ClientDashboard() {
  const navigate = useNavigate()
  const { user, signOut, profile } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clientData, setClientData] = useState(null)
  const [tickets, setTickets] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  
  // Request work dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [requestTitle, setRequestTitle] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestPriority, setRequestPriority] = useState('medium')
  const [requestType, setRequestType] = useState('task')
  const [submittingRequest, setSubmittingRequest] = useState(false)

  // Ticket detail dialog
  const [selectedTicket, setSelectedTicket] = useState(null)
  const [ticketComments, setTicketComments] = useState([])
  const [newComment, setNewComment] = useState('')
  const [sendingComment, setSendingComment] = useState(false)
  const [mentionedUserIds, setMentionedUserIds] = useState([])

  // Filter state
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch client data
  const fetchData = useCallback(async (showRefresh = false) => {
    if (!user) return
    
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Get user's profile to find their client_id
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('client_id')
        .eq('id', user.id)
        .single()

      if (!userProfile?.client_id) {
        // Not associated with a client - maybe show onboarding
        setLoading(false)
        setRefreshing(false)
        return
      }

      // Fetch client info
      const { data: client } = await supabase
        .from('clients')
        .select('*')
        .eq('id', userProfile.client_id)
        .single()

      setClientData(client)

      // Fetch tickets for this client
      const { data: clientTickets } = await supabase
        .from('tickets')
        .select('*, board:board_id(name)')
        .eq('client_id', userProfile.client_id)
        .order('created_at', { ascending: false })

      setTickets(clientTickets || [])

      // Fetch team members assigned to this client
      const { data: assignments } = await supabase
        .from('client_team_assignments')
        .select('user_id, role')
        .eq('client_id', userProfile.client_id)

      if (assignments?.length > 0) {
        const userIds = [...new Set(assignments.map(a => a.user_id))]
        const { data: members } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, title')
          .in('id', userIds)

        setTeamMembers(members || [])
      }

      // Fetch recent activity (comments on tickets)
      const ticketIds = (clientTickets || []).map(t => t.id)
      if (ticketIds.length > 0) {
        const { data: comments } = await supabase
          .from('comments')
          .select('*, author:author_id(full_name, avatar_url)')
          .in('ticket_id', ticketIds)
          .order('created_at', { ascending: false })
          .limit(10)

        setRecentActivity(comments || [])
      }

    } catch (error) {
      console.error('Error fetching client data:', error)
      toast({
        title: 'Error loading data',
        description: 'Please try refreshing the page.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user, toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Submit new work request
  const handleSubmitRequest = async () => {
    if (!requestTitle.trim()) {
      toast({ title: 'Please enter a title', variant: 'destructive' })
      return
    }

    setSubmittingRequest(true)
    try {
      // Find a board for this client or use a general one
      let boardId = null
      const { data: boards } = await supabase
        .from('boards')
        .select('id')
        .eq('client_id', clientData?.id)
        .limit(1)

      if (boards?.length > 0) {
        boardId = boards[0].id
      } else {
        // Try to find a general tasks board
        const { data: generalBoard } = await supabase
          .from('boards')
          .select('id')
          .ilike('name', '%general%')
          .limit(1)
        
        if (generalBoard?.length > 0) {
          boardId = generalBoard[0].id
        }
      }

      // Create the ticket
      const { data: newTicket, error } = await supabase
        .from('tickets')
        .insert({
          title: requestTitle,
          description: requestDescription,
          priority: requestPriority,
          type: requestType,
          status: 'To Do',
          client_id: clientData?.id,
          board_id: boardId,
          reporter_id: user.id,
          ticket_id: `REQ-${Date.now().toString(36).toUpperCase()}`,
        })
        .select()
        .single()

      if (error) throw error

      toast({
        title: '🎉 Request submitted!',
        description: 'Your team has been notified and will review shortly.',
        variant: 'success',
      })

      setRequestDialogOpen(false)
      setRequestTitle('')
      setRequestDescription('')
      setRequestPriority('medium')
      setRequestType('task')
      
      // Refresh tickets
      fetchData(true)

    } catch (error) {
      console.error('Error submitting request:', error)
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSubmittingRequest(false)
    }
  }

  // Open ticket detail and fetch comments
  const openTicketDetail = async (ticket) => {
    setSelectedTicket(ticket)
    
    // Fetch comments for this ticket
    const { data: comments } = await supabase
      .from('comments')
      .select('*, author:author_id(id, full_name, avatar_url)')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })

    setTicketComments(comments || [])
  }

  // Send comment on ticket
  const handleSendComment = async () => {
    if (!newComment.trim() || !selectedTicket) return

    setSendingComment(true)
    try {
      const { data: comment, error } = await supabase
        .from('comments')
        .insert({
          ticket_id: selectedTicket.id,
          author_id: user.id,
          content: newComment,
          mentioned_user_ids: mentionedUserIds,
        })
        .select('*, author:author_id(id, full_name, avatar_url)')
        .single()

      if (error) throw error

      setTicketComments(prev => [...prev, comment])
      setNewComment('')
      setMentionedUserIds([])

      toast({ title: 'Comment added!' })

    } catch (error) {
      console.error('Error adding comment:', error)
      toast({
        title: 'Error',
        description: 'Failed to add comment.',
        variant: 'destructive',
      })
    } finally {
      setSendingComment(false)
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    await signOut()
    navigate('/client-login')
  }

  // Filter tickets
  const filteredTickets = tickets.filter(ticket => {
    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
    const matchesSearch = !searchQuery || 
      ticket.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.ticket_id?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  // Stats
  const stats = {
    total: tickets.length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    completed: tickets.filter(t => t.status === 'Done').length,
    pending: tickets.filter(t => t.status === 'To Do').length,
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="max-w-6xl mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            <div className="grid grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              ))}
            </div>
            <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Company */}
            <div className="flex items-center gap-4">
              <img src={LOGO_WHITE} alt="Brandastic" className="h-8 dark:invert-0 invert" />
              {clientData && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700">
                  <Building2 className="h-4 w-4 text-slate-500" />
                  <span className="font-medium text-sm">{clientData.name}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              </Button>
              <Button
                onClick={() => setRequestDialogOpen(true)}
                className="bg-gradient-to-r from-brand-orange to-brand-coral text-white gap-2"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Request Work</span>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto p-4 sm:p-6">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Welcome Section */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-r from-blue-600 to-blue-700 text-white border-0 overflow-hidden">
              <CardContent className="p-6 relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <div className="relative">
                  <h1 className="text-2xl font-bold mb-2">
                    Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 👋
                  </h1>
                  <p className="text-blue-100">
                    Here's what's happening with your projects at Brandastic.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Stats Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700">
                    <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.inProgress}</p>
                    <p className="text-xs text-muted-foreground">In Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                    <Circle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats.completed}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Tickets List */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle>Your Projects</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 sm:w-48">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 h-9"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-32 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="To Do">To Do</SelectItem>
                          <SelectItem value="In Progress">In Progress</SelectItem>
                          <SelectItem value="In Review">In Review</SelectItem>
                          <SelectItem value="Done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredTickets.length === 0 ? (
                    <div className="text-center py-12">
                      <Rocket className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {tickets.length === 0 
                          ? "No projects yet! Ready to start something amazing?"
                          : "No matching projects found."}
                      </p>
                      {tickets.length === 0 && (
                        <Button onClick={() => setRequestDialogOpen(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          Request Your First Project
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredTickets.map((ticket) => {
                        const statusInfo = getStatusBadge(ticket.status)
                        const StatusIcon = statusInfo.icon
                        
                        return (
                          <motion.div
                            key={ticket.id}
                            whileHover={{ scale: 1.01 }}
                            className="p-4 rounded-xl border bg-card hover:shadow-md transition-all cursor-pointer"
                            onClick={() => openTicketDetail(ticket)}
                          >
                            <div className="flex items-start gap-4">
                              <div className={cn(
                                "p-2 rounded-lg",
                                statusInfo.color.replace('bg-', 'bg-') + '/10'
                              )}>
                                <StatusIcon className={cn("h-5 w-5", statusInfo.color.replace('bg-', 'text-'))} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h3 className="font-medium truncate">{ticket.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                      {ticket.ticket_id} • {formatRelativeDate(ticket.created_at)}
                                    </p>
                                  </div>
                                  <Badge className={cn("shrink-0", statusInfo.color, "text-white")}>
                                    {ticket.status}
                                  </Badge>
                                </div>
                                {ticket.description && (
                                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                                    {ticket.description}
                                  </p>
                                )}
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Sidebar */}
            <motion.div variants={itemVariants} className="space-y-6">
              {/* Your Team */}
              {teamMembers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Your Team</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {teamMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="bg-brand-orange/10 text-brand-orange">
                              {getInitials(member.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{member.full_name}</p>
                            <p className="text-xs text-muted-foreground">{member.title || 'Team Member'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Updates</CardTitle>
                </CardHeader>
                <CardContent>
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentActivity.slice(0, 5).map((activity) => (
                        <div key={activity.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={activity.author?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(activity.author?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{activity.author?.full_name}</span>
                              <span className="text-muted-foreground"> commented</span>
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {activity.content}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatRelativeDate(activity.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Quick Help */}
              <Card className="bg-gradient-to-br from-brand-orange/5 to-brand-coral/5 border-brand-orange/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-brand-orange/10">
                      <Sparkles className="h-5 w-5 text-brand-orange" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm mb-1">Need help?</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Contact your account manager or reach out directly.
                      </p>
                      <Button size="sm" variant="outline" className="text-xs" asChild>
                        <a href="mailto:support@brandastic.com">
                          Contact Support
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </motion.div>
      </main>

      {/* Request Work Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-brand-orange" />
              Request New Work
            </DialogTitle>
            <DialogDescription>
              Tell us what you need and we'll get started right away.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">What do you need?</Label>
              <Input
                id="title"
                placeholder="e.g., New landing page, Email campaign, Logo update..."
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Details (optional)</Label>
              <Textarea
                id="description"
                placeholder="Add any additional context, requirements, or notes..."
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                rows={4}
                className="mt-1.5"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority</Label>
                <Select value={requestPriority} onValueChange={setRequestPriority}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">🟢 Low</SelectItem>
                    <SelectItem value="medium">🟡 Medium</SelectItem>
                    <SelectItem value="high">🟠 High</SelectItem>
                    <SelectItem value="critical">🔴 Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="task">Task</SelectItem>
                    <SelectItem value="bug">Bug/Issue</SelectItem>
                    <SelectItem value="feature">Feature Request</SelectItem>
                    <SelectItem value="improvement">Improvement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitRequest}
              disabled={submittingRequest || !requestTitle.trim()}
              className="bg-gradient-to-r from-brand-orange to-brand-coral text-white"
            >
              {submittingRequest ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className="mb-2">{selectedTicket.ticket_id}</Badge>
                    <DialogTitle>{selectedTicket.title}</DialogTitle>
                  </div>
                  <Badge className={cn(getStatusBadge(selectedTicket.status).color, "text-white")}>
                    {selectedTicket.status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Description */}
                {selectedTicket.description && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>
                )}

                {/* Meta info */}
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Created {formatDate(selectedTicket.created_at)}</span>
                  </div>
                  {selectedTicket.priority && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground capitalize">{selectedTicket.priority} priority</span>
                    </div>
                  )}
                </div>

                {/* Comments */}
                <div>
                  <h4 className="text-sm font-medium mb-4">Comments</h4>
                  
                  {ticketComments.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No comments yet. Start the conversation!
                    </p>
                  ) : (
                    <div className="space-y-4 mb-4">
                      {ticketComments.map((comment) => (
                        <div key={comment.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={comment.author?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {getInitials(comment.author?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 p-3 rounded-lg bg-muted">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium text-sm">{comment.author?.full_name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeDate(comment.created_at)}
                              </span>
                            </div>
                            <MentionText content={comment.content} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add comment */}
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={profile?.avatar_url} />
                      <AvatarFallback>{getInitials(profile?.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <MentionInput
                        value={newComment}
                        onChange={setNewComment}
                        onMentionsChange={setMentionedUserIds}
                        placeholder="Add a comment..."
                        className="min-h-[80px]"
                      />
                      <div className="flex justify-end mt-2">
                        <Button 
                          size="sm" 
                          onClick={handleSendComment}
                          disabled={sendingComment || !newComment.trim()}
                        >
                          {sendingComment ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
