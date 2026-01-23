import { useEffect, useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Building2, Clock, Kanban, CheckCircle2, ArrowLeft, Loader2, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { cn, formatRelativeDate } from '../lib/utils'
import { supabase } from '../lib/supabase'

export default function ClientPublic() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [payload, setPayload] = useState(null)

  const fetchPublicData = async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    
    try {
      // First try the Netlify function (uses service role key for full access)
      console.log('[ClientPublic] Trying Netlify function...')
      const res = await fetch(`/.netlify/functions/client-public?token=${encodeURIComponent(token)}`)
      
      if (res.ok) {
        const data = await res.json()
        if (data.client) {
          console.log('[ClientPublic] Netlify function succeeded')
          setPayload(data)
          return
        }
      }
      
      // If Netlify function fails, try direct Supabase fetch
      console.log('[ClientPublic] Netlify function failed, trying direct Supabase fetch...')
      
      // Fetch client by public_token
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, color, logo_url, banner_url, monthly_hours, account_services, public_enabled, public_token')
        .eq('public_token', token)
        .maybeSingle()
      
      if (clientError) {
        console.error('[ClientPublic] Client fetch error:', clientError)
        throw new Error('Unable to load client data')
      }
      
      if (!client) {
        throw new Error('Client not found')
      }
      
      // Check if public access is enabled
      if (client.public_enabled === false) {
        throw new Error('Public access is disabled for this client')
      }
      
      console.log('[ClientPublic] Found client:', client.name)
      
      // Fetch related data
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
        supabase
          .from('client_projects')
          .select('id, title')
          .eq('client_id', client.id)
          .eq('is_visible_to_client', true)
          .order('completed_date', { ascending: false })
          .catch(() => ({ data: [] })),
        supabase
          .from('activity_log')
          .select('id, entity_name, created_at')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(5)
          .catch(() => ({ data: [] })),
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
        boards: boardsRes.data || [],
        tickets: ticketsRes.data || [],
        projects: projectsRes?.data || [],
        recent_updates: activityRes?.data || [],
        hours_summary: hoursSummary,
      })
      
    } catch (err) {
      console.error('[ClientPublic] Error:', err)
      setError(err.message || 'Unable to load client view')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPublicData()
  }, [token])

  const client = payload?.client
  const boards = payload?.boards || []
  const tickets = payload?.tickets || []
  const projects = payload?.projects || []

  const openTasks = tickets.filter((t) => t.status !== 'done').length
  const completedTasks = tickets.filter((t) => t.status === 'done').length
  const hoursUsed = payload?.hours_summary?.hours_used || 0
  const monthlyHours = payload?.hours_summary?.monthly_hours || client?.monthly_hours || 0

  const tasksByBoard = useMemo(() => {
    const map = new Map()
    tickets.forEach((ticket) => {
      const board = boards.find((b) => b.id === ticket.board_id)
      const boardName = board?.name || 'General'
      if (!map.has(boardName)) map.set(boardName, [])
      map.get(boardName).push(ticket)
    })
    return Array.from(map.entries())
  }, [tickets, boards])

  if (loading) {
    return (
      <div className="min-h-screen bg-muted/20 p-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-muted/20 p-6">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 flex items-center justify-center">
                <Building2 className="h-8 w-8 text-brand-orange" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Client view unavailable</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {error || 'This shareable link is invalid or has been disabled.'}
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={fetchPublicData} variant="outline" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button asChild variant="default" className="bg-brand-orange hover:bg-brand-orange/90">
                  <Link to="/login">Return to Login</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/20">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Link to="/login" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand-orange">
          <ArrowLeft className="h-4 w-4" />
          Team login
        </Link>

        <Card className="overflow-hidden">
          <div
            className="h-32 md:h-36 relative overflow-hidden"
            style={client.banner_url
              ? { backgroundImage: `url(${client.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `linear-gradient(135deg, ${client.color || '#F7931E'}dd, ${client.color || '#F7931E'}88, ${client.color || '#F7931E'}44)` }
            }
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="-mt-10 md:-mt-12 flex-shrink-0">
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-xl border-4 border-background overflow-hidden"
                  style={{ backgroundColor: client.color || '#F7931E' }}
                >
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
                  ) : (
                    client.name?.[0]
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h1 className="text-2xl font-display font-bold">{client.name}</h1>
                    <p className="text-sm text-muted-foreground">Client portal preview</p>
                    {client.account_services?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {client.account_services.map((service) => (
                          <Badge key={service} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl border bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Monthly Hours</p>
                      <p className="font-semibold">{monthlyHours}h</p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Hours Used</p>
                      <p className="font-semibold">{hoursUsed}h</p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Open Tasks</p>
                      <p className="font-semibold">{openTasks}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Completed</p>
                      <p className="font-semibold">{completedTasks}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Boards & Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tasksByBoard.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks available yet.</p>
                ) : (
                  tasksByBoard.map(([boardName, boardTickets]) => (
                    <div key={boardName} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Kanban className="h-4 w-4 text-muted-foreground" />
                          <p className="font-medium">{boardName}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">{boardTickets.length} tasks</Badge>
                      </div>
                      <div className="space-y-2">
                        {boardTickets.slice(0, 6).map((ticket) => (
                          <div key={ticket.id} className="flex items-center justify-between text-sm">
                            <span className="truncate">{ticket.title}</span>
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded-full",
                              ticket.status === 'done' ? "bg-green-500/10 text-green-600" :
                              ticket.status === 'inprogress' ? "bg-blue-500/10 text-blue-600" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {ticket.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Updates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(payload?.recent_updates || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No updates yet.</p>
                ) : (
                  payload.recent_updates.map((update) => (
                    <div key={update.id} className="flex items-start gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-brand-orange mt-1" />
                      <div>
                        <p className="font-medium">{update.entity_name || 'Update'}</p>
                        <p className="text-xs text-muted-foreground">{formatRelativeDate(new Date(update.created_at))}</p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Portfolio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No portfolio items yet.</p>
                ) : (
                  projects.slice(0, 4).map((project) => (
                    <div key={project.id} className="flex items-center gap-3 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{project.title}</span>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

