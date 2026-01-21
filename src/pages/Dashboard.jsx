import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  Clock,
  Kanban,
  TrendingUp,
  ArrowUpRight,
  Plus,
  Search,
} from 'lucide-react'
import { getClients, getBoards, getClientHoursSummary, getTickets } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDuration, calculateProgress, getProgressColor } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Badge } from '../components/ui/badge'
import { Skeleton, SkeletonStats } from '../components/ui/skeleton'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Dashboard() {
  const { profile } = useAuth()
  const [clients, setClients] = useState([])
  const [boards, setBoards] = useState([])
  const [hoursSummary, setHoursSummary] = useState([])
  const [recentTickets, setRecentTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
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
      }
    }

    fetchData()
  }, [])

  // Calculate totals
  const totalClients = clients.length
  const totalBoards = boards.length
  const totalHoursUsed = hoursSummary.reduce((sum, c) => sum + (c.hours_used || 0), 0)
  const totalHoursAvailable = hoursSummary.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)

  // Filter clients by search
  const filteredHoursSummary = hoursSummary.filter((client) =>
    client.client_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto animate-fade-in-up">
        {/* Header Skeleton */}
        <div className="mb-8">
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-80" />
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
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-9 w-64 rounded-lg" />
              </div>
              <div className="space-y-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border animate-fade-in-up" style={{ animationDelay: `${(i + 4) * 100}ms` }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-3 w-3 rounded-full" />
                        <Skeleton className="h-5 w-32" />
                      </div>
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-2 w-full rounded-full" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <div className="space-y-6">
            <Card className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </Card>
            <Card className="p-6">
              <Skeleton className="h-6 w-32 mb-4" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display font-bold mb-2">
          Welcome back, {profile?.full_name?.split(' ')[0] || 'there'}!
        </h1>
        <p className="text-muted-foreground">
          Here's what's happening across your clients this month.
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="card-hover group cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                  <p className="text-3xl font-display font-bold mt-1 group-hover:text-brand-orange transition-colors">{totalClients}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-orange/10 group-hover:bg-brand-orange/20 group-hover:scale-110 transition-all duration-300">
                  <Users className="h-6 w-6 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="card-hover group cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                  <p className="text-3xl font-display font-bold mt-1 group-hover:text-brand-blue transition-colors">{totalBoards}</p>
                </div>
                <div className="p-3 rounded-xl bg-brand-blue/10 group-hover:bg-brand-blue/20 group-hover:scale-110 transition-all duration-300">
                  <Kanban className="h-6 w-6 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="card-hover group cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Hours Used</p>
                  <p className="text-3xl font-display font-bold mt-1 group-hover:text-brand-purple transition-colors">
                    {Math.round(totalHoursUsed)}
                    <span className="text-lg text-muted-foreground font-normal">
                      /{totalHoursAvailable}
                    </span>
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-brand-purple/10 group-hover:bg-brand-purple/20 group-hover:scale-110 transition-all duration-300">
                  <Clock className="h-6 w-6 text-brand-purple" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="card-hover group cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                  <p className="text-3xl font-display font-bold mt-1 group-hover:text-brand-teal transition-colors">
                    {totalHoursAvailable > 0
                      ? Math.round((totalHoursUsed / totalHoursAvailable) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-brand-teal/10 group-hover:bg-brand-teal/20 group-hover:scale-110 transition-all duration-300">
                  <TrendingUp className="h-6 w-6 text-brand-teal" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Client Hours */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Client Hours This Month</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredHoursSummary.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No clients found
                  </p>
                ) : (
                  filteredHoursSummary.map((client, index) => {
                    const progress = calculateProgress(client.hours_used, client.monthly_hours)
                    const progressColor = getProgressColor(progress)
                    
                    return (
                      <motion.div
                        key={client.client_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: clients.find(c => c.id === client.client_id)?.color || '#94A3B8' }}
                            />
                            <span className="font-medium">{client.client_name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{Math.round(client.hours_used || 0)}</span>
                            {' / '}{client.monthly_hours}h
                          </div>
                        </div>
                        <Progress
                          value={progress}
                          className="h-2"
                          indicatorClassName={progressColor}
                        />
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-muted-foreground">
                            {Math.round(client.hours_remaining || 0)}h remaining
                          </span>
                          <Badge
                            variant={progress >= 90 ? 'destructive' : progress >= 75 ? 'high' : 'outline'}
                            className="text-xs"
                          >
                            {progress}% used
                          </Badge>
                        </div>
                      </motion.div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions & Recent */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-6"
        >
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/boards">
                  <Kanban className="mr-2 h-4 w-4" />
                  View All Boards
                  <ArrowUpRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start">
                <Link to="/boards?new=true">
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Board
                  <ArrowUpRight className="ml-auto h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Recent Tickets */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentTickets.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No tickets yet
                  </p>
                ) : (
                  recentTickets.map((ticket) => (
                    <Link
                      key={ticket.id}
                      to={`/tickets/${ticket.id}`}
                      className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-muted transition-colors"
                    >
                      <Badge variant={ticket.status} className="mt-0.5 text-[10px]">
                        {ticket.status}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{ticket.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {ticket.ticket_id}
                        </p>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
