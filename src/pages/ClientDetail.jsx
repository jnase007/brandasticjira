import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, Clock, DollarSign, Users, ArrowLeft, Calendar,
  TrendingUp, FileText, Timer, CheckCircle, AlertCircle,
  BarChart3, PieChart, Activity, ExternalLink, Edit2,
  Play, Ticket, Loader2, ChevronRight, Target, Zap,
  Download, RefreshCw, Mail, Phone, MessageSquare, Plus,
  Send, Pin, Phone as PhoneCall, Video, FileText as FileIcon,
  Sparkles, AlertTriangle, Trophy, ArrowRight, Save
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
import { Textarea } from '../components/ui/textarea'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

// Pipeline stages with colors
const PIPELINE_STAGES = [
  { value: 'prospect', label: 'Prospect', color: 'bg-gray-500', icon: '🎯' },
  { value: 'kickoff', label: 'Kickoff', color: 'bg-blue-500', icon: '🚀' },
  { value: 'discovery', label: 'Discovery', color: 'bg-purple-500', icon: '🔍' },
  { value: 'proposal', label: 'Proposal', color: 'bg-yellow-500', icon: '📝' },
  { value: 'implementation', label: 'Implementation', color: 'bg-orange-500', icon: '⚙️' },
  { value: 'active', label: 'Active', color: 'bg-green-500', icon: '✅' },
  { value: 'paused', label: 'Paused', color: 'bg-amber-500', icon: '⏸️' },
  { value: 'churned', label: 'Churned', color: 'bg-red-500', icon: '❌' },
]

// Note types with icons
const NOTE_TYPES = [
  { value: 'note', label: 'General Note', icon: FileIcon },
  { value: 'call', label: 'Phone Call', icon: PhoneCall },
  { value: 'meeting', label: 'Meeting', icon: Video },
  { value: 'kickoff', label: 'Kickoff Meeting', icon: Sparkles },
  { value: 'discovery', label: 'Discovery Session', icon: Target },
  { value: 'proposal', label: 'Proposal', icon: FileText },
  { value: 'handoff', label: 'Team Handoff', icon: Users },
  { value: 'milestone', label: 'Milestone', icon: Trophy },
  { value: 'issue', label: 'Issue/Concern', icon: AlertTriangle },
  { value: 'win', label: 'Win! 🎉', icon: Trophy },
]

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
  
  // Notes state
  const [notes, setNotes] = useState([])
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'note',
  })
  const [savingNote, setSavingNote] = useState(false)
  
  // Pipeline stage editing
  const [editingStage, setEditingStage] = useState(false)
  
  // Team assignments state
  const [teamAssignments, setTeamAssignments] = useState([])
  const [allTeamMembers, setAllTeamMembers] = useState([])
  const [assignTeamOpen, setAssignTeamOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedUserId, setSelectedUserId] = useState('')
  const [savingAssignment, setSavingAssignment] = useState(false)
  
  // Boards state
  const [boards, setBoards] = useState([])
  const [createBoardOpen, setCreateBoardOpen] = useState(false)
  const [newBoard, setNewBoard] = useState({ name: '', description: '' })
  const [savingBoard, setSavingBoard] = useState(false)
  
  // Quick task state
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({ title: '', description: '', board_id: '', assignee_id: '' })
  const [savingTask, setSavingTask] = useState(false)
  
  // Team roles
  const TEAM_ROLES = [
    { value: 'marketing_manager', label: 'Marketing Manager', color: 'bg-purple-500' },
    { value: 'account_specialist', label: 'Account Specialist', color: 'bg-blue-500' },
    { value: 'marketing_coordinator', label: 'Marketing Coordinator', color: 'bg-green-500' },
    { value: 'paid_media', label: 'Paid Media', color: 'bg-orange-500' },
    { value: 'seo', label: 'SEO', color: 'bg-teal-500' },
    { value: 'design', label: 'Design', color: 'bg-pink-500' },
  ]

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
      
      // Fetch client notes
      try {
        const { data: notesData } = await supabase
          .from('client_notes')
          .select('*, creator:created_by(full_name, avatar_url)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
        setNotes(notesData || [])
      } catch (err) {
        console.log('Notes table may not exist yet:', err)
      }
      
      // Fetch team assignments for this client
      try {
        const { data: assignmentsData } = await supabase
          .from('client_team_assignments')
          .select('*, user:user_id(id, full_name, avatar_url, email)')
          .eq('client_id', clientId)
        setTeamAssignments(assignmentsData || [])
      } catch (err) {
        console.log('Team assignments table may not exist yet:', err)
      }
      
      // Fetch all team members for assignment dropdown
      try {
        const { data: allMembers } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, role')
          .in('role', ['team', 'admin'])
          .order('full_name')
        setAllTeamMembers(allMembers || [])
      } catch (err) {
        console.log('Error fetching team members:', err)
      }
      
      // Fetch boards for this client
      try {
        const { data: boardsData } = await supabase
          .from('boards')
          .select('*, tickets(id, title, status, assignee_id)')
          .eq('client_id', clientId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
        setBoards(boardsData || [])
      } catch (err) {
        console.log('Error fetching boards:', err)
      }

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

  // Add a new note
  const handleAddNote = async () => {
    if (!newNote.content.trim()) {
      toast({ title: 'Please enter note content', variant: 'destructive' })
      return
    }
    
    setSavingNote(true)
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          created_by: user.id,
          title: newNote.title || null,
          content: newNote.content,
          note_type: newNote.note_type,
        })
        .select('*, creator:created_by(full_name, avatar_url)')
        .single()
      
      if (error) throw error
      
      setNotes(prev => [data, ...prev])
      setNewNote({ title: '', content: '', note_type: 'note' })
      setAddNoteOpen(false)
      
      toast({
        title: '✅ Note added',
        description: 'Your note has been saved.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error adding note:', error)
      toast({
        title: 'Error adding note',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingNote(false)
    }
  }
  
  // Update client pipeline stage
  const updatePipelineStage = async (newStage) => {
    const oldStage = client.pipeline_stage || 'active'
    if (newStage === oldStage) {
      setEditingStage(false)
      return
    }
    
    try {
      // Update client stage
      const { error: clientError } = await supabase
        .from('clients')
        .update({ pipeline_stage: newStage })
        .eq('id', clientId)
      
      if (clientError) throw clientError
      
      // Add a note about the stage change
      await supabase
        .from('client_notes')
        .insert({
          client_id: clientId,
          created_by: user.id,
          content: `Pipeline stage changed from "${PIPELINE_STAGES.find(s => s.value === oldStage)?.label || oldStage}" to "${PIPELINE_STAGES.find(s => s.value === newStage)?.label || newStage}"`,
          note_type: 'milestone',
          stage_change_from: oldStage,
          stage_change_to: newStage,
        })
      
      setClient(prev => ({ ...prev, pipeline_stage: newStage }))
      setEditingStage(false)
      fetchClientData(true) // Refresh notes
      
      toast({
        title: '✅ Stage updated',
        description: `Client moved to ${PIPELINE_STAGES.find(s => s.value === newStage)?.label || newStage}`,
        variant: 'success',
      })
    } catch (error) {
      console.error('Error updating stage:', error)
      toast({
        title: 'Error updating stage',
        description: error.message,
        variant: 'destructive',
      })
    }
  }
  
  // Handle assigning a team member to a role
  const handleAssignTeamMember = async () => {
    if (!selectedRole || !selectedUserId) {
      toast({ title: 'Please select a role and team member', variant: 'destructive' })
      return
    }
    
    setSavingAssignment(true)
    try {
      const selectedMember = allTeamMembers.find(m => m.id === selectedUserId)
      
      // Upsert the assignment (update if exists, insert if not)
      const { error } = await supabase
        .from('client_team_assignments')
        .upsert({
          client_id: clientId,
          role: selectedRole,
          user_id: selectedUserId,
          user_name: selectedMember?.full_name || 'Unknown',
        }, { onConflict: 'client_id,role' })
      
      if (error) throw error
      
      toast({
        title: '✅ Team member assigned',
        description: `${selectedMember?.full_name} is now the ${TEAM_ROLES.find(r => r.value === selectedRole)?.label}`,
        variant: 'success',
      })
      
      setAssignTeamOpen(false)
      setSelectedRole('')
      setSelectedUserId('')
      fetchClientData(true)
    } catch (error) {
      console.error('Error assigning team member:', error)
      toast({ title: 'Error assigning team member', description: error.message, variant: 'destructive' })
    } finally {
      setSavingAssignment(false)
    }
  }
  
  // Handle creating a new board
  const handleCreateBoard = async () => {
    if (!newBoard.name.trim()) {
      toast({ title: 'Board name is required', variant: 'destructive' })
      return
    }
    
    setSavingBoard(true)
    try {
      const { data, error } = await supabase
        .from('boards')
        .insert({
          name: newBoard.name,
          description: newBoard.description,
          client_id: clientId,
          created_by: user.id,
          is_archived: false,
        })
        .select()
        .single()
      
      if (error) throw error
      
      toast({
        title: '✅ Board created',
        description: `"${newBoard.name}" is ready for tasks`,
        variant: 'success',
      })
      
      setCreateBoardOpen(false)
      setNewBoard({ name: '', description: '' })
      fetchClientData(true)
      
      // Navigate to the new board
      if (data?.id) {
        navigate(`/boards/${data.id}`)
      }
    } catch (error) {
      console.error('Error creating board:', error)
      toast({ title: 'Error creating board', description: error.message, variant: 'destructive' })
    } finally {
      setSavingBoard(false)
    }
  }
  
  // Handle creating a quick task
  const handleCreateTask = async () => {
    if (!newTask.title.trim() || !newTask.board_id) {
      toast({ title: 'Task title and board are required', variant: 'destructive' })
      return
    }
    
    setSavingTask(true)
    try {
      const { error } = await supabase
        .from('tickets')
        .insert({
          title: newTask.title,
          description: newTask.description,
          board_id: newTask.board_id,
          client_id: clientId,
          assignee_id: newTask.assignee_id || null,
          status: 'todo',
          priority: 'medium',
          created_by: user.id,
        })
      
      if (error) throw error
      
      toast({
        title: '✅ Task created',
        description: `"${newTask.title}" added to board`,
        variant: 'success',
      })
      
      setCreateTaskOpen(false)
      setNewTask({ title: '', description: '', board_id: '', assignee_id: '' })
      fetchClientData(true)
    } catch (error) {
      console.error('Error creating task:', error)
      toast({ title: 'Error creating task', description: error.message, variant: 'destructive' })
    } finally {
      setSavingTask(false)
    }
  }

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
          {/* Banner */}
          <div 
            className="h-36 md:h-40 relative"
            style={{ 
              background: `linear-gradient(135deg, ${client.color || '#F7931E'}dd, ${client.color || '#F7931E'}88, ${client.color || '#F7931E'}44)` 
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          
          {/* Profile Info - Properly spaced below banner */}
          <CardContent className="relative pt-0 pb-6">
            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              {/* Logo - overlaps banner */}
              <div className="-mt-14 md:-mt-16 relative z-10 flex-shrink-0">
                <div 
                  className="w-24 h-24 md:w-28 md:h-28 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-background overflow-hidden"
                  style={{ backgroundColor: client.color || '#F7931E' }}
                >
                  {client.logo_url ? (
                    <img src={client.logo_url} alt={client.name} className="w-full h-full object-cover" />
                  ) : (
                    client.name[0]
                  )}
                </div>
              </div>
              
              {/* Info */}
              <div className="flex-1 pt-1 md:pt-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    {/* Name & Badges */}
                    <div className="flex items-center gap-3 flex-wrap mb-2">
                      <h1 className="text-2xl md:text-3xl font-display font-bold">{client.name}</h1>
                      
                      {/* Pipeline Stage Badge */}
                      {editingStage ? (
                        <Select
                          value={client.pipeline_stage || 'active'}
                          onValueChange={(value) => updatePipelineStage(value)}
                        >
                          <SelectTrigger className="w-40 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PIPELINE_STAGES.map(stage => (
                              <SelectItem key={stage.value} value={stage.value}>
                                <span className="flex items-center gap-2">
                                  <span>{stage.icon}</span>
                                  <span>{stage.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "cursor-pointer hover:opacity-80 transition-opacity",
                            PIPELINE_STAGES.find(s => s.value === (client.pipeline_stage || 'active'))?.color,
                            "text-white border-0"
                          )}
                          onClick={() => setEditingStage(true)}
                        >
                          {PIPELINE_STAGES.find(s => s.value === (client.pipeline_stage || 'active'))?.icon}{' '}
                          {PIPELINE_STAGES.find(s => s.value === (client.pipeline_stage || 'active'))?.label || 'Active'}
                        </Badge>
                      )}
                    </div>
                    
                    {/* Services */}
                    {client.account_services && client.account_services.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {client.account_services.map((service, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Contact Info */}
                    {(client.contact_email || client.contact_name) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {client.contact_name && (
                          <span className="flex items-center gap-1.5">
                            <Users className="h-4 w-4" />
                            {client.contact_name}
                          </span>
                        )}
                        {client.contact_email && (
                          <a href={`mailto:${client.contact_email}`} className="flex items-center gap-1.5 hover:text-brand-orange transition-colors">
                            <Mail className="h-4 w-4" />
                            {client.contact_email}
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-shrink-0 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchClientData(true)}
                      disabled={refreshing}
                    >
                      <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                      <span className="ml-2 hidden sm:inline">Refresh</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateBoardOpen(true)}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">New Board</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateTaskOpen(true)}
                      disabled={boards.length === 0}
                      title={boards.length === 0 ? 'Create a board first' : 'Create a task'}
                    >
                      <Ticket className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">New Task</span>
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
                      <Play className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Start Timer</span>
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
        <Tabs defaultValue="notes" className="space-y-6">
          <TabsList className="flex-wrap">
            <TabsTrigger value="notes" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes
              {notes.length > 0 && (
                <span className="ml-1 text-xs bg-brand-orange text-white px-1.5 rounded-full">
                  {notes.length}
                </span>
              )}
            </TabsTrigger>
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

          {/* Notes Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-brand-orange" />
                      Client Notes & Communication
                    </CardTitle>
                    <CardDescription>Track meetings, calls, and important updates</CardDescription>
                  </div>
                  <Button onClick={() => setAddNoteOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Note
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No notes yet</p>
                    <p className="text-sm mb-4">Start adding notes to track your communication with this client</p>
                    <Button onClick={() => setAddNoteOpen(true)} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Note
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.map((note) => {
                      const noteType = NOTE_TYPES.find(t => t.value === note.note_type) || NOTE_TYPES[0]
                      const IconComponent = noteType.icon
                      const isStageChange = note.stage_change_from && note.stage_change_to
                      
                      return (
                        <div 
                          key={note.id} 
                          className={cn(
                            "p-4 rounded-xl border bg-card hover:shadow-md transition-all",
                            note.is_pinned && "border-brand-orange/50 bg-brand-orange/5",
                            isStageChange && "border-purple-500/30 bg-purple-500/5"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            {/* Icon */}
                            <div className={cn(
                              "p-2 rounded-lg flex-shrink-0",
                              note.note_type === 'win' && "bg-green-500/10",
                              note.note_type === 'issue' && "bg-red-500/10",
                              note.note_type === 'milestone' && "bg-purple-500/10",
                              !['win', 'issue', 'milestone'].includes(note.note_type) && "bg-muted"
                            )}>
                              <IconComponent className={cn(
                                "h-4 w-4",
                                note.note_type === 'win' && "text-green-500",
                                note.note_type === 'issue' && "text-red-500",
                                note.note_type === 'milestone' && "text-purple-500",
                                !['win', 'issue', 'milestone'].includes(note.note_type) && "text-muted-foreground"
                              )} />
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {note.title && (
                                  <span className="font-semibold">{note.title}</span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {noteType.label}
                                </Badge>
                                {note.is_pinned && (
                                  <Pin className="h-3 w-3 text-brand-orange" />
                                )}
                              </div>
                              
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                              
                              {/* Stage change visualization */}
                              {isStageChange && (
                                <div className="mt-2 flex items-center gap-2 text-xs">
                                  <Badge variant="outline" className="bg-muted">
                                    {PIPELINE_STAGES.find(s => s.value === note.stage_change_from)?.icon}{' '}
                                    {PIPELINE_STAGES.find(s => s.value === note.stage_change_from)?.label}
                                  </Badge>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <Badge className={cn(
                                    PIPELINE_STAGES.find(s => s.value === note.stage_change_to)?.color,
                                    "text-white border-0"
                                  )}>
                                    {PIPELINE_STAGES.find(s => s.value === note.stage_change_to)?.icon}{' '}
                                    {PIPELINE_STAGES.find(s => s.value === note.stage_change_to)?.label}
                                  </Badge>
                                </div>
                              )}
                              
                              {/* Meta */}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={note.creator?.avatar_url} />
                                    <AvatarFallback className="text-[10px]">
                                      {note.creator?.full_name?.[0] || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{note.creator?.full_name || 'Unknown'}</span>
                                </div>
                                <span>•</span>
                                <span>{formatDate(note.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
            <div className="space-y-6">
              {/* Role Assignments */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-brand-purple" />
                      Team Assignments
                    </CardTitle>
                    <CardDescription>Assign team members to specific roles on this client</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setAssignTeamOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Assign Role
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    {TEAM_ROLES.map((role) => {
                      const assignment = teamAssignments.find(a => a.role === role.value)
                      return (
                        <div 
                          key={role.value}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            assignment ? "border-brand-purple/30 bg-brand-purple/5" : "border-dashed border-muted-foreground/30"
                          )}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge className={cn("text-white", role.color)}>{role.label}</Badge>
                            {assignment && (
                              <Button 
                                variant="ghost" 
                                size="icon-sm"
                                onClick={() => {
                                  setSelectedRole(role.value)
                                  setSelectedUserId(assignment.user_id || '')
                                  setAssignTeamOpen(true)
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                          {assignment?.user ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={assignment.user.avatar_url} />
                                <AvatarFallback>{assignment.user.full_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{assignment.user.full_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{assignment.user.email}</p>
                              </div>
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setSelectedRole(role.value)
                                setAssignTeamOpen(true)
                              }}
                              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Assign someone
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
              
              {/* Time Contributors */}
              {teamMembers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Time Contributors</CardTitle>
                    <CardDescription>Team members who have logged time on this client</CardDescription>
                  </CardHeader>
                  <CardContent>
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
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Add Note Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand-orange" />
              Add Note for {client.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Note Type</Label>
              <Select 
                value={newNote.note_type} 
                onValueChange={(value) => setNewNote(prev => ({ ...prev, note_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_TYPES.map(type => {
                    const TypeIcon = type.icon
                    return (
                      <SelectItem key={type.value} value={type.value}>
                        <span className="flex items-center gap-2">
                          <TypeIcon className="h-4 w-4" />
                          {type.label}
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                placeholder="e.g., Kickoff Meeting Notes"
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Note Content *</Label>
              <Textarea
                placeholder="What happened? What are the next steps? Any important details to remember..."
                value={newNote.content}
                onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
                rows={6}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={savingNote || !newNote.content.trim()}>
              {savingNote ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Add Note
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Assign Team Member Dialog */}
      <Dialog open={assignTeamOpen} onOpenChange={setAssignTeamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-purple" />
              Assign Team Member
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map(role => (
                    <SelectItem key={role.value} value={role.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", role.color)} />
                        {role.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Team Member *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team member..." />
                </SelectTrigger>
                <SelectContent>
                  {allTeamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-[10px]">{member.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        {member.full_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAssignTeamOpen(false)
              setSelectedRole('')
              setSelectedUserId('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleAssignTeamMember} disabled={savingAssignment || !selectedRole || !selectedUserId}>
              {savingAssignment ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Board Dialog */}
      <Dialog open={createBoardOpen} onOpenChange={setCreateBoardOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-orange" />
              Create New Board
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Board Name *</Label>
              <Input
                placeholder="e.g., Discovery, Website Redesign, SEO Campaign"
                value={newBoard.name}
                onChange={(e) => setNewBoard(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="What is this board for?"
                value={newBoard.description}
                onChange={(e) => setNewBoard(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateBoardOpen(false)
              setNewBoard({ name: '', description: '' })
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateBoard} disabled={savingBoard || !newBoard.name.trim()}>
              {savingBoard ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Board'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Create Task Dialog */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-brand-teal" />
              Create Quick Task
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                placeholder="e.g., Complete discovery document"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Board *</Label>
              <Select value={newTask.board_id} onValueChange={(value) => setNewTask(prev => ({ ...prev, board_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a board..." />
                </SelectTrigger>
                <SelectContent>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {boards.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No boards yet. <button onClick={() => { setCreateTaskOpen(false); setCreateBoardOpen(true); }} className="text-brand-orange hover:underline">Create a board first</button>
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Assign To (optional)</Label>
              <Select value={newTask.assignee_id} onValueChange={(value) => setNewTask(prev => ({ ...prev, assignee_id: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {allTeamMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      <span className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url} />
                          <AvatarFallback className="text-[10px]">{member.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        {member.full_name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Task details..."
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateTaskOpen(false)
              setNewTask({ title: '', description: '', board_id: '', assignee_id: '' })
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={savingTask || !newTask.title.trim() || !newTask.board_id}>
              {savingTask ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Task'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
