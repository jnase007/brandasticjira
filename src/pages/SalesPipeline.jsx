import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Plus, CheckCircle, Loader2, RefreshCw, Target, DollarSign,
  Briefcase, Phone, GripVertical, FileText, X, TrendingUp, Building2,
} from 'lucide-react'
import { supabase, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { useToast } from '../hooks/useToast'
import ClientDialog from '../components/ClientDialog'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const PIPELINE_STAGES = [
  { id: 'lead', title: 'Lead', color: 'bg-gray-400', icon: Target },
  { id: 'kickoff', title: 'Kickoff', color: 'bg-blue-500', icon: Phone },
  { id: 'proposal', title: 'Proposal', color: 'bg-purple-500', icon: FileText },
  { id: 'contract', title: 'Contract', color: 'bg-orange-500', icon: Briefcase },
  { id: 'won', title: 'Won', color: 'bg-green-500', icon: CheckCircle },
  { id: 'lost', title: 'Lost', color: 'bg-red-500', icon: X },
]

export default function SalesPipeline() {
  const { user, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [clients, setClients] = useState([])
  const [fetchError, setFetchError] = useState(null)
  const [sessionStale, setSessionStale] = useState(false)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)
    setSessionStale(false)

    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      console.warn('[SalesPipeline] Session invalid, cannot fetch data')
      setFetchError('Session expired. Please refresh the page or log in again.')
      setSessionStale(true)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout - please try again')), 15000)
    )

    try {
      const clientsPromise = supabase
        .from('clients')
        .select('*')
        .eq('client_status', 'prospect')
        .order('name')

      const clientsRes = await Promise.race([clientsPromise, timeout])

      if (clientsRes.error) {
        console.error('Clients fetch error:', clientsRes.error)
        setFetchError(clientsRes.error.message)
      }

      setClients(clientsRes.data || [])
    } catch (error) {
      console.error('Error fetching pipeline:', error)
      setFetchError(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    fetchData()
  }, [authLoading, user?.id])

  const handleReconnect = async () => {
    setRefreshing(true)
    try {
      const sessionValid = await ensureValidSession()
      if (sessionValid) {
        await fetchData(true)
      }
    } catch (err) {
      console.error('Reconnect failed:', err)
      toast({
        title: 'Connection failed',
        description: 'Please try logging out and back in.',
        variant: 'destructive',
      })
    } finally {
      setRefreshing(false)
    }
  }

  const handlePipelineDragEnd = async (result) => {
    if (!result.destination) return

    const { draggableId, source, destination } = result
    if (source.droppableId === destination.droppableId) return

    const newStage = destination.droppableId
    const clientId = draggableId

    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, pipeline_stage: newStage } : c
    ))

    try {
      const { error } = await supabase
        .from('clients')
        .update({ pipeline_stage: newStage })
        .eq('id', clientId)

      if (error) throw error

      toast({
        title: 'Pipeline updated',
        description: `Moved to ${newStage.charAt(0).toUpperCase() + newStage.slice(1)}`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Error updating pipeline:', error)
      toast({ title: 'Failed to update pipeline', variant: 'destructive' })
      fetchData()
    }
  }

  const handleStageChange = (clientId, newStage) => {
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, pipeline_stage: newStage } : c
    ))
    supabase
      .from('clients')
      .update({ pipeline_stage: newStage })
      .eq('id', clientId)
      .then(({ error }) => {
        if (error) {
          toast({ title: 'Failed to update', variant: 'destructive' })
          fetchData()
        } else {
          toast({
            title: 'Stage updated',
            description: `Moved to ${newStage}`,
            variant: 'success',
          })
        }
      })
  }

  const prospectClients = clients.filter((c) => c.client_status === 'prospect')
  const pipelineValue = prospectClients.reduce((sum, c) => sum + (Number(c.estimated_budget) || 0), 0)
  const monthlyRetainerValue = prospectClients
    .filter(c => c.engagement_type === 'retainer')
    .reduce((sum, c) => sum + (Number(c.estimated_budget) || 0), 0)
  const projectValue = prospectClients
    .filter(c => c.engagement_type !== 'retainer')
    .reduce((sum, c) => sum + (Number(c.estimated_budget) || 0), 0)
  const yearlyValue = (monthlyRetainerValue * 12) + projectValue

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (sessionStale) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mb-6">
            <RefreshCw className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Connection Lost</h2>
          <p className="text-slate-500 dark:text-white/50 mb-6 max-w-md">
            Your session needs to be refreshed. This can happen after being idle for a while.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={handleReconnect}
              disabled={refreshing}
              className="bg-gradient-to-r from-brand-orange to-brand-coral"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Reconnecting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reconnect Now
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.href = '/login'}
            >
              Log In Again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628]">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
      >
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white">Sales Pipeline</h1>
              </div>
              <p className="text-sm sm:text-lg text-slate-500 dark:text-white/50">
                Track prospects through your sales process
              </p>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none">
                <Link to="/clients">
                  <Building2 className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Clients</span>
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchData(true)}
                disabled={refreshing}
                className="flex-1 sm:flex-none"
              >
                <RefreshCw className={cn("h-4 w-4 sm:mr-2", refreshing && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button
                size="sm"
                className="bg-purple-500 hover:bg-purple-600 text-white flex-1 sm:flex-none"
                onClick={() => setClientDialogOpen(true)}
              >
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Add Prospect</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
          </div>
        </motion.div>

        {fetchError && (
          <motion.div variants={itemVariants} className="mb-6 p-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {fetchError}
          </motion.div>
        )}

        <motion.div variants={containerVariants} className="grid gap-4 grid-cols-2 md:grid-cols-3 mb-8">
          <motion.div variants={itemVariants}>
            <Card className={cn("bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm", prospectClients.length > 0 && "border-purple-500/30 bg-purple-500/5")}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10">
                    <Target className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-white/50">Prospects</p>
                    <p className="text-2xl font-bold text-purple-500">
                      {prospectClients.length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-white/50">Pipeline Value</p>
                    <p className="text-2xl font-bold text-green-600">
                      ${pipelineValue.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm col-span-2 md:col-span-1">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 dark:text-white/50">Won</p>
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                      {prospectClients.filter(c => c.pipeline_stage === 'won').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Target className="h-5 w-5 text-purple-500" />
                    Sales Pipeline
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-white/50">
                    Drag prospects between stages. Cards still open in Clients.
                  </CardDescription>
                </div>
                <Button onClick={() => setClientDialogOpen(true)} className="bg-purple-500 hover:bg-purple-600 text-white">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Prospect
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {prospectClients.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-white/50">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-30 text-purple-500" />
                  <p className="text-lg font-medium mb-1">No prospects yet</p>
                  <p className="text-sm mb-4">Start building your sales pipeline</p>
                  <Button className="bg-purple-500 hover:bg-purple-600" onClick={() => setClientDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Prospect
                  </Button>
                </div>
              ) : (
                <DragDropContext onDragEnd={handlePipelineDragEnd}>
                  <div className="flex gap-4 overflow-x-auto pb-4">
                    {PIPELINE_STAGES.map(stage => {
                      const stageClients = prospectClients.filter(c => c.pipeline_stage === stage.id)
                      return (
                        <div key={stage.id} className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0">
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                              <h3 className="font-semibold text-sm">{stage.title}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {stageClients.length}
                              </Badge>
                            </div>
                          </div>

                          <Droppable droppableId={stage.id}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={cn(
                                  "flex-1 p-2 rounded-xl border-2 border-dashed transition-colors min-h-[300px]",
                                  snapshot.isDraggingOver
                                    ? "border-purple-500 bg-purple-500/10"
                                    : "border-transparent bg-slate-100 dark:bg-slate-800/50"
                                )}
                              >
                                {stageClients.length === 0 && !snapshot.isDraggingOver ? (
                                  <div className="text-center py-8 text-slate-500 dark:text-white/50 text-sm">
                                    <stage.icon className="h-6 w-6 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">No prospects</p>
                                  </div>
                                ) : (
                                  stageClients.map((client, index) => (
                                    <Draggable key={client.id} draggableId={client.id} index={index}>
                                      {(provided, snapshot) => (
                                        <div
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          className={cn(
                                            "mb-2 p-3 rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 shadow-sm transition-all group",
                                            snapshot.isDragging
                                              ? "shadow-lg ring-2 ring-purple-500 rotate-2"
                                              : "hover:shadow-md cursor-grab"
                                          )}
                                        >
                                          <div className="flex items-center gap-2 mb-2">
                                            <GripVertical className="h-4 w-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                                            {client.logo_url ? (
                                              <img src={client.logo_url} alt={client.name} className="w-8 h-8 rounded-lg object-cover" />
                                            ) : (
                                              <div
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                                                style={{ backgroundColor: client.color || '#8B5CF6' }}
                                              >
                                                {getInitials(client.name)}
                                              </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                              <Link
                                                to={`/clients/${client.id}`}
                                                className="font-medium text-sm truncate block hover:text-purple-600 transition-colors"
                                                onClick={(e) => e.stopPropagation()}
                                              >
                                                {client.name}
                                              </Link>
                                              {client.lead_source && (
                                                <p className="text-[10px] text-slate-500 dark:text-white/50 truncate">{client.lead_source}</p>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-xs">
                                            {client.estimated_budget && (
                                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-50 dark:bg-green-500/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-500/30">
                                                <DollarSign className="h-2.5 w-2.5 mr-0.5" />
                                                {Number(client.estimated_budget).toLocaleString()}
                                              </Badge>
                                            )}
                                            {client.expected_close_date && (
                                              <span className="text-slate-500 dark:text-white/50 text-[10px]">
                                                {formatDate(client.expected_close_date)}
                                              </span>
                                            )}
                                          </div>

                                          {client.engagement_type && (
                                            <Badge
                                              variant="outline"
                                              className={cn(
                                                "mt-2 text-[10px] px-1.5 py-0",
                                                client.engagement_type === 'retainer'
                                                  ? "bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/30"
                                                  : "bg-orange-50 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-500/30"
                                              )}
                                            >
                                              {client.engagement_type === 'retainer' ? '📅 Retainer' : '🎯 Project'}
                                            </Badge>
                                          )}

                                          <div className="mt-2 md:hidden">
                                            <Select
                                              value={client.pipeline_stage || 'lead'}
                                              onValueChange={(newStage) => handleStageChange(client.id, newStage)}
                                            >
                                              <SelectTrigger className="h-7 text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="lead">Lead</SelectItem>
                                                <SelectItem value="kickoff">Kickoff</SelectItem>
                                                <SelectItem value="proposal">Proposal</SelectItem>
                                                <SelectItem value="contract">Contract</SelectItem>
                                                <SelectItem value="won">Won ✅</SelectItem>
                                                <SelectItem value="lost">Lost</SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                      )}
                                    </Draggable>
                                  ))
                                )}
                                {provided.placeholder}
                              </div>
                            )}
                          </Droppable>
                        </div>
                      )
                    })}
                  </div>
                </DragDropContext>
              )}

              {prospectClients.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex flex-wrap gap-4 md:gap-6">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">
                        <strong>{prospectClients.length}</strong> prospects in pipeline
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">
                        <strong>${monthlyRetainerValue.toLocaleString()}</strong>/mo retainers
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-orange-500" />
                      <span className="text-sm">
                        <strong>${projectValue.toLocaleString()}</strong> projects
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-lg">
                      <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                        <strong>${yearlyValue.toLocaleString()}</strong>/year potential
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>{prospectClients.filter(c => c.pipeline_stage === 'won').length}</strong> won
                      </span>
                    </div>
                    <Link
                      to="/clients"
                      className="flex items-center gap-2 text-sm text-slate-500 dark:text-white/50 hover:text-purple-600 transition-colors ml-auto"
                    >
                      <Building2 className="h-4 w-4" />
                      Clients
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        defaultClientStatus="prospect"
        onSuccess={() => {
          fetchData(true)
          setClientDialogOpen(false)
        }}
      />
    </div>
  )
}
