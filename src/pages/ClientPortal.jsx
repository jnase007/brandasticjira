import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Clock,
  Kanban,
  CheckCircle,
  Circle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react'
import { getClient, getBoards, getTickets, getClientHoursSummary } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDuration, calculateProgress, getProgressColor, getStatusInfo } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export default function ClientPortal() {
  const { profile } = useAuth()
  const [client, setClient] = useState(null)
  const [boards, setBoards] = useState([])
  const [tickets, setTickets] = useState([])
  const [hoursSummary, setHoursSummary] = useState(null)
  const [loading, setLoading] = useState(true)

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
      } catch (error) {
        console.error('Error fetching client portal data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile?.client_id])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="h-10 w-48 bg-muted rounded shimmer mb-8" />
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="shimmer h-32" />
          ))}
        </div>
        <Card className="shimmer h-96" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-medium mb-2">Client not found</h2>
        <p className="text-muted-foreground">
          Your account is not associated with a client. Please contact support.
        </p>
      </div>
    )
  }

  // Calculate stats
  const todoCount = tickets.filter((t) => t.status === 'todo').length
  const inProgressCount = tickets.filter((t) => t.status === 'inprogress').length
  const doneCount = tickets.filter((t) => t.status === 'done').length
  const hoursProgress = calculateProgress(hoursSummary?.hours_used || 0, hoursSummary?.monthly_hours || 1)
  const hoursColor = getProgressColor(hoursProgress)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-bold"
            style={{ backgroundColor: client.color }}
          >
            {client.name[0]}
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">{client.name}</h1>
            <p className="text-muted-foreground">Client Portal</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="grid gap-6 md:grid-cols-3 mb-8"
      >
        {/* Hours Card */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Monthly Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4 mb-4">
              <span className="text-4xl font-display font-bold">
                {Math.round(hoursSummary?.hours_used || 0)}
              </span>
              <span className="text-xl text-muted-foreground mb-1">
                / {hoursSummary?.monthly_hours || client.monthly_hours}h
              </span>
            </div>
            <Progress value={hoursProgress} className="h-3" indicatorClassName={hoursColor} />
            <div className="flex justify-between mt-3 text-sm">
              <span className="text-muted-foreground">
                {Math.round(hoursSummary?.hours_remaining || 0)}h remaining
              </span>
              <Badge variant={hoursProgress >= 90 ? 'destructive' : 'outline'}>
                {hoursProgress}% used
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tasks Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-status-todo" />
                  <span className="text-sm">To Do</span>
                </div>
                <span className="font-medium">{todoCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-status-inprogress" />
                  <span className="text-sm">In Progress</span>
                </div>
                <span className="font-medium">{inProgressCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-status-done" />
                  <span className="text-sm">Completed</span>
                </div>
                <span className="font-medium">{doneCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Boards/Tickets */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Tabs defaultValue="boards">
          <TabsList>
            <TabsTrigger value="boards">
              <Kanban className="mr-2 h-4 w-4" />
              Projects ({boards.length})
            </TabsTrigger>
            <TabsTrigger value="tickets">
              All Tasks ({tickets.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="boards" className="mt-6">
            {boards.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Kanban className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No projects yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {boards.map((board) => {
                  const boardTickets = tickets.filter((t) => t.board_id === board.id)
                  const boardDone = boardTickets.filter((t) => t.status === 'done').length
                  const boardProgress = boardTickets.length > 0
                    ? Math.round((boardDone / boardTickets.length) * 100)
                    : 0

                  return (
                    <Card key={board.id} className="card-hover">
                      <CardContent className="pt-6">
                        <h3 className="font-display font-semibold text-lg mb-2">
                          {board.name}
                        </h3>
                        {board.description && (
                          <p className="text-sm text-muted-foreground mb-4">
                            {board.description}
                          </p>
                        )}
                        <div className="flex items-center justify-between mb-2 text-sm">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">{boardProgress}%</span>
                        </div>
                        <Progress value={boardProgress} className="h-2" />
                        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                          <span>{boardTickets.length} tasks</span>
                          <span>{boardDone} completed</span>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tickets" className="mt-6">
            {tickets.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-muted-foreground">No tasks yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {tickets.map((ticket) => (
                  <Card key={ticket.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Badge variant={ticket.status}>
                          {getStatusInfo(ticket.status).label}
                        </Badge>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              {ticket.ticket_id}
                            </span>
                            <span className="font-medium">{ticket.title}</span>
                          </div>
                        </div>
                      </div>
                      <Badge variant={ticket.priority} className="text-xs">
                        {ticket.priority}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  )
}
