import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  User, Clock, DollarSign, Building2, ArrowLeft, Calendar,
  TrendingUp, Timer, CheckCircle, AlertCircle, Cake, Award,
  BarChart3, Activity, Mail, Sparkles, Target, Gift,
  Download, RefreshCw, Ticket, ChevronRight, Briefcase, Star,
  Bot, UserRound
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

export default function TeamMemberDetail() {
  const { memberId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [member, setMember] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [tickets, setTickets] = useState([])
  const [clientsWorkedOn, setClientsWorkedOn] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [refreshing, setRefreshing] = useState(false)

  // Calculate years at company
  const getYearsAtCompany = (startDate) => {
    if (!startDate) return null
    const start = new Date(startDate)
    const now = new Date()
    const years = Math.floor((now - start) / (365.25 * 24 * 60 * 60 * 1000))
    return years
  }

  // Format birthday for display
  const formatBirthday = (birthday) => {
    if (!birthday) return null
    const date = new Date(birthday + 'T00:00:00')
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  }

  // Check if birthday is today or upcoming (within 7 days)
  const isBirthdayUpcoming = (birthday) => {
    if (!birthday) return false
    const today = new Date()
    const bday = new Date(birthday + 'T00:00:00')
    bday.setFullYear(today.getFullYear())
    const diff = bday - today
    return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
  }

  // Fetch all member data
  const fetchMemberData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch member profile
      const { data: memberData, error: memberError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .maybeSingle()

      if (memberError || !memberData) {
        toast({ title: 'Team member not found', variant: 'destructive' })
        navigate('/team-hub')
        return
      }

      setMember(memberData)

      // Fetch time entries for this member (with fallback for schema issues)
      let timeData = null
      try {
        const { data, error } = await supabase
          .from('time_entries')
          .select('*, clients:client_id(id, name, color, slug)')
          .eq('user_id', memberId)
          .order('date', { ascending: false })
          .limit(100)
        
        if (error) {
          // Fallback: simple query without joins
          const { data: fallbackData } = await supabase
            .from('time_entries')
            .select('*')
            .eq('user_id', memberId)
            .order('created_at', { ascending: false })
            .limit(100)
          timeData = fallbackData
        } else {
          timeData = data
        }
      } catch (e) {
        console.log('Time entries fetch error:', e)
      }

      setTimeEntries(timeData || [])

      // Fetch tickets assigned to this member (with fallback)
      let ticketData = null
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('*, boards(name, clients(id, name, color)), client:clients(id, name, color, slug)')
          .eq('assigned_to', memberId)
          .order('updated_at', { ascending: false })
          .limit(50)
        
        if (error) {
          // Fallback: simple query
          const { data: fallbackData } = await supabase
            .from('tickets')
            .select('*')
            .eq('assigned_to', memberId)
            .order('updated_at', { ascending: false })
            .limit(50)
          ticketData = fallbackData
        } else {
          ticketData = data
        }
      } catch (e) {
        console.log('Tickets fetch error:', e)
      }

      setTickets(ticketData || [])

      // Get unique clients worked on
      if (timeData && timeData.length > 0) {
        const uniqueClients = []
        const seenIds = new Set()
        for (const entry of timeData) {
          if (entry.clients && !seenIds.has(entry.client_id)) {
            seenIds.add(entry.client_id)
            uniqueClients.push({
              ...entry.clients,
              totalMinutes: timeData
                .filter(e => e.client_id === entry.client_id)
                .reduce((sum, e) => sum + (e.minutes || 0), 0)
            })
          }
        }
        setClientsWorkedOn(uniqueClients.sort((a, b) => b.totalMinutes - a.totalMinutes))
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
      console.error('Error fetching member data:', error)
      toast({ title: 'Error loading member', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (memberId) {
      fetchMemberData()
    }
  }, [memberId])

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

  if (!member) return null

  // Calculate totals
  const totalMinutes = timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0)
  const totalHours = Math.round(totalMinutes / 60)
  const billableMinutes = timeEntries.filter(e => e.billable).reduce((sum, e) => sum + (e.minutes || 0), 0)
  const billableHours = Math.round(billableMinutes / 60)
  const totalRevenue = billableHours * 175
  const targetHours = member.target_hours_monthly || 160
  const currentMonthMinutes = timeEntries
    .filter(e => {
      const entryDate = new Date(e.date)
      const now = new Date()
      return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
    })
    .reduce((sum, e) => sum + (e.minutes || 0), 0)
  const currentMonthHours = Math.round(currentMonthMinutes / 60)
  const targetProgress = targetHours > 0 ? Math.round((currentMonthHours / targetHours) * 100) : 0

  const ticketsByStatus = {
    done: tickets.filter(t => t.status === 'done').length,
    inprogress: tickets.filter(t => t.status === 'inprogress').length,
    todo: tickets.filter(t => t.status === 'todo').length,
  }

  const yearsAtCompany = getYearsAtCompany(member.work_start_date)
  const birthdayDisplay = formatBirthday(member.birthday)
  const isBirthdaySoon = isBirthdayUpcoming(member.birthday)

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Back Button */}
      <motion.div variants={itemVariants} className="mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/team-hub')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Team Hub
        </Button>
      </motion.div>

      {/* Member Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="overflow-hidden">
          {/* Banner - supports custom banner image */}
          <div 
            className="h-36 md:h-40 relative"
            style={{
              background: member.banner_url 
                ? `url(${member.banner_url}) center/cover no-repeat`
                : 'linear-gradient(135deg, #F7931E 0%, #E8614D 50%, #8B5CF6 100%)'
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          
          {/* Profile Info - Properly spaced below banner */}
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Avatar - overlaps banner */}
              <div className="-mt-14 md:-mt-16 relative z-10 flex-shrink-0">
                <Avatar className="w-24 h-24 md:w-28 md:h-28 border-4 border-background shadow-xl">
                  <AvatarImage src={member.avatar_url} />
                  <AvatarFallback className="text-2xl bg-brand-orange text-white">
                    {member.full_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
              </div>
              
              {/* Info - starts below avatar overlap on mobile */}
              <div className="flex-1 pt-1 md:pt-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    {/* Name & Badges */}
                                    <div className="flex items-center gap-3 flex-wrap mb-1">
                                      <h1 className="text-2xl md:text-3xl font-display font-bold">{member.full_name || 'Team Member'}</h1>
                                      <Badge variant="outline" className="capitalize">
                                        {member.role || 'Team'}
                                      </Badge>
                                      {member.is_ai ? (
                                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/30">
                                          <Bot className="h-3 w-3 mr-1" />
                                          AI Agent
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30">
                                          <UserRound className="h-3 w-3 mr-1" />
                                          Human
                                        </Badge>
                                      )}
                                      {isBirthdaySoon && (
                                        <Badge className="bg-pink-500 text-white animate-pulse">
                                          <Cake className="h-3 w-3 mr-1" />
                                          Birthday Soon!
                                        </Badge>
                                      )}
                                    </div>
                                    
                                    {/* Title/Position */}
                                    {member.title && (
                                      <p className="text-muted-foreground font-medium flex items-center gap-2 mb-2">
                                        <Briefcase className="h-4 w-4 text-brand-orange flex-shrink-0" />
                                        {member.title}
                                      </p>
                                    )}
                                    
                                    {/* Tagline */}
                    {member.tagline && (
                      <p className="text-muted-foreground flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-brand-orange flex-shrink-0" />
                        <span className="italic">"{member.tagline}"</span>
                      </p>
                    )}

                    {/* Quick Info */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                      {member.email && (
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-4 w-4" />
                          {member.email}
                        </span>
                      )}
                      {yearsAtCompany !== null && (
                        <span className="flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4" />
                          {yearsAtCompany === 0 ? 'Started this year' : `${yearsAtCompany}+ years at Brandastic`}
                        </span>
                      )}
                      {birthdayDisplay && member.show_birthday && (
                        <span className="flex items-center gap-1.5">
                          <Cake className="h-4 w-4 text-pink-500" />
                          {birthdayDisplay}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Actions - positioned right on desktop */}
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchMemberData(true)}
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      <span className="ml-2 hidden sm:inline">Refresh</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
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
                    {Math.round(currentMonthHours)}h
                    <span className="text-sm font-normal text-muted-foreground"> / {targetHours}h</span>
                  </p>
                </div>
              </div>
              <Progress value={Math.min(targetProgress, 100)} className="mt-3 h-2" />
              <p className="text-xs text-muted-foreground mt-1">{targetProgress}% of monthly target</p>
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
                  <p className="text-sm text-muted-foreground">Revenue Generated</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${Math.round(totalRevenue).toLocaleString()}
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
                  <Building2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Clients</p>
                  <p className="text-2xl font-bold">
                    {clientsWorkedOn.length}
                  </p>
                </div>
              </div>
              <div className="flex -space-x-1 mt-3">
                {clientsWorkedOn.slice(0, 5).map((client) => (
                  <div
                    key={client.id}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-background"
                    style={{ backgroundColor: client.color || '#F7931E' }}
                    title={client.name}
                  >
                    {client.name[0]}
                  </div>
                ))}
                {clientsWorkedOn.length > 5 && (
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium border-2 border-background">
                    +{clientsWorkedOn.length - 5}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Ticket className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Assigned Tickets</p>
                  <p className="text-2xl font-bold">
                    {tickets.length}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Badge variant="secondary" className="text-green-600">{ticketsByStatus.done} done</Badge>
                <Badge variant="secondary" className="text-blue-600">{ticketsByStatus.inprogress} active</Badge>
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
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Clients
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Tickets
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Stats
            </TabsTrigger>
          </TabsList>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest work and time tracked</CardDescription>
              </CardHeader>
              <CardContent>
                {timeEntries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timeEntries.slice(0, 15).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50">
                        <div 
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
                          style={{ backgroundColor: entry.clients?.color || '#F7931E' }}
                        >
                          {entry.clients?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.description || 'Time entry'}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.clients?.name || 'Unknown client'} • {formatDate(entry.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{Math.round(entry.minutes / 60)}h {entry.minutes % 60}m</p>
                          {entry.billable && (
                            <Badge className="bg-green-500 text-white hover:bg-green-600">Billable</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Clients Tab */}
          <TabsContent value="clients">
            <Card>
              <CardHeader>
                <CardTitle>Clients Worked On</CardTitle>
                <CardDescription>All clients this team member has contributed to</CardDescription>
              </CardHeader>
              <CardContent>
                {clientsWorkedOn.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No client work yet</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {clientsWorkedOn.map((client) => (
                      <Link
                        key={client.id}
                        to={`/clients/${client.slug || client.id}`}
                        className="p-4 rounded-xl border hover:shadow-md hover:border-brand-orange/30 transition-all group"
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div
                            className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-lg font-bold"
                            style={{ backgroundColor: client.color || '#F7931E' }}
                          >
                            {client.name[0]}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold group-hover:text-brand-orange transition-colors">
                              {client.name}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="font-bold">{Math.round(client.totalMinutes / 60)}h</p>
                            <p className="text-xs text-muted-foreground">Hours</p>
                          </div>
                          <div className="p-2 rounded-lg bg-muted/50">
                            <p className="font-bold text-green-600">
                              ${Math.round((client.totalMinutes / 60) * 175).toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground">Revenue</p>
                          </div>
                        </div>
                      </Link>
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
                <CardTitle>Assigned Tickets</CardTitle>
                <CardDescription>Tasks assigned to this team member</CardDescription>
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tickets assigned</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tickets.map((ticket) => (
                      <Link
                        key={ticket.id}
                        to={`/clients/${ticket.client?.slug || ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
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
                            <Timer className="h-4 w-4 text-blue-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-gray-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{ticket.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {ticket.client?.name || ticket.boards?.clients?.name || ticket.boards?.name || 'No board'}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Monthly Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Monthly Performance
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
                            style={{ width: `${Math.min((stat.hours / targetHours) * 100, 100)}%` }}
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
                    <Star className="h-5 w-5" />
                    Summary
                  </CardTitle>
                  <CardDescription>Overall performance metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold text-brand-orange">{totalHours}h</p>
                      <p className="text-sm text-muted-foreground">Total Hours</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">Revenue Generated</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold">{clientsWorkedOn.length}</p>
                      <p className="text-sm text-muted-foreground">Clients</p>
                    </div>
                    <div className="p-4 rounded-xl bg-muted/50 text-center">
                      <p className="text-3xl font-bold">{ticketsByStatus.done}</p>
                      <p className="text-sm text-muted-foreground">Tickets Completed</p>
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

                  {yearsAtCompany !== null && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-brand-orange/10 to-brand-coral/10 border border-brand-orange/20">
                      <div className="flex items-center gap-3">
                        <Award className="h-8 w-8 text-brand-orange" />
                        <div>
                          <p className="font-semibold">
                            {yearsAtCompany === 0 ? 'New Team Member!' : `${yearsAtCompany}+ Years at Brandastic`}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Joined {formatDate(member.work_start_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>
    </motion.div>
  )
}
