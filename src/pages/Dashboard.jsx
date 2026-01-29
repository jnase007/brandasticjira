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
  Circle,
  Loader2,
  CheckCircle,
  ListTodo,
} from 'lucide-react'
import { supabase, getClients, getBoards, getClientHoursSummary, getTickets, ensureValidSession } from '../lib/supabase'
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
import { SafeComponent } from '../components/ErrorBoundary'

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
  const { user, profile, loading: authLoading } = useAuth()
  const [clients, setClients] = useState([])
  const [boards, setBoards] = useState([])
  const [hoursSummary, setHoursSummary] = useState([])
  const [recentTickets, setRecentTickets] = useState([])
  const [allTickets, setAllTickets] = useState([])
  const [myTasks, setMyTasks] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [runningTimer, setRunningTimer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [fetchError, setFetchError] = useState(null)
  const [viewMode, setViewMode] = useState('personal')
  const [myTimeStats, setMyTimeStats] = useState({ trackedMinutes: 0, targetHours: 160 })

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)
    
    try {
      console.log('[Dashboard] Starting data fetch...')
      
      // Validate session before fetching - this refreshes token if expiring
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[Dashboard] Session invalid, cannot fetch data')
        setFetchError('Session expired. Please refresh the page or log in again.')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      // Timeout for slower mobile networks (15 seconds)
      const FETCH_TIMEOUT = 15000
      
      // Fetch each independently to prevent one failure from blocking all
      const [clientsRes, boardsRes, hoursRes, ticketsRes] = await Promise.allSettled([
        Promise.race([
          getClients(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT))
        ]),
        Promise.race([
          getBoards(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT))
        ]),
        Promise.race([
          getClientHoursSummary(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT))
        ]).catch(() => ({ data: [], error: null })), // Gracefully handle if view doesn't exist
        Promise.race([
          getTickets(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FETCH_TIMEOUT))
        ]),
      ])

      // Extract data, defaulting to empty arrays on failure
      const clientsData = clientsRes.status === 'fulfilled' && clientsRes.value?.data ? clientsRes.value.data : []
      const boardsData = boardsRes.status === 'fulfilled' && boardsRes.value?.data ? boardsRes.value.data : []
      const hoursData = hoursRes.status === 'fulfilled' && hoursRes.value?.data ? hoursRes.value.data : []
      const ticketsData = ticketsRes.status === 'fulfilled' && ticketsRes.value?.data ? ticketsRes.value.data : []
      
      console.log('[Dashboard] Data received:', {
        clients: clientsData.length,
        boards: boardsData.length,
        hoursSummary: hoursData.length,
        tickets: ticketsData.length,
      })
      
      // Log hours summary for debugging company stats
      if (hoursData.length > 0) {
        const totalHours = hoursData.reduce((sum, c) => sum + (c.hours_used || 0), 0)
        const totalAvailable = hoursData.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)
        console.log('[Dashboard] Hours summary:', { totalHoursUsed: totalHours, totalHoursAvailable: totalAvailable })
      } else {
        console.log('[Dashboard] Hours summary is empty - company stats will be 0')
      }
      
      setClients(clientsData)
      setBoards(boardsData)
      setHoursSummary(hoursData)
      setAllTickets(ticketsData)
      
      // Filter to show only user's assigned tickets in "My Tasks"
      const userTickets = ticketsData.filter(t => t.assigned_to === profile?.id)
      console.log('[Dashboard] User tickets found:', userTickets.length, 'out of', ticketsData.length)
      console.log('[Dashboard] Profile ID:', profile?.id)
      if (userTickets.length === 0 && ticketsData.length > 0) {
        console.log('[Dashboard] Sample assigned_to values:', ticketsData.slice(0, 5).map(t => ({ title: t.title, assigned_to: t.assigned_to })))
      }
      setRecentTickets(userTickets.slice(0, 10))

      // Fetch personal activity and time stats if available
      if (profile?.id) {
        try {
          // Get clients this user is assigned to manage
          const { data: assignedClients } = await supabase
            .from('client_team_assignments')
            .select('client_id')
            .eq('user_id', profile.id)
          
          const assignedClientIds = (assignedClients || []).map(a => a.client_id)
          
          // Fetch activity: either by user OR from assigned clients
          let activityData = []
          if (assignedClientIds.length > 0) {
            // Get both user's own activity and activity from assigned clients
            const { data: userActivity } = await supabase
              .from('activity_log')
              .select('id, activity_type, entity_name, metadata, created_at, client_id, user_id')
              .eq('user_id', profile.id)
              .order('created_at', { ascending: false })
              .limit(10)
            
            const { data: clientActivity } = await supabase
              .from('activity_log')
              .select('id, activity_type, entity_name, metadata, created_at, client_id, user_id')
              .in('client_id', assignedClientIds)
              .neq('user_id', profile.id) // Exclude own activity (already fetched)
              .order('created_at', { ascending: false })
              .limit(10)
            
            // Merge and sort by date, take top 10
            activityData = [...(userActivity || []), ...(clientActivity || [])]
              .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
              .slice(0, 10)
          } else {
            // No assigned clients, just fetch user's own activity
            const { data } = await supabase
            .from('activity_log')
            .select('id, activity_type, entity_name, metadata, created_at')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false })
            .limit(5)
            activityData = data || []
          }
          
          setRecentActivity(activityData)
        } catch {
          setRecentActivity([])
        }

        // Fetch personal time entries for current month
        try {
          const now = new Date()
          const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
          const startOfNextMonth = now.getMonth() === 11
            ? `${now.getFullYear() + 1}-01-01`
            : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`

          console.log('[Dashboard] Fetching time for user:', profile.id, 'range:', startOfMonth, 'to', startOfNextMonth)

          const { data: timeData, error: timeError } = await supabase
            .from('time_entries')
            .select('minutes')
            .eq('user_id', profile.id)
            .gte('date', startOfMonth)
            .lt('date', startOfNextMonth)

          if (timeError) {
            console.error('[Dashboard] Time entries fetch error:', timeError)
          }

          const totalMinutes = (timeData || []).reduce((sum, entry) => sum + (entry.minutes || 0), 0)
          console.log('[Dashboard] Total minutes this month:', totalMinutes, 'entries:', timeData?.length || 0)
          
          setMyTimeStats({
            trackedMinutes: totalMinutes,
            targetHours: profile.target_hours_monthly || 160
          })
        } catch (err) {
          console.error('[Dashboard] Time entries exception:', err)
          setMyTimeStats({ trackedMinutes: 0, targetHours: profile.target_hours_monthly || 160 })
        }

        // Fetch my assigned tasks (To Do and In Progress)
        try {
          const { data: myTasksData } = await supabase
            .from('tickets')
            .select('id, title, ticket_id, status, priority, due_date, client_id, board_id')
            .eq('assigned_to', profile.id)
            .in('status', ['todo', 'inprogress'])
            .order('status', { ascending: false }) // inprogress first
            .order('priority', { ascending: false })
            .limit(10)
          
          // Enrich with client names
          const enrichedTasks = (myTasksData || []).map(task => {
            const client = clientsData.find(c => c.id === task.client_id)
            return { ...task, client_name: client?.name || 'Unknown Client', client_color: client?.color }
          })
          
          setMyTasks(enrichedTasks)
        } catch (err) {
          console.error('[Dashboard] My tasks fetch error:', err)
          setMyTasks([])
        }
      }
      
      // Only show error if ALL critical data failed
      if (clientsRes.status === 'rejected' && boardsRes.status === 'rejected') {
        setFetchError('Some data failed to load. Try refreshing.')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setFetchError(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
      setLastUpdated(new Date())
    }
  }

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      console.log('[Dashboard] Still waiting for auth...')
      return
    }
    
    // If no user after auth loaded, don't attempt fetch
    if (!user) {
      console.log('[Dashboard] No user after auth loaded - redirecting to login')
      setLoading(false)
      return
    }
    
    // Also wait for profile to be ready (critical for data fetching)
    if (!profile) {
      console.log('[Dashboard] User exists but waiting for profile...')
      // Don't return here - set a timeout to retry
      const profileTimeout = setTimeout(() => {
        if (!profile) {
          console.log('[Dashboard] Profile still not ready after timeout, fetching anyway...')
          fetchData()
        }
      }, 1000)
      return () => clearTimeout(profileTimeout)
    }
    
    console.log('[Dashboard] Auth ready, fetching data for:', user?.email || profile?.email)
    fetchData()
  }, [authLoading, user?.id, profile?.id])

  useEffect(() => {
    const updateRunningTimer = async () => {
      const saved = localStorage.getItem('activeTimer')
      if (!saved) {
        setRunningTimer(null)
        return
      }
      try {
        const parsed = JSON.parse(saved)
        if (!parsed?.startTime) {
          setRunningTimer(null)
          return
        }
        let clientName = parsed.clientName
        if (!clientName && parsed.clientId) {
          const { data } = await supabase
            .from('clients')
            .select('id, name')
            .eq('id', parsed.clientId)
            .maybeSingle()
          clientName = data?.name
        }
        setRunningTimer({
          ...parsed,
          clientName,
          elapsedSeconds: Math.floor((Date.now() - new Date(parsed.startTime).getTime()) / 1000),
        })
      } catch {
        setRunningTimer(null)
      }
    }

    updateRunningTimer()
    const interval = setInterval(updateRunningTimer, 10000)
    return () => clearInterval(interval)
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
  const myTickets = allTickets.filter((t) => t.assigned_to === profile?.id)
  const myActiveTickets = myTickets.filter((t) => t.status !== 'done')
  const myClients = myTickets.reduce((acc, ticket) => {
    const client = ticket.client
    if (client && !acc.find((item) => item.id === client.id)) acc.push(client)
    return acc
  }, [])

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

  // Show error state with retry button
  if (fetchError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <Zap className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connection Issue</h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            {fetchError}
          </p>
          <div className="flex gap-3">
            <Button onClick={() => fetchData()} variant="default">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => window.location.reload()} variant="outline">
              Reload Page
            </Button>
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
      <SafeComponent>
        <CelebrationBanner />
      </SafeComponent>

      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="mb-10"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-full border bg-muted p-1">
              <Button
                variant={viewMode === 'personal' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('personal')}
              >
                My Dashboard
              </Button>
              <Button
                variant={viewMode === 'company' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('company')}
              >
                Company Overview
              </Button>
            </div>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="gap-2"
              title={lastUpdated ? `Last updated: ${lastUpdated.toLocaleString()}` : 'Refresh data'}
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {runningTimer && (
        <motion.div variants={itemVariants} className="mb-6">
          <Card className="border-brand-orange/30 bg-brand-orange/5">
            <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-brand-orange">Timer running</p>
                <p className="text-sm text-muted-foreground">
                  Tracking{' '}
                  <span className="font-medium">
                    {runningTimer.description || runningTimer.clientName || 'a task'}
                  </span>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (window.openTimerWithClient && runningTimer.clientId) {
                    window.openTimerWithClient({ id: runningTimer.clientId, name: runningTimer.clientName })
                  }
                }}
              >
                Open Timer
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {viewMode === 'company' && (
        <>
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
                    {totalClients}
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
                  <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-blue transition-colors">
                    {allTickets.filter(t => t.status === 'done').length}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                    <CheckCircle className="h-3 w-3" />
                    <span>by the team</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                    <Target className="h-7 w-7 text-brand-blue" />
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
                  <p className="text-sm font-medium text-muted-foreground">Company Hours</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-purple transition-colors">
                    {Math.round(totalHoursUsed)}
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
                  <p className="text-sm font-medium text-muted-foreground">Open Tasks</p>
                  <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-teal transition-colors">
                    {allTickets.filter(t => t.status !== 'done').length}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-xs text-brand-orange">
                    <Target className="h-3 w-3" />
                    <span>{allTickets.filter(t => t.status === 'inprogress').length} in progress</span>
                  </div>
                </div>
                <div className="relative">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-teal/20 to-teal-500/10 group-hover:scale-110 transition-transform duration-300">
                    <ListTodo className="h-7 w-7 text-brand-teal" />
                  </div>
                </div>
              </div>
            </CardContent>
            <div className="absolute inset-0 bg-gradient-to-r from-brand-teal/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </Card>
        </motion.div>
          </motion.div>

          {/* My Tasks Section */}
          {myTasks.length > 0 && (
            <motion.div variants={itemVariants} className="mb-6">
              <Card className="overflow-hidden border-l-4 border-l-brand-orange">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-brand-orange" />
                      <CardTitle className="text-lg">My Tasks</CardTitle>
                      <Badge variant="outline" className="ml-2">
                        {myTasks.filter(t => t.status === 'inprogress').length} in progress
                      </Badge>
                    </div>
                    <Link to="/boards">
                      <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                        View All
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {myTasks.map((task) => (
                      <Link
                        key={task.id}
                        to={task.board_id ? `/boards/${task.board_id}` : '#'}
                        className={cn(
                          "flex items-center gap-3 px-6 py-4 transition-all hover:bg-muted/50 group",
                          task.status === 'inprogress' && "bg-blue-50/30 dark:bg-blue-900/10"
                        )}
                      >
                        {/* Client Logo */}
                        {task.client_logo ? (
                          <img 
                            src={task.client_logo} 
                            alt={task.client_name} 
                            className="w-10 h-10 rounded-lg object-cover border flex-shrink-0"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: task.client_color || '#F7931E' }}
                          >
                            {task.client_name?.charAt(0) || '?'}
                          </div>
                        )}
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate group-hover:text-brand-orange transition-colors">{task.title}</p>
                            {task.priority === 'high' || task.priority === 'urgent' ? (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{task.priority}</Badge>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span className="truncate">{task.client_name}</span>
                            {task.due_date && (
                              <>
                                <span>•</span>
                                <span className={new Date(task.due_date) < new Date() ? 'text-red-500 font-medium' : ''}>
                                  Due {formatRelativeDate(new Date(task.due_date))}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Status Badge */}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs flex-shrink-0",
                            task.status === 'inprogress' && "text-blue-600 border-blue-300"
                          )}
                        >
                          {task.status === 'inprogress' ? 'In Progress' : 'To Do'}
                        </Badge>
                        
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Hours - Left Column */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 space-y-6"
        >
          {/* Client Hours Card */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Client Hours</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">Monthly hour allocation by client</p>
              </div>
                <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search clients... (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl bg-muted/50 border-0 focus:bg-background focus:ring-2 focus:ring-brand-orange/20"
                />
                </div>
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
                        <Link
                          key={client.client_id}
                          to={`/clients/${clients.find((c) => c.id === client.client_id)?.slug || client.client_id}`}
                        >
                        <motion.div
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
                        </Link>
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
          <SafeComponent>
            <SmartInsights />
          </SafeComponent>

          {/* Days Left in Month */}
          <Card className="bg-gradient-to-br from-brand-purple/10 to-purple-500/5 border-brand-purple/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5 text-brand-purple" />
                Days Left This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const now = new Date()
                const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
                const daysLeft = lastDay.getDate() - now.getDate()
                const totalDays = lastDay.getDate()
                const percentLeft = Math.round((daysLeft / totalDays) * 100)
                const monthName = now.toLocaleString('default', { month: 'long' })
                
                return (
                  <div className="text-center py-4">
                    <div className="text-5xl font-display font-bold text-brand-purple mb-1">
                      <AnimatedCounter value={daysLeft} />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      days left in {monthName}
                    </p>
                    <div className="w-full bg-muted rounded-full h-2 mb-2">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-purple to-purple-400 rounded-full transition-all"
                        style={{ width: `${100 - percentLeft}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {now.getDate()} of {totalDays} days used
                    </p>
                  </div>
                )
              })()}
            </CardContent>
          </Card>

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
                    {Math.round(totalHoursUsed)}h
                  </p>
                  <p className="text-xs text-muted-foreground">Used</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-muted/50">
                  <p className="text-2xl font-bold text-brand-blue">
                    {Math.round(totalHoursAvailable - totalHoursUsed)}h
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
                <Link to="/time">
                  <span className="flex items-center">
                    <Clock className="mr-3 h-5 w-5 text-brand-blue" />
                    Time Tracking
                  </span>
                  <ChevronRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-between h-12 rounded-xl group">
                <Link to="/clients">
                  <span className="flex items-center">
                    <Building2 className="mr-3 h-5 w-5 text-green-500" />
                    View Clients
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
          <SafeComponent>
            <Card className="p-4">
              <WeeklyGoals compact />
            </Card>
          </SafeComponent>

          {/* Team Kudos */}
          <SafeComponent>
            <Card className="p-4">
              <KudosWidget compact />
            </Card>
          </SafeComponent>

          {/* Upcoming Celebrations */}
          <SafeComponent>
            <UpcomingCelebrations limit={3} />
          </SafeComponent>

          {/* My Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl">My Tasks</CardTitle>
              <Badge variant="outline" className="font-normal">
                {completedTickets}/{recentTickets.length} done
              </Badge>
            </CardHeader>
            <CardContent className="p-0">
              {recentTickets.length === 0 ? (
                <div className="text-center py-8 px-6">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                    <Award className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No tasks yet</p>
                </div>
              ) : (
                <div className="divide-y">
                  {recentTickets.map((ticket, index) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Link
                        to={`/clients/${ticket.client?.slug || ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
                        className="flex items-center gap-3 px-6 py-4 hover:bg-muted/50 transition-colors group"
                      >
                        {/* Client Logo */}
                        {ticket.client?.logo_url ? (
                          <img 
                            src={ticket.client.logo_url} 
                            alt={ticket.client.name} 
                            className="w-10 h-10 rounded-lg object-cover border flex-shrink-0"
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                            style={{ backgroundColor: ticket.client?.color || '#F7931E' }}
                          >
                            {ticket.client?.name?.charAt(0) || '?'}
                          </div>
                        )}
                        
                        {/* Task Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium truncate group-hover:text-brand-orange transition-colors">
                              {ticket.title}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono text-blue-600 dark:text-blue-400">{ticket.ticket_id}</span>
                            <span>•</span>
                            <span className="truncate">{ticket.client?.name || 'Unknown Client'}</span>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <Badge 
                          variant={ticket.status} 
                          className="text-[10px] uppercase tracking-wide flex-shrink-0"
                        >
                          {ticket.status?.replace('_', ' ') || 'new'}
                        </Badge>
                        
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
          </div>
        </>
      )}

      {viewMode === 'personal' && (
        <div className="space-y-6">
          {/* Personal Stats */}
          <motion.div
            variants={containerVariants}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {/* Time Tracked This Month */}
            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">My Hours</p>
                      <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-purple transition-colors">
                        {Math.round(myTimeStats.trackedMinutes / 60)}
                        <span className="text-base text-muted-foreground font-normal">/{myTimeStats.targetHours}h</span>
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{Math.round((myTimeStats.trackedMinutes / 60 / myTimeStats.targetHours) * 100)}% • {Math.max(0, Math.round(myTimeStats.targetHours - myTimeStats.trackedMinutes / 60))}h left</span>
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
                  <p className="text-sm font-medium text-muted-foreground">My Active Tasks</p>
                      <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-blue transition-colors">
                        {myActiveTickets.length}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Target className="h-3 w-3" />
                        <span>{myTickets.filter(t => t.status === 'inprogress').length} in progress</span>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                        <Target className="h-7 w-7 text-brand-blue" />
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
                  <p className="text-sm font-medium text-muted-foreground">My Clients</p>
                      <p className="text-4xl font-display font-bold mt-2 group-hover:text-brand-orange transition-colors">
                        {myClients.length}
                      </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        <span>Assigned to me</span>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                        <Building2 className="h-7 w-7 text-brand-orange" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 bg-gradient-to-r from-brand-orange/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </Card>
            </motion.div>
            <motion.div variants={itemVariants}>
              <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                  <p className="text-sm font-medium text-muted-foreground">Completed Tasks</p>
                      <p className="text-4xl font-display font-bold mt-2 group-hover:text-green-500 transition-colors">
                    {myTickets.filter((t) => t.status === 'done').length}
                  </p>
                      <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                        <Award className="h-3 w-3" />
                        <span>Great work!</span>
                      </div>
                    </div>
                    <div className="relative">
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                        <Award className="h-7 w-7 text-green-500" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              </Card>
            </motion.div>
          </motion.div>

          {/* Personal Content */}
          <div className="grid gap-6 lg:grid-cols-3">
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-xl">My Tasks</CardTitle>
                  <Badge variant="outline" className="font-normal">
                    {myTickets.filter(t => t.status === 'done').length}/{myTickets.length} done
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {myTickets.length === 0 ? (
                    <div className="text-center py-8 px-6">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <Award className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No tasks assigned yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {myTickets.slice(0, 6).map((ticket, index) => (
                        <motion.div
                          key={ticket.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <Link
                            to={`/clients/${ticket.client?.slug || ticket.client_id}/tickets/${ticket.ticket_id || ticket.id}`}
                            className="flex items-center gap-3 px-6 py-4 hover:bg-muted/50 transition-colors group"
                          >
                            {/* Client Logo */}
                            {ticket.client?.logo_url ? (
                              <img 
                                src={ticket.client.logo_url} 
                                alt={ticket.client.name} 
                                className="w-10 h-10 rounded-lg object-cover border flex-shrink-0"
                              />
                            ) : (
                              <div 
                                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                                style={{ backgroundColor: ticket.client?.color || '#F7931E' }}
                              >
                                {ticket.client?.name?.charAt(0) || '?'}
                              </div>
                            )}
                            
                            {/* Task Info */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate group-hover:text-brand-orange transition-colors">
                                {ticket.title}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="font-mono text-blue-600 dark:text-blue-400">{ticket.ticket_id}</span>
                                <span>•</span>
                                <span className="truncate">{ticket.client?.name || 'Unknown Client'}</span>
                              </div>
                            </div>
                            
                            {/* Status Badge */}
                            <Badge 
                              variant={ticket.status} 
                              className="text-[10px] uppercase tracking-wide flex-shrink-0"
                            >
                              {ticket.status?.replace('_', ' ') || 'new'}
                            </Badge>
                            
                            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </Link>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">My Clients</CardTitle>
                </CardHeader>
                <CardContent>
                  {myClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No clients assigned yet.</p>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {myClients.slice(0, 6).map((client) => (
                        <Link
                          key={client.id}
                          to={`/clients/${client.slug || client.id}`}
                          className="flex items-center gap-3 p-3 rounded-xl border hover:shadow-md hover:border-brand-orange/30 transition-all group"
                        >
                          {client.logo_url ? (
                            <img 
                              src={client.logo_url} 
                              alt={client.name} 
                              className="h-10 w-10 rounded-xl object-cover border"
                            />
                          ) : (
                            <div
                              className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                              style={{ backgroundColor: client.color || '#F7931E' }}
                            >
                              {client.name?.charAt(0)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium truncate group-hover:text-brand-orange transition-colors">{client.name}</p>
                              {client.ticket_prefix && (
                                <Badge variant="outline" className="text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0 font-mono flex-shrink-0">
                                  {client.ticket_prefix}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">Assigned client</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-orange transition-colors" />
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Latest Updates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recent updates yet.</p>
                  ) : (
                    recentActivity.map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className="h-2 w-2 rounded-full bg-brand-orange mt-2" />
                        <div>
                          <p className="text-sm">
                            {activity.activity_type.replace('_', ' ')}{' '}
                            <span className="font-medium text-brand-orange">
                              {activity.entity_name || activity.metadata?.ticket_id || 'item'}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDate(new Date(activity.created_at))}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      )}

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={() => fetchData(true)}
      />
    </motion.div>
  )
}
