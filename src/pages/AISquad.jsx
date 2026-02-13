import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Bot, Users, Target, TrendingUp, Clock, DollarSign, 
  BarChart3, CheckCircle, Calendar, Briefcase, ArrowUpRight,
  Zap, Activity, Eye, RefreshCw, Filter, ChevronDown
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, getInitials, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
}

export default function AISquad() {
  const { profile, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [aiAgents, setAiAgents] = useState([])
  const [timeRange, setTimeRange] = useState('month') // week, month, quarter, year
  const [stats, setStats] = useState({
    totalAgents: 0,
    totalHours: 0,
    totalRevenue: 0,
    totalTickets: 0,
    avgHourlyRate: 0,
  })

  // Fetch AI squad data with real metrics
  const fetchAISquadData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Calculate date range
      const now = new Date()
      let startDate = new Date()
      switch (timeRange) {
        case 'week':
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'quarter':
          startDate.setMonth(now.getMonth() - 3)
          break
        case 'year':
          startDate.setFullYear(now.getFullYear() - 1)
          break
      }
      const startDateStr = startDate.toISOString().split('T')[0]

      // Fetch AI agents from profiles
      const { data: agents, error: agentsError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, email, title, role, cost_rate, is_ai')
        .eq('is_ai', true)
        .order('full_name')

      if (agentsError) {
        console.error('Error fetching AI agents:', agentsError)
        setAiAgents([])
        return
      }

      if (!agents?.length) {
        setAiAgents([])
        setStats({ totalAgents: 0, totalHours: 0, totalRevenue: 0, totalTickets: 0, avgHourlyRate: 0 })
        setLoading(false)
        setRefreshing(false)
        return
      }

      const agentIds = agents.map(a => a.id)

      // Fetch time entries for AI agents
      const { data: timeEntries } = await supabase
        .from('time_entries')
        .select('user_id, minutes, client_id, created_at')
        .in('user_id', agentIds)
        .gte('created_at', startDateStr)

      // Fetch tickets completed by AI agents
      const { data: tickets } = await supabase
        .from('tickets')
        .select('assigned_to, status, updated_at')
        .in('assigned_to', agentIds)
        .eq('status', 'done')
        .gte('updated_at', startDateStr)

      // Fetch clients for context
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name, color')

      const clientMap = (clients || []).reduce((acc, c) => {
        acc[c.id] = c
        return acc
      }, {})

      // Process data for each agent
      const enrichedAgents = agents.map(agent => {
        const agentTimeEntries = (timeEntries || []).filter(te => te.user_id === agent.id)
        const agentTickets = (tickets || []).filter(t => t.assigned_to === agent.id)
        
        const totalMinutes = agentTimeEntries.reduce((sum, te) => sum + (te.minutes || 0), 0)
        const totalHours = totalMinutes / 60
        const hourlyRate = agent.cost_rate || 75 // Default $75/hr if not set
        const revenueContribution = totalHours * hourlyRate

        // Get unique clients worked on
        const clientIds = [...new Set(agentTimeEntries.map(te => te.client_id).filter(Boolean))]
        const clientsWorkedOn = clientIds.map(id => clientMap[id]).filter(Boolean)

        // Calculate daily average
        const daysInRange = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24))
        const avgHoursPerDay = totalHours / daysInRange

        return {
          ...agent,
          totalHours,
          totalMinutes,
          hourlyRate,
          revenueContribution,
          ticketsCompleted: agentTickets.length,
          clientsWorkedOn,
          avgHoursPerDay,
          timeEntries: agentTimeEntries,
        }
      })

      // Sort by revenue contribution
      enrichedAgents.sort((a, b) => b.revenueContribution - a.revenueContribution)

      // Calculate totals
      const totalHours = enrichedAgents.reduce((sum, a) => sum + a.totalHours, 0)
      const totalRevenue = enrichedAgents.reduce((sum, a) => sum + a.revenueContribution, 0)
      const totalTickets = enrichedAgents.reduce((sum, a) => sum + a.ticketsCompleted, 0)
      const avgRate = enrichedAgents.length > 0 
        ? enrichedAgents.reduce((sum, a) => sum + a.hourlyRate, 0) / enrichedAgents.length 
        : 0

      setAiAgents(enrichedAgents)
      setStats({
        totalAgents: enrichedAgents.length,
        totalHours,
        totalRevenue,
        totalTickets,
        avgHourlyRate: avgRate,
      })
    } catch (err) {
      console.error('Error fetching AI squad data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [timeRange])

  useEffect(() => {
    fetchAISquadData()
  }, [fetchAISquadData])

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatHours = (hours) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    return `${hours.toFixed(1)}h`
  }

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case 'week': return 'This Week'
      case 'month': return 'This Month'
      case 'quarter': return 'This Quarter'
      case 'year': return 'This Year'
      default: return 'This Month'
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <Bot className="h-6 w-6 text-purple-500" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold">AI Squad</h1>
            <p className="text-sm text-muted-foreground">
              {stats.totalAgents} AI agents contributing to the team
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => fetchAISquadData(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">AI Agents</p>
                  <p className="text-2xl font-bold">{stats.totalAgents}</p>
                </div>
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Bot className="h-5 w-5 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Hours Logged</p>
                  <p className="text-2xl font-bold">{formatHours(stats.totalHours)}</p>
                </div>
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Revenue Value</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="p-2 rounded-lg bg-green-500/10">
                  <DollarSign className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks Completed</p>
                  <p className="text-2xl font-bold">{stats.totalTickets}</p>
                </div>
                <div className="p-2 rounded-lg bg-brand-orange/10">
                  <CheckCircle className="h-5 w-5 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* AI Agents Grid */}
      {aiAgents.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No AI Agents Found</h3>
            <p className="text-muted-foreground mb-4">
              Mark team members as "AI Agent" in the Admin panel to see them here.
            </p>
            {isAdmin && (
              <Button asChild>
                <Link to="/admin">Go to Admin Panel</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {aiAgents.map((agent, index) => {
            const progressPercent = stats.totalRevenue > 0 
              ? (agent.revenueContribution / stats.totalRevenue) * 100 
              : 0

            return (
              <motion.div key={agent.id} variants={itemVariants}>
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <Link to={`/team/${agent.id}`}>
                        <Avatar className="h-12 w-12 border-2 border-purple-500/20">
                          <AvatarImage src={agent.avatar_url} referrerPolicy="no-referrer" />
                          <AvatarFallback className="bg-purple-500/10 text-purple-600">
                            {getInitials(agent.full_name)}
                          </AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link 
                            to={`/team/${agent.id}`}
                            className="font-semibold hover:text-brand-orange transition-colors truncate"
                          >
                            {agent.full_name}
                          </Link>
                          <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30 text-xs">
                            <Bot className="h-3 w-3 mr-0.5" />
                            AI
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {agent.title || 'AI Agent'}
                        </p>
                      </div>
                      {index < 3 && (
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          index === 0 && "border-yellow-500 text-yellow-600",
                          index === 1 && "border-gray-400 text-gray-500",
                          index === 2 && "border-amber-600 text-amber-700"
                        )}>
                          #{index + 1}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold">{formatHours(agent.totalHours)}</p>
                        <p className="text-xs text-muted-foreground">Hours</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold text-green-600">{formatCurrency(agent.revenueContribution)}</p>
                        <p className="text-xs text-muted-foreground">Value</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold">{agent.ticketsCompleted}</p>
                        <p className="text-xs text-muted-foreground">Tasks</p>
                      </div>
                    </div>

                    {/* Rate & Average */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-medium">${agent.hourlyRate}/hr</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Avg per day</span>
                      <span className="font-medium">{formatHours(agent.avgHoursPerDay)}</span>
                    </div>

                    {/* Contribution Bar */}
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Team Contribution</span>
                        <span className="font-medium">{progressPercent.toFixed(1)}%</span>
                      </div>
                      <Progress value={progressPercent} className="h-2" />
                    </div>

                    {/* Clients Worked On */}
                    {agent.clientsWorkedOn.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Clients ({agent.clientsWorkedOn.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {agent.clientsWorkedOn.slice(0, 4).map(client => (
                            <Badge 
                              key={client.id} 
                              variant="outline" 
                              className="text-xs"
                              style={{ borderColor: client.color, color: client.color }}
                            >
                              {client.name}
                            </Badge>
                          ))}
                          {agent.clientsWorkedOn.length > 4 && (
                            <Badge variant="outline" className="text-xs">
                              +{agent.clientsWorkedOn.length - 4}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* View Profile Link */}
                    <Button asChild variant="ghost" size="sm" className="w-full mt-2">
                      <Link to={`/team/${agent.id}`}>
                        View Full Profile
                        <ArrowUpRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {/* About Section */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Bot className="h-6 w-6 text-purple-500" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">About AI Squad</h3>
              <p className="text-sm text-muted-foreground">
                AI Squad members are automated agents that contribute to the team by handling tasks, 
                logging time, and generating revenue value. Their contributions are calculated based on 
                their hourly rate and time logged against client projects. Mark team members as "AI Agent" 
                in the <Link to="/admin" className="text-brand-orange hover:underline">Admin Panel</Link> to 
                track their contributions here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
