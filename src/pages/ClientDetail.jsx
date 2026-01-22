import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, Clock, DollarSign, Users, ArrowLeft, Calendar,
  TrendingUp, FileText, Timer, CheckCircle, AlertCircle,
  BarChart3, PieChart, Activity, ExternalLink, Edit2,
  Play, Ticket, Loader2, ChevronRight, Target, Zap,
  Download, RefreshCw, Mail, Phone
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Skeleton } from '../components/ui/skeleton'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function ClientDetail() {
  const { clientId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  // Fetch all client data
  const fetchClientData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle()

      if (clientError || !clientData) {
        toast({ title: 'Client not found', variant: 'destructive' })
        navigate('/clients')
        return
      }

      setClient(clientData)

      // Fetch time entries for this client
      const { data: timeData } = await supabase
        .from('time_entries')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('client_id', clientId)
        .order('date', { ascending: false })
        .limit(100)

      setTimeEntries(timeData || [])

      // Fetch tickets for this client
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*, boards(name)')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false })
        .limit(50)

      setTickets(ticketData || [])

      // Get unique team members who worked on this client
      if (timeData && timeData.length > 0) {
        const uniqueMembers = []
        const seenIds = new Set()
        for (const entry of timeData) {
          if (entry.profiles && !seenIds.has(entry.user_id)) {
            seenIds.add(entry.user_id)
            uniqueMembers.push({
              id: entry.user_id,
              ...entry.profiles,
              totalMinutes: timeData
                .filter(e => e.user_id === entry.user_id)
                .reduce((sum, e) => sum + (e.minutes || 0), 0)
            })
          }
        }
        setTeamMembers(uniqueMembers.sort((a, b) => b.totalMinutes - a.totalMinutes))
      }

      // Calculate monthly stats (last 6 months)
      const stats = []
      const now = new Date()
      for (let i = 5; i >= 0; i--) {
        const month = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0)
        const monthName = month.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
        
        const monthEntries = (timeData || []).filter(e => {
          const entryDate = new Date(e.date)
          return entryDate >= month && entryDate <= monthEnd
        })
        
        const totalMinutes = monthEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
        const billableMinutes = monthEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.minutes || 0), 0)
        
        stats.push({
          month: monthName,
          hours: Math.round(totalMinutes / 60),
          billableHours: Math.round(billableMinutes / 60),
          revenue: Math.round((billableMinutes / 60) * 175)
        })
      }
      setMonthlyStats(stats)

    } catch (error) {
      console.error('Error fetching client data:', error)
      toast({ title: 'Error loading client', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (clientId) {
      fetchClientData()
    }
  }, [clientId])

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-8 w-32 mb-6" />
        <Skeleton className="h-48 mb-6" />
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!client) return null

  // Calculate totals
  const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
  const totalHours = Math.round(totalMinutes / 60)
  const billableMinutes = timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.minutes || 0), 0)
  const billableHours = Math.round(billableMinutes / 60)
  const totalRevenue = billableHours * 175
  const monthlyBudget = (client.monthly_hours || 0)
  const currentMonthMinutes = timeEntries
    .filter(e => {
      const entryDate = new Date(e.date)
      const now = new Date()
      return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (e.minutes || 0), 0)
  const currentMonthHours = Math.round(currentMonthMinutes / 60)
  const budgetUsed = monthlyBudget > 0 ? Math.round((currentMonthHours / monthlyBudget) * 100) : 0

  const ticketsByStatus = {
    done: tickets.filter(t => t.status === 'done').length,
    inprogress: tickets.filter(t => t.status === 'inprogress').length,
    todo: tickets.filter(t => t.status === 'todo').length,
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants} className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clients')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Clients
        </Button>
      </motion.div>

      {/* Client Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="overflow-hidden">
          <div 
            className="h-32 relative"
            style={{ 
              background: `linear-gradient(135deg, ${client.color || '#F7931E'}88, ${client.color || '#F7931E'}44)` 
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
          </div>
          <CardContent className="relative pt-0">
            <div className="flex flex-col md:flex-row md:items-end gap-4 -mt-12">
              {/* Logo */}
              <div 
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-background"
                style={{ backgroundColor: client.color || '#F7931E' }}
              >
                {client.logo_url ? (
                  <img src={client.logo_url} alt={client.name} className="w-full h-full rounded-xl object-contain" />
                ) : (
                  client.name[0]
                )}
              </div>
              
              {/* Info */}
              <div className="flex-1 pb-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-3xl font-display font-bold">{client.name}</h1>
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    Active
                  </Badge>
                </div>
                {client.account_services && client.account_services.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {client.account_services.map((service, i) => (
                      <Badge key={i} variant="secondary">{service}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchClientData(true)}
                  disabled={refreshing}
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Refresh
                </Button>
                <Button 
                  size="sm" 
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => {
                    // Open the floating timer with this client pre-selected
                    if (window.openTimerWithClient) {
                      window.openTimerWithClient({ id: client.id, name: client.name, color: client.color })
                    } else {
                      toast({ title: 'Timer opened!', description: `Tracking time for ${client.name}` })
                    }
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Timer
                </Button>
              </div>
            </div>

            {/* Contact Info */}
            {(client.contact_email || client.contact_name) && (
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
                {client.contact_name && (
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    {client.contact_name}
                  </span>
                )}
                {client.contact_email && (
                  <a href={`mailto:${client.contact_email}`} className="flex items-center gap-1 hover:text-brand-orange">
                    <Mail className="h-4 w-4" />
                    {client.contact_email}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={containerVariants} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={currentMonthHours} />h
                    <span className="text-sm font-normal text-muted-foreground"> / {monthlyBudget}h</span>
                  </p>
                </div>
              </div>
              <Progress value={Math.min(budgetUsed, 100)} className="mt-3 h-2" />
              <p className="text-xs text-muted-foreground mt-1">{budgetUsed}% of budget used</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    $<AnimatedCounter value={totalRevenue} />
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {billableHours}h billable @ $175/hr
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Ticket className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tickets</p>
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={tickets.length} />
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant="secondary" className="text-green-600">{ticketsByStatus.done} done</Badge>
                <Badge variant="secondary" className="text-blue-600">{ticketsByStatus.inprogress} active</Badge>
                <Badge variant="secondary">{ticketsByStatus.todo} todo</Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Users className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={teamMembers.length} />
                  </p>
                </div>
              </div>
              <div className="flex -space-x-2 mt-3">
                {teamMembers.slice(0, 5).map((member) => (
                  <Avatar key={member.id} className="h-8 w-8 border-2 border-background">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="text-xs">
                      {member.full_name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {teamMembers.length > 5 && (
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium border-2 border-background">
                    +{teamMembers.length - 5}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants}>
        <Tabs defaultValue="activity" className="space-y-6">
          <TabsList>
            <TabsTrigger value="activity" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-2">
              <Timer className="h-4 w-4" />
              Time Entries
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest updates and work on this client</CardDescription>
              </CardHeader>
              <CardContent>
                {timeEntries.length === 0 && tickets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity yet</p>
                    <p className="text-sm">Start tracking time or create tickets to see activity here</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeEntries.slice(0, 10).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50">
                        <div className="p-2 rounded-full bg-blue-500/10">
                          <Clock className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.description || 'Time entry'}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.profiles?.full_name || 'Unknown'} • {formatDate(entry.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Math.round(entry.minutes / 60)}h {entry.minutes % 60}m</p>
                          {entry.billable && (
                            <Badge variant="secondary" className="text-green-600">Billable</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Time Entries Tab */}
          <TabsContent value="time">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Time Entries</CardTitle>
                    <CardDescription>All time tracked for this client</CardDescription>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {timeEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No time entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {timeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-sm">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={entry.profiles?.avatar_url} />
                          <AvatarFallback>{entry.profiles?.full_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.description || 'No description'}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.profiles?.full_name} • {formatDate(entry.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Math.round(entry.minutes / 60)}h {entry.minutes % 60}m</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.billable ? `$${Math.round((entry.minutes / 60) * 175)}` : 'Non-billable'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tickets Tab */}
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Tickets & Tasks</CardTitle>
                    <CardDescription>All work items for this client</CardDescription>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => {
                      // Navigate to boards with this client, or show a toast
                      toast({ 
                        title: 'Create ticket', 
                        description: 'Go to a board to create tickets for this client' 
                      })
                      navigate(`/boards?client=${clientId}`)
                    }}
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tickets yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        to={`/tickets/${ticket.id}`}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-sm hover:border-brand-orange/30 transition-all"
                      >
                        <div className={cn(
                          "p-2 rounded-full",
                          ticket.status === 'done' && "bg-green-500/10",
                          ticket.status === 'inprogress' && "bg-blue-500/10",
                          ticket.status === 'todo' && "bg-gray-500/10"
                        )}>
                          {ticket.status === 'done' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : ticket.status === 'inprogress' ? (
                            <Loader2 className="h-4 w-4 text-blue-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {ticket.boards?.name || 'No board'} • {ticket.key}
                          </p>
                        </div>
                        <Badge variant={
                          ticket.priority === 'high' ? 'destructive' : 
                          ticket.priority === 'medium' ? 'default' : 'secondary'
                        }>
                          {ticket.priority}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Monthly Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Monthly Breakdown
                  </CardTitle>
                  <CardDescription>Hours and revenue over time</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyStats.map((stat, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{stat.month}</span>
                          <span className="text-muted-foreground">
                            {stat.hours}h • ${stat.revenue.toLocaleString()}
                          </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-brand-orange to-brand-coral rounded-full transition-all"
                            style={{ width: `${Math.min((stat.hours / (client.monthly_hours || 100)) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Summary
                  </CardTitle>
                  <CardDescription>Overall client metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold text-brand-orange">{totalHours}h</p>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Total Revenue</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold">{tickets.length}</p>
                      <p className="text-sm text-muted-foreground">Total Tickets</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold">{teamMembers.length}</p>
                      <p className="text-sm text-muted-foreground">Team Members</p>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Billable Rate</span>
                      <span className="text-green-600 font-bold">
                        {totalHours > 0 ? Math.round((billableHours / totalHours) * 100) : 0}%
                      </span>
                    </div>
                    <Progress 
                      value={totalHours > 0 ? (billableHours / totalHours) * 100 : 0} 
                      className="h-2"
                    />
                  </div>

                  <Button className="w-full" variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Full Report
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>People who have worked on this client</CardDescription>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No team activity yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="p-4 rounded-xl border hover:shadow-md transition-all">
                        <div className="flex items-center gap-3 mb-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback>{member.full_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold">{member.full_name || 'Unknown'}</p>
                            <p className="text-sm text-muted-foreground">Team Member</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="font-bold">{Math.round(member.totalMinutes / 60)}h</p>
                            <p className="text-xs text-muted-foreground">Hours</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="font-bold text-green-600">
                              ${Math.round((member.totalMinutes / 60) * 175).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
