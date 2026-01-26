import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Building2, Clock, Kanban, CheckCircle2, ArrowLeft, Loader2, RefreshCw,
  Play, Target, Timer, Sparkles, Star, Activity
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { cn, formatRelativeDate } from '../lib/utils'
import { supabase } from '../lib/supabase'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } }
}

// Greeting based on time
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' }
  if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' }
  return { text: 'Good evening', emoji: '🌙' }
}

// Stat Card Component
function StatCard({ icon: Icon, iconBg, iconColor, label, value, suffix, subtext }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="relative overflow-hidden group border-0 shadow-lg shadow-black/5 hover:shadow-xl transition-shadow">
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
              <span className="text-3xl font-bold tracking-tight">{value}</span>
              {suffix && <span className="text-muted-foreground text-sm">{suffix}</span>}
            </div>
            {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}

export default function ClientPublic() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)

  const fetchPublicData = async (isRefresh = false) => {
      if (!token) return
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
      setError(null)
    
      try {
      // First try the Netlify function (uses service role key for full access)
      console.log('[ClientPublic] Trying Netlify function with token:', token)
        const res = await fetch(`/.netlify/functions/client-public?token=${encodeURIComponent(token)}`)
      
      if (res.ok) {
        const data = await res.json()
        if (data.client) {
          console.log('[ClientPublic] Netlify function succeeded:', data.client.name)
        setPayload(data)
          return
        }
      } else {
        console.log('[ClientPublic] Netlify function returned:', res.status)
      }
      
      // If Netlify function fails, try direct Supabase fetch
      console.log('[ClientPublic] Netlify function failed, trying direct Supabase fetch...')
      
      // First try by public_token
      let { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
        .eq('public_token', token)
        .maybeSingle()
      
      // If not found by token, try by ID (fallback for older links or direct ID sharing)
      if (!client && !clientError) {
        console.log('[ClientPublic] Not found by token, trying by ID...')
        const { data: clientById, error: idError } = await supabase
          .from('clients')
          .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
          .eq('id', token)
          .maybeSingle()
        
        if (clientById && clientById.public_enabled) {
          client = clientById
        } else if (idError) {
          console.error('[ClientPublic] ID fetch error:', idError)
        }
      }
      
      if (clientError) {
        console.error('[ClientPublic] Client fetch error:', clientError)
        throw new Error('Unable to load client data. Please ensure the public access SQL has been run.')
      }
      
      if (!client) {
        throw new Error('Client not found. The link may be invalid or the public access policies may need to be configured.')
      }
      
      // Check if public access is enabled
      if (client.public_enabled === false) {
        throw new Error('Public access is disabled for this client')
      }
      
      console.log('[ClientPublic] Found client:', client.name)
      
      // Fetch related data
      const fetchProjects = async () => {
        try {
          return await supabase
            .from('client_projects')
            .select('id, title')
            .eq('client_id', client.id)
            .eq('is_visible_to_client', true)
            .order('completed_date', { ascending: false })
        } catch {
          return { data: [] }
        }
      }
      
      const fetchActivity = async () => {
        try {
          return await supabase
            .from('activity_log')
            .select('id, entity_name, created_at')
            .eq('client_id', client.id)
            .order('created_at', { ascending: false })
            .limit(5)
        } catch {
          return { data: [] }
        }
      }
      
      const [boardsRes, ticketsRes, projectsRes, activityRes] = await Promise.all([
        supabase
          .from('boards')
          .select('id, name, description, created_at')
          .eq('client_id', client.id)
          .eq('is_archived', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('tickets')
          .select('id, title, ticket_id, status, priority, board_id, created_at')
          .eq('client_id', client.id)
          .order('updated_at', { ascending: false })
          .limit(100),
        fetchProjects(),
        fetchActivity(),
      ])
      
      // Try to get hours summary
      let hoursSummary = null
      try {
        const now = new Date()
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
        const startOfNextMonth = now.getMonth() === 11
          ? `${now.getFullYear() + 1}-01-01`
          : `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, '0')}-01`
        
        const { data: timeData } = await supabase
          .from('time_entries')
          .select('minutes')
          .eq('client_id', client.id)
          .gte('date', startOfMonth)
          .lt('date', startOfNextMonth)
        
        const totalMinutes = (timeData || []).reduce((sum, e) => sum + (e.minutes || 0), 0)
        hoursSummary = {
          hours_used: Math.round(totalMinutes / 60 * 10) / 10,
          monthly_hours: client.monthly_hours || 0,
        }
      } catch (e) {
        console.warn('[ClientPublic] Could not calculate hours:', e)
      }
      
      setPayload({
        client,
        boards: boardsRes?.data || [],
        tickets: ticketsRes?.data || [],
        projects: projectsRes?.data || [],
        recent_updates: activityRes?.data || [],
        hours_summary: hoursSummary,
      })
      
      } catch (err) {
      console.error('[ClientPublic] Error:', err)
        setError(err.message || 'Unable to load client view')
      } finally {
        setLoading(false)
      setRefreshing(false)
      }
    }

  useEffect(() => {
    fetchPublicData()
  }, [token])

  const client = payload?.client
  const boards = payload?.boards || []
  const tickets = payload?.tickets || []
  const projects = payload?.projects || []

  const todoCount = tickets.filter((t) => t.status === 'todo').length
  const inProgressCount = tickets.filter((t) => t.status === 'inprogress').length
  const doneCount = tickets.filter((t) => t.status === 'done').length
  const hoursUsed = payload?.hours_summary?.hours_used || 0
  const monthlyHours = payload?.hours_summary?.monthly_hours || client?.monthly_hours || 0
  const hoursProgress = monthlyHours > 0 ? (hoursUsed / monthlyHours) * 100 : 0

  const greeting = getGreeting()

  const tasksByBoard = useMemo(() => {
    const map = new Map()
    tickets.forEach((ticket) => {
      const board = boards.find((b) => b.id === ticket.board_id)
      const boardName = board?.name || 'General Tasks'
      if (!map.has(boardName)) map.set(boardName, [])
      map.get(boardName).push(ticket)
    })
    return Array.from(map.entries())
  }, [tickets, boards])

  // Format date range
  const formatDateRange = () => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const options = { month: 'short', day: 'numeric', year: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-center py-20">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand-orange mx-auto mb-4" />
            <p className="text-muted-foreground">Loading client dashboard...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50/50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="border-0 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-brand-orange" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Client view unavailable</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                {error || 'Unable to load client data'}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => fetchPublicData()} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button asChild className="bg-brand-orange hover:bg-brand-orange/90 gap-2">
                  <Link to="/login">Return to Login</Link>
                </Button>
              </div>
              
              {/* Admin hint */}
              <div className="mt-8 p-4 bg-muted/50 rounded-lg text-left text-sm">
                <p className="font-medium mb-2">Admin troubleshooting:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>Ensure the client has "Public Sharing" enabled</li>
                  <li>Run the <code className="bg-muted px-1 rounded">public-client-access.sql</code> script in Supabase</li>
                  <li>Check Netlify has <code className="bg-muted px-1 rounded">SUPABASE_SERVICE_ROLE_KEY</code> set</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

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
                    Your project dashboard
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={() => fetchPublicData(true)}
                  disabled={refreshing}
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                  Refresh
                </Button>
                <Link 
                  to="/login"
                  className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Team login
                </Link>
              </div>
            </div>
                      </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={containerVariants} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            icon={Clock}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
            label="Hours Used"
            value={Math.round(hoursUsed)}
            suffix={`/ ${monthlyHours}h`}
            subtext={`${Math.round(monthlyHours - hoursUsed)}h remaining`}
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
                    <p className="text-sm text-muted-foreground">{formatDateRange()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{hoursProgress.toFixed(0)}%</p>
                  <p className="text-xs text-muted-foreground">utilized</p>
                </div>
              </div>
              <div className="relative">
                <Progress value={hoursProgress} className="h-3 bg-slate-100 dark:bg-slate-800" />
                <div 
                  className="absolute top-0 h-3 rounded-full bg-gradient-to-r from-brand-blue via-brand-orange to-brand-coral transition-all duration-500"
                  style={{ width: `${Math.min(hoursProgress, 100)}%` }}
                />
            </div>
          </CardContent>
        </Card>
        </motion.div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Boards & Tasks - Left Column */}
          <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4">
            <Card className="border-0 shadow-lg shadow-black/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-brand-orange" />
                <CardTitle className="text-lg">Boards & Tasks</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksByBoard.length === 0 ? (
                  <div className="text-center py-8">
                    <Kanban className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No tasks available yet.</p>
                  </div>
                ) : (
                  tasksByBoard.map(([boardName, boardTickets]) => (
                    <div key={boardName} className="rounded-2xl border bg-muted/30 p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Kanban className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <p className="font-semibold">{boardName}</p>
                        </div>
                        <Badge className="bg-brand-orange/10 text-brand-orange border-brand-orange/20">
                          {boardTickets.length} tasks
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {boardTickets.slice(0, 6).map((ticket) => (
                          <div key={ticket.id} className="flex items-center justify-between text-sm bg-white dark:bg-slate-900 rounded-lg px-3 py-2">
                            <span className="truncate font-medium">{ticket.title}</span>
                            <Badge 
                              variant="secondary"
                              className={cn(
                                "text-xs",
                                ticket.status === 'done' && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
                                ticket.status === 'inprogress' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                                ticket.status === 'todo' && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                              )}
                            >
                              {ticket.status === 'inprogress' ? 'In Progress' : ticket.status === 'done' ? 'Done' : 'To Do'}
                            </Badge>
                          </div>
                        ))}
                        {boardTickets.length > 6 && (
                          <p className="text-xs text-center text-muted-foreground pt-2">
                            +{boardTickets.length - 6} more tasks
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Right Column */}
          <motion.div variants={itemVariants} className="space-y-4">
            {/* Recent Updates */}
            <Card className="border-0 shadow-lg shadow-black/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-brand-blue" />
                <CardTitle className="text-lg">Recent Updates</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {(payload?.recent_updates || []).length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                  </div>
                ) : (
                  payload.recent_updates.map((update) => (
                    <div key={update.id} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="p-1.5 rounded-lg bg-brand-orange/10">
                        <CheckCircle2 className="h-4 w-4 text-brand-orange" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{update.entity_name || 'Update'}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(new Date(update.created_at))}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Portfolio */}
            <Card className="border-0 shadow-lg shadow-black/5">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-lg">Portfolio</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {projects.length === 0 ? (
                  <div className="text-center py-6">
                    <Star className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No portfolio items yet.</p>
                  </div>
                ) : (
                  projects.slice(0, 4).map((project) => (
                    <div key={project.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                      <div className="p-1.5 rounded-lg bg-amber-500/10">
                        <Star className="h-4 w-4 text-amber-500" />
                      </div>
                      <span className="font-medium text-sm truncate">{project.title}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div variants={itemVariants} className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Powered by Brandastic • This is a read-only view of your project dashboard
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
