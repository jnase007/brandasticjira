import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Kanban,
  CheckCircle,
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
} from 'lucide-react'
import { supabase, getClient, getBoards, getTickets, getClientHoursSummary } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDuration, calculateProgress, getProgressColor, getStatusInfo, formatDate, formatRelativeDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Textarea } from '../components/ui/textarea'
import { Skeleton } from '../components/ui/skeleton'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const REQUEST_TYPES = {
  approval: { icon: ThumbsUp, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Approval Needed' },
  assets: { icon: Image, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Assets Requested' },
  feedback: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Feedback Needed' },
  content: { icon: FileText, color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Content Needed' },
  payment: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Payment Due' },
  meeting: { icon: Users, color: 'text-teal-500', bg: 'bg-teal-500/10', label: 'Meeting Request' },
  general: { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'Request' },
}

const PRIORITY_COLORS = {
  urgent: 'text-red-500 bg-red-500/10 border-red-500/30',
  high: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  medium: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30',
  low: 'text-green-500 bg-green-500/10 border-green-500/30',
}

export default function ClientPortal() {
  const { profile, user } = useAuth()
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
  const [newMessage, setNewMessage] = useState('')
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [sendingMessage, setSendingMessage] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.client_id) return

      setLoading(true)
      try {
        const [clientRes, boardsRes, ticketsRes, hoursRes] = await Promise.all([
          getClient(profile.client_id),
          getBoards(profile.client_id),
          getTickets(null, profile.client_id),
          getClientHoursSummary(),
        ])

        if (clientRes.data) setClient(clientRes.data)
        if (boardsRes.data) setBoards(boardsRes.data)
        if (ticketsRes.data) setTickets(ticketsRes.data)
        
        // Find this client's summary
        const summary = hoursRes.data?.find((h) => h.client_id === profile.client_id)
        if (summary) setHoursSummary(summary)

        // Fetch client-specific data
        const [requestsRes, projectsRes, recapsRes] = await Promise.all([
          supabase
            .from('client_requests')
            .select('*, creator:profiles!client_requests_created_by_fkey(full_name, avatar_url)')
            .eq('client_id', profile.client_id)
            .order('created_at', { ascending: false }),
          supabase
            .from('client_projects')
            .select('*')
            .eq('client_id', profile.client_id)
            .eq('is_visible_to_client', true)
            .order('completed_date', { ascending: false }),
          supabase
            .from('client_monthly_recaps')
            .select('*')
            .eq('client_id', profile.client_id)
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
      }
    }

    fetchData()
  }, [profile?.client_id])

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

      toast({ title: 'Message sent!', variant: 'success' })
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

      // Refresh requests
      const { data } = await supabase
        .from('client_requests')
        .select('*, creator:profiles!client_requests_created_by_fkey(full_name, avatar_url)')
        .eq('client_id', profile.client_id)
        .order('created_at', { ascending: false })
      
      setRequests(data || [])
    } catch (error) {
      toast({ title: 'Failed to update', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-16 w-16 rounded-2xl" />
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-6 text-center max-w-md mx-auto mt-20">
        <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-bold mb-2">Account Not Linked</h2>
        <p className="text-muted-foreground mb-4">
          Your account is not associated with a client profile. Please contact your Brandastic team to get set up.
        </p>
        <Button variant="outline" asChild>
          <a href="mailto:support@brandastic.com">Contact Support</a>
        </Button>
      </div>
    )
  }

  // Calculate stats
  const todoCount = tickets.filter((t) => t.status === 'todo').length
  const inProgressCount = tickets.filter((t) => t.status === 'inprogress').length
  const doneCount = tickets.filter((t) => t.status === 'done').length
  const hoursProgress = calculateProgress(hoursSummary?.hours_used || 0, hoursSummary?.monthly_hours || 1)
  const hoursColor = getProgressColor(hoursProgress)
  const pendingRequests = requests.filter(r => r.status === 'pending')

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 max-w-6xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {client.logo_url ? (
              <img
                src={client.logo_url}
                alt={client.name}
                className="h-16 w-16 rounded-2xl object-contain bg-white border shadow-lg"
              />
            ) : (
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center text-white font-display font-bold text-2xl shadow-lg"
                style={{ backgroundColor: client.color || '#F7931E' }}
              >
                {client.name[0]}
              </div>
            )}
            <div>
              <h1 className="text-3xl font-display font-bold">{client.name}</h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand-orange" />
                Welcome to your client portal
              </p>
            </div>
          </div>
          
          {pendingRequests.length > 0 && (
            <Badge className="bg-brand-orange text-white gap-1 animate-pulse">
              <Bell className="h-3 w-3" />
              {pendingRequests.length} action{pendingRequests.length > 1 ? 's' : ''} needed
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="border-brand-orange/30 bg-brand-orange/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-brand-orange/10">
                    <AlertCircle className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div>
                    <p className="font-medium">We need your input!</p>
                    <p className="text-sm text-muted-foreground">
                      {pendingRequests.length} pending request{pendingRequests.length > 1 ? 's' : ''} await your response
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => document.getElementById('requests-tab')?.click()}
                >
                  View Requests
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      <motion.div variants={containerVariants} className="grid gap-4 md:grid-cols-4 mb-8">
        {/* Hours Card */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <span className="text-sm text-muted-foreground">Monthly Hours</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold">
                  <AnimatedCounter value={Math.round(hoursSummary?.hours_used || 0)} />
                </span>
                <span className="text-muted-foreground mb-1">/ {client.monthly_hours}h</span>
              </div>
              <Progress value={hoursProgress} className="h-2" indicatorClassName={hoursColor} />
              <p className="text-xs text-muted-foreground mt-2">
                {Math.round(hoursSummary?.hours_remaining || client.monthly_hours)}h remaining
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Tasks */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <span className="text-sm text-muted-foreground">Tasks Completed</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-bold text-green-500">
                  <AnimatedCounter value={doneCount} />
                </span>
                <span className="text-muted-foreground mb-1">/ {tickets.length}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {inProgressCount} in progress, {todoCount} planned
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Projects */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Award className="h-5 w-5 text-purple-500" />
                </div>
                <span className="text-sm text-muted-foreground">Projects Delivered</span>
              </div>
              <span className="text-3xl font-bold text-purple-500">
                <AnimatedCounter value={projects.length} />
              </span>
              <p className="text-xs text-muted-foreground mt-2">
                View your portfolio below
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Active Boards */}
        <motion.div variants={itemVariants}>
          <Card className="h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Kanban className="h-5 w-5 text-orange-500" />
                </div>
                <span className="text-sm text-muted-foreground">Active Projects</span>
              </div>
              <span className="text-3xl font-bold text-orange-500">
                <AnimatedCounter value={boards.length} />
              </span>
              <p className="text-xs text-muted-foreground mt-2">
                Currently in progress
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="overview">
          <TabsList className="bg-muted/50 mb-6">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="requests" id="requests-tab" className="gap-2">
              <Bell className="h-4 w-4" />
              Requests
              {pendingRequests.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-brand-orange text-white">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <Star className="h-4 w-4" />
              Portfolio
            </TabsTrigger>
            <TabsTrigger value="recaps" className="gap-2">
              <Calendar className="h-4 w-4" />
              Monthly Recaps
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-brand-orange" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest updates on your projects</CardDescription>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Kanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.slice(0, 8).map((ticket) => (
                      <div
                        key={ticket.id}
                        className="flex items-center justify-between p-3 rounded-xl border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <Badge variant={ticket.status} className="w-24 justify-center">
                            {getStatusInfo(ticket.status).label}
                          </Badge>
                          <div>
                            <p className="font-medium text-sm">{ticket.title}</p>
                            <p className="text-xs text-muted-foreground">{ticket.ticket_id}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={PRIORITY_COLORS[ticket.priority]}>
                          {ticket.priority}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Current Projects */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-green-500" />
                  Active Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                {boards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Kanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No active projects</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {boards.map((board) => {
                      const boardTickets = tickets.filter((t) => t.board_id === board.id)
                      const boardDone = boardTickets.filter((t) => t.status === 'done').length
                      const boardProgress = boardTickets.length > 0
                        ? Math.round((boardDone / boardTickets.length) * 100)
                        : 0

                      return (
                        <div
                          key={board.id}
                          className="p-4 rounded-xl border hover:shadow-md transition-all"
                        >
                          <h3 className="font-semibold mb-2">{board.name}</h3>
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{boardTickets.length} tasks</span>
                            <span className="font-medium">{boardProgress}%</span>
                          </div>
                          <Progress value={boardProgress} className="h-2" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {requests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">All caught up!</h3>
                  <p className="text-muted-foreground">No pending requests at this time.</p>
                </CardContent>
              </Card>
            ) : (
              requests.map((request) => {
                const typeConfig = REQUEST_TYPES[request.type] || REQUEST_TYPES.general
                const Icon = typeConfig.icon
                
                return (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={cn(
                      "transition-all",
                      request.status === 'pending' && "border-brand-orange/30 shadow-md"
                    )}>
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-start gap-4">
                            <div className={cn("p-3 rounded-xl", typeConfig.bg)}>
                              <Icon className={cn("h-6 w-6", typeConfig.color)} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold">{request.title}</h3>
                                <Badge variant="outline" className={PRIORITY_COLORS[request.priority]}>
                                  {request.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {typeConfig.label} • Requested {formatRelativeDate(new Date(request.created_at))}
                              </p>
                              {request.description && (
                                <p className="text-sm">{request.description}</p>
                              )}
                              {request.due_date && (
                                <p className="text-sm text-orange-500 mt-2">
                                  <Calendar className="h-4 w-4 inline mr-1" />
                                  Due: {formatDate(request.due_date)}
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge
                            variant={request.status === 'pending' ? 'default' : 'secondary'}
                            className={request.status === 'pending' ? 'bg-brand-orange' : ''}
                          >
                            {request.status}
                          </Badge>
                        </div>

                        {request.status === 'pending' && (
                          <div className="flex items-center gap-3 pt-4 border-t">
                            {request.type === 'approval' && (
                              <>
                                <Button
                                  onClick={() => handleRequestAction(request, 'approved')}
                                  className="gap-2"
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleRequestAction(request, 'rejected')}
                                  className="gap-2"
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                  Request Changes
                                </Button>
                              </>
                            )}
                            <Button
                              variant="outline"
                              onClick={() => {
                                setSelectedRequest(request)
                                fetchMessages(request.id)
                              }}
                              className="gap-2"
                            >
                              <MessageSquare className="h-4 w-4" />
                              Reply
                            </Button>
                          </div>
                        )}

                        {request.status !== 'pending' && request.completed_at && (
                          <p className="text-sm text-muted-foreground pt-4 border-t">
                            {request.status === 'approved' ? '✅ Approved' : '📝 Updated'} on {formatDate(request.completed_at)}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                )
              })
            )}
          </TabsContent>

          {/* Portfolio Tab */}
          <TabsContent value="projects">
            {projects.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Portfolio Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Your completed projects will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {projects.map((project) => (
                  <Card key={project.id} className="overflow-hidden group hover:shadow-lg transition-all">
                    {project.image_url && (
                      <div className="aspect-video bg-muted overflow-hidden">
                        <img
                          src={project.image_url}
                          alt={project.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold">{project.title}</h3>
                        {project.is_featured && (
                          <Badge className="bg-yellow-500 text-white">
                            <Star className="h-3 w-3 mr-1" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      {project.category && (
                        <Badge variant="outline" className="mb-2">{project.category}</Badge>
                      )}
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-3">{project.description}</p>
                      )}
                      {project.url && (
                        <Button variant="outline" size="sm" asChild>
                          <a href={project.url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Live
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Monthly Recaps Tab */}
          <TabsContent value="recaps">
            {recaps.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Monthly Recaps Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Your monthly progress reports will appear here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {recaps.map((recap) => (
                  <Card key={recap.id} className="hover:shadow-md transition-all">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-brand-orange" />
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
                          <ul className="text-sm space-y-1">
                            {recap.highlights.slice(0, 4).map((h, i) => (
                              <li key={i} className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
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
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setSelectedRequest(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
            >
              <div className="p-4 border-b">
                <h3 className="font-semibold">{selectedRequest.title}</h3>
                <p className="text-sm text-muted-foreground">Conversation</p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex gap-3",
                        msg.is_from_client && "flex-row-reverse"
                      )}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={msg.sender?.avatar_url} />
                        <AvatarFallback>
                          {msg.sender?.full_name?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className={cn(
                        "max-w-[70%] p-3 rounded-2xl",
                        msg.is_from_client
                          ? "bg-brand-orange text-white"
                          : "bg-muted"
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
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="self-end"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
