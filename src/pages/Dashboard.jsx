import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Clock,
  Kanban,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Search,
  BarChart3,
  Calendar,
  Zap,
  Target,
  Award,
  ChevronRight,
  Sparkles,
  RefreshCw,
  Building2,
} from 'lucide-react'
import { getClients, getBoards, getClientHoursSummary, getTickets } from '../lib/supabase'
import ClientDialog from '../components/ClientDialog'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDuration, calculateProgress, getProgressColor, formatRelativeDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Badge } from '../components/ui/badge'
import { Skeleton, SkeletonStats } from '../components/ui/skeleton'
import AnimatedCounter, { PercentageCounter, HoursCounter } from '../components/AnimatedCounter'
import { DonutChart, AreaChart, ProgressList, Sparkline } from '../components/Charts'
import { SmartInsights } from '../components/SmartInsights'
import { WeeklyGoals } from '../components/WeeklyGoals'
import { KudosWidget } from '../components/Kudos'
import { CelebrationBanner, UpcomingCelebrations } from '../components/Celebrations'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300
    }
  },
}

import { getGreeting as getFunGreeting, getFunFact } from '../lib/funMessages'
import EmptyState from '../components/EmptyState'

// Greeting based on time of day (now uses fun messages)

// Sample sparkline data generator
function generateSparklineData() {
  return Array.from({ length: 7 }, () => Math.floor(Math.random() * 100) + 20)
}

// Sample hours trend data
const HOURS_TREND = [
  { label: 'Mon', value: 28 },
  { label: 'Tue', value: 35 },
  { label: 'Wed', value: 42 },
  { label: 'Thu', value: 38 },
  { label: 'Fri', value: 45 },
  { label: 'Sat', value: 12 },
  { label: 'Sun', value: 8 },
]

export default function Dashboard({ onConfetti }) {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [boards, setBoards] = useState([])
  const [hoursSummary, setHoursSummary] = useState([])
  const [recentTickets, setRecentTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    
    try {
      const [clientsRes, boardsRes, hoursRes, ticketsRes] = await Promise.all([
        getClients(),
        getBoards(),
        getClientHoursSummary(),
        getTickets(),
      ])

      setClients(clientsRes.data || [])
      setBoards(boardsRes.data || [])
      setHoursSummary(hoursRes.data || [])
      setRecentTickets((ticketsRes.data || []).slice(0, 5))
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Calculate totals
  const totalClients = clients.length
  const totalBoards = boards.length
  const totalHoursUsed = hoursSummary.reduce((sum, c) => sum + (c.hours_used || 0), 0)
  const totalHoursAvailable = hoursSummary.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)
  const utilization = totalHoursAvailable > 0 ? Math.round((totalHoursUsed / totalHoursAvailable) * 100) : 0

  // Filter clients by search
  const filteredHoursSummary = hoursSummary.filter((client) =>
    client.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Completed tickets count
  const completedTickets = recentTickets.filter(t => t.status === 'done').length

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto animate-fade-in-up">
        {/* Header Skeleton */}
        <div className="mb-10">
          <Skeleton className="h-10 w-80 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        
        {/* Stats Skeleton */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <SkeletonStats key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
        
        {/* Main Content Skeleton */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-10 w-64 rounded-xl" />
              </div>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-5 rounded-2xl border animate-fade-in-up" style={{ animationDelay: `${(i + 4) * 100}ms` }}>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-xl" />
                        <div>
                          <Skeleton className="h-5 w-32 mb-1" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                      <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-3 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <Skeleton className="h-32 w-32 rounded-full mx-auto mb-4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Celebration Banner - Shows when someone has birthday/anniversary today */}
      <CelebrationBanner />

      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="mb-10"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2 flex items-center gap-3">
              {getFunGreeting(profile?.full_name)}
              <motion.span
                animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                transition={{ duration: 2.5, delay: 0.5 }}
                className="inline-block origin-bottom-right"
              >
                👋
              </motion.span>
            </h1>
            <p className="text-lg text-muted-foreground">
              {getFunFact()}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-orange transition-colors">
                    <AnimatedCounter value={totalClients} />
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                    <TrendingUp className="h-3 w-3" />
                    <span>+2 this month</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                    <Users className="h-7 w-7 text-brand-orange" />
                  </div>
                  <Sparkline data={generateSparklineData()} className="absolute -bottom-2 -right-2 opacity-50" />
                </div>
              </div>
            </CardContent>
            {/* Decorative gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-blue transition-colors">
                    <AnimatedCounter value={totalBoards} />
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Kanban className="h-3 w-3" />
                    <span>{boards.filter(b => b.type === 'kanban').length} kanban</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Kanban className="h-7 w-7 text-brand-blue" />
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-blue/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hours Used</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-purple transition-colors">
                    <AnimatedCounter value={Math.round(totalHoursUsed)} />
                    <span className="text-lg text-muted-foreground font-normal ml-1">
                      /{totalHoursAvailable}
                    </span>
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{Math.round(totalHoursAvailable - totalHoursUsed)}h remaining</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Clock className="h-7 w-7 text-brand-purple" />
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-purple/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-teal transition-colors">
                    <PercentageCounter value={utilization} />
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                    <Target className="h-3 w-3" />
                    <span>On track</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-teal-500/10 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-7 w-7 text-brand-teal" />
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Hours - Left Column */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 space-y-6"
        >
          {/* Client Hours Card */}
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-xl">Client Hours</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Monthly hour allocation by client</p>
              </div>
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-muted/50 border-0 focus:bg-background focus:ring-2 focus:ring-brand-orange/20"
                />
              </div>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="popLayout">
                <div className="space-y-4">
                  {filteredHoursSummary.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-center py-12"
                    >
                      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                        <Building2 className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <p className="text-muted-foreground">No clients found</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4"
                        onClick={() => setClientDialogOpen(true)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Client
                      </Button>
                    </motion.div>
                  ) : (
                    filteredHoursSummary.map((client, index) => {
                      const progress = calculateProgress(client.hours_used, client.monthly_hours)
                      const isOverBudget = progress > 100
                      const isNearLimit = progress >= 90 && progress <= 100
                      
                      return (
                        <motion.div
                          key={client.client_id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.05 }}
                          className={cn(
                            "p-5 rounded-2xl border bg-card transition-all duration-300",
                            "hover:shadow-md hover:border-brand-orange/30 cursor-pointer group"
                          )}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              {clients.find(c => c.id === client.client_id)?.logo_url ? (
                                <img
                                  src={clients.find(c => c.id === client.client_id)?.logo_url}
                                  alt={client.client_name}
                                  className="w-12 h-12 rounded-xl object-contain bg-white border shadow-lg transition-transform group-hover:scale-110"
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg transition-transform group-hover:scale-110"
                                  style={{ 
                                    backgroundColor: clients.find(c => c.id === client.client_id)?.color || '#F7931E',
                                    boxShadow: `0 4px 14px ${clients.find(c => c.id === client.client_id)?.color || '#F7931E'}40`
                                  }}
                                >
                                  {client.client_name?.charAt(0) || 'C'}
                                </div>
                              )}
                              <div>
                                <h3 className="font-semibold text-lg group-hover:text-brand-orange transition-colors">
                                  {client.client_name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {Math.round(client.hours_remaining || 0)}h remaining
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <p className="font-bold text-lg">
                                  <AnimatedCounter value={Math.round(client.hours_used || 0)} />
                                  <span className="text-muted-foreground font-normal text-sm">
                                    /{client.monthly_hours}h
                                  </span>
                                </p>
                              </div>
                              <Badge
                                variant={isOverBudget ? 'destructive' : isNearLimit ? 'high' : 'secondary'}
                                className={cn(
                                  "px-3 py-1 font-medium",
                                  !isOverBudget && !isNearLimit && "bg-green-500/10 text-green-600 hover:bg-green-500/20"
                                )}
                              >
                                {Math.round(progress)}%
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(progress, 100)}%` }}
                              transition={{ duration: 1, delay: index * 0.1, ease: 'easeOut' }}
                              className={cn(
                                "absolute inset-y-0 left-0 rounded-full",
                                isOverBudget 
                                  ? "bg-gradient-to-r from-red-500 to-red-600" 
                                  : isNearLimit 
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                    : "bg-gradient-to-r from-brand-orange to-brand-coral"
                              )}
                            >
                              {/* Shine effect */}
                              <motion.div
                                initial={{ x: '-100%' }}
                                animate={{ x: '200%' }}
                                transition={{ delay: index * 0.1 + 0.5, duration: 1, ease: 'easeOut' }}
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12"
                              />
                            </motion.div>
                          </div>
                        </motion.div>
                      )
                    })
                  )}
                </div>
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Hours Trend Chart */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Hours Trend</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Hours logged this week</p>
                </div>
                <Badge variant="outline" className="font-normal">
                  <Calendar className="h-3 w-3 mr-1" />
                  This Week
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <AreaChart data={HOURS_TREND} height={180} />
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column */}
        <motion.div
          variants={itemVariants}
          className="space-y-6"
        >
          {/* Smart Insights */}
          <SmartInsights />

          {/* Utilization Donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Overall Utilization</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <DonutChart 
                value={totalHoursUsed} 
                total={totalHoursAvailable} 
                size={160}
                strokeWidth={16}
                label="of hours used"
              />
              <div className="mt-6 w-full grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-brand-orange">
                    <AnimatedCounter value={Math.round(totalHoursUsed)} />h
                  </p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-brand-blue">
                    <AnimatedCounter value={Math.round(totalHoursAvailable - totalHoursUsed)} />h
                  </p>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Zap className="h-5 w-5 text-brand-orange" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl group">
                <Link to="/boards">
                  <span className="flex items-center">
                    <Kanban className="mr-3 h-5 w-5 text-brand-blue" />
                    View All Boards
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl group">
                <Link to="/boards?new=true">
                  <span className="flex items-center">
                    <Plus className="mr-3 h-5 w-5 text-green-500" />
                    Create New Board
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-between h-12 rounded-xl group"
                onClick={onConfetti}
              >
                <span className="flex items-center">
                  <Sparkles className="mr-3 h-5 w-5 text-brand-purple" />
                  Celebrate! 🎉
                </span>
                <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Button>
            </CardContent>
          </Card>

          {/* Weekly Goals */}
          <Card className="p-4">
            <WeeklyGoals compact />
          </Card>

          {/* Team Kudos */}
          <Card className="p-4">
            <KudosWidget compact />
          </Card>

          {/* Upcoming Celebrations */}
          <UpcomingCelebrations limit={3} />

          {/* Recent Tickets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">Recent Tickets</CardTitle>
              <Badge variant="outline" className="font-normal">
                {completedTickets}/{recentTickets.length} done
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTickets.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Award className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No tickets yet</p>
                  </div>
                ) : (
                  recentTickets.map((ticket, index) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Link
                        to={`/tickets/${ticket.id}`}
                        className="flex items-start gap-3 p-3 -mx-2 rounded-xl hover:bg-muted/50 transition-colors group"
                      >
                        <Badge 
                          variant={ticket.status} 
                          className="mt-0.5 text-[10px] uppercase tracking-wide"
                        >
                          {ticket.status === 'inprogress' ? 'WIP' : ticket.status}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-brand-orange transition-colors">
                            {ticket.title}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {ticket.ticket_id}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </motion.div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={() => fetchData(true)}
      />
    </motion.div>
  )
}
