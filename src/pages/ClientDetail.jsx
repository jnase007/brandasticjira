import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Building2, Clock, DollarSign, Users, ArrowLeft, Calendar,
  TrendingUp, FileText, Timer, CheckCircle, AlertCircle,
  BarChart3, PieChart, Activity, ExternalLink, Edit2, Eye,
  Play, Ticket, Loader2, ChevronRight, Target, Zap,
  Download, RefreshCw, Mail, Phone, MessageSquare, Plus,
  Send, Pin, Phone as PhoneCall, Video, FileText as FileIcon,
  Sparkles, AlertTriangle, Trophy, ArrowRight, Save
} from 'lucide-react'
import { supabase, logActivity, getTimeEntries } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, isUuid } from '../lib/utils'
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
import { PROJECT_TEMPLATES, getTemplatesByCategory } from '../lib/projectTemplates'
import ClientDialog from '../components/ClientDialog'

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
  const { user, isTeam, startClientPreview } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const resolvedClientId = client?.id || (isUuid(clientId) ? clientId : null)
  const logoSrc = client?.logo_url
    ? `${client.logo_url}${client.logo_url.includes('?') ? '&' : '?'}v=${client.updated_at || client.id}`
    : null
  const bannerSrc = client?.banner_url
    ? `${client.banner_url}${client.banner_url.includes('?') ? '&' : '?'}v=${client.updated_at || client.id}`
    : null
  
  // Notes state
  const [notes, setNotes] = useState([])
  const [addNoteOpen, setAddNoteOpen] = useState(false)
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'note',
  })
  const [savingNote, setSavingNote] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  
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
  
  // Edit client state
  const [editClientOpen, setEditClientOpen] = useState(false)
  
  // Quick task state
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({ 
    title: '', 
    description: '', 
    board_id: '', 
    assignee_id: '',
    service_category: '',
    priority: 'medium'
  })
  const [savingTask, setSavingTask] = useState(false)
  
  // Task suggestions based on service category
  const TASK_SUGGESTIONS = {
    'SEO': [
      { title: 'Keyword research', description: 'Research and identify target keywords for the campaign' },
      { title: 'Technical SEO audit', description: 'Review site structure, meta tags, page speed, and crawlability' },
      { title: 'On-page optimization', description: 'Optimize title tags, meta descriptions, headers, and content' },
      { title: 'Link building outreach', description: 'Identify and reach out to potential link partners' },
      { title: 'Monthly SEO report', description: 'Compile rankings, traffic, and performance metrics' },
    ],
    'PPC': [
      { title: 'Campaign structure review', description: 'Audit current campaign structure and organization' },
      { title: 'Ad copy testing', description: 'Create and test new ad variations' },
      { title: 'Keyword bid optimization', description: 'Adjust bids based on performance data' },
      { title: 'Negative keyword review', description: 'Identify and add negative keywords' },
      { title: 'Monthly PPC report', description: 'Compile spend, conversions, and ROI metrics' },
    ],
    'Social Media': [
      { title: 'Content calendar creation', description: 'Plan and schedule social media posts for the month' },
      { title: 'Community engagement', description: 'Respond to comments and messages, engage with followers' },
      { title: 'Social graphics design', description: 'Create visual assets for social posts' },
      { title: 'Analytics review', description: 'Review engagement metrics and audience insights' },
      { title: 'Influencer outreach', description: 'Identify and connect with relevant influencers' },
    ],
    'Email Marketing': [
      { title: 'Email template design', description: 'Create responsive email template' },
      { title: 'Newsletter setup', description: 'Write and schedule monthly newsletter' },
      { title: 'Automation flow', description: 'Set up drip campaign or automation sequence' },
      { title: 'List segmentation', description: 'Segment email list for targeted messaging' },
      { title: 'A/B test subject lines', description: 'Test different subject lines for open rates' },
    ],
    'Web Development': [
      { title: 'Bug fix', description: 'Investigate and fix reported issue' },
      { title: 'Feature implementation', description: 'Develop new functionality as specified' },
      { title: 'Performance optimization', description: 'Improve page load speed and performance' },
      { title: 'Mobile responsiveness', description: 'Ensure proper display on all devices' },
      { title: 'Security update', description: 'Apply security patches and updates' },
    ],
    'Content Marketing': [
      { title: 'Blog post writing', description: 'Research and write blog article on assigned topic' },
      { title: 'Content strategy', description: 'Develop content plan aligned with goals' },
      { title: 'Copywriting', description: 'Write compelling copy for specified asset' },
      { title: 'Content audit', description: 'Review and inventory existing content' },
      { title: 'Case study', description: 'Write customer success story' },
    ],
    'Branding': [
      { title: 'Logo design', description: 'Create or refine logo concepts' },
      { title: 'Brand guidelines', description: 'Document brand standards and usage rules' },
      { title: 'Visual identity', description: 'Develop visual elements and style' },
      { title: 'Brand messaging', description: 'Define voice, tone, and key messages' },
      { title: 'Collateral design', description: 'Design branded marketing materials' },
    ],
    'Design': [
      { title: 'Graphic design', description: 'Create visual asset as specified' },
      { title: 'UI/UX design', description: 'Design user interface or experience flow' },
      { title: 'Banner design', description: 'Create display ad banners' },
      { title: 'Infographic', description: 'Design data visualization or infographic' },
      { title: 'Photo editing', description: 'Edit and enhance photos' },
    ],
  }
  
  // Template selector state
  const [templateSelectorOpen, setTemplateSelectorOpen] = useState(false)
  const [selectedTemplates, setSelectedTemplates] = useState([])
  const [creatingFromTemplate, setCreatingFromTemplate] = useState(false)
  const [sharingLink, setSharingLink] = useState(false)
  
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
      let clientQuery = supabase
        .from('clients')
        .select('*')

      if (isUuid(clientId)) {
        clientQuery = clientQuery.eq('id', clientId)
      } else {
        clientQuery = clientQuery.eq('slug', clientId)
      }

      const { data: clientData, error: clientError } = await clientQuery.maybeSingle()

      if (clientError || !clientData) {
        setClient(null)
        setLoadError('Client not found or you no longer have access.')
        return
      }

      setClient(clientData)
      setLoadError(null)
      if (isUuid(clientId) && clientData.slug && clientId !== clientData.slug) {
        navigate(`/clients/${clientData.slug}`, { replace: true })
      }
      const resolvedClientId = clientData.id

      // Fetch time entries for this client (with fallback for schema differences)
      const { data: timeData, error: timeError } = await getTimeEntries(null, resolvedClientId)
      if (timeError) {
        console.warn('Time entries fetch error:', timeError.message)
      }

      const normalizedTimeEntries = (timeData || []).map((entry) => ({
        ...entry,
        minutes: entry.minutes ?? entry.duration_minutes ?? 0,
        date:
          entry.date ||
          (entry.start_time ? entry.start_time.split('T')[0] : entry.created_at?.split('T')[0]),
        billable: entry.billable ?? true,
      }))

      setTimeEntries(normalizedTimeEntries)

      // Fetch tickets for this client
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*, boards(name)')
        .eq('client_id', resolvedClientId)
        .order('updated_at', { ascending: false })
        .limit(50)
      
      const assignedIds = [...new Set((ticketData || []).map((t) => t.assigned_to).filter(Boolean))]
      let assignedProfiles = []
      if (assignedIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', assignedIds)
        assignedProfiles = profilesData || []
      }

      const assignedMap = assignedProfiles.reduce((acc, profile) => {
        acc[profile.id] = profile
        return acc
      }, {})

      const timeByTicket = normalizedTimeEntries.reduce((acc, entry) => {
        if (entry.ticket_id) {
          acc[entry.ticket_id] = (acc[entry.ticket_id] || 0) + (entry.minutes || 0)
        }
        return acc
      }, {})

      const enrichedTickets = (ticketData || []).map((ticket) => ({
        ...ticket,
        assigned_user: ticket.assigned_to ? assignedMap[ticket.assigned_to] : null,
        tracked_minutes: timeByTicket[ticket.id] || 0,
      }))

      setTickets(enrichedTickets)

      // Get unique team members who worked on this client
      if (normalizedTimeEntries.length > 0) {
        const uniqueMembers = []
        const seenIds = new Set()
        for (const entry of normalizedTimeEntries) {
          if (entry.profiles && !seenIds.has(entry.user_id)) {
            seenIds.add(entry.user_id)
            uniqueMembers.push({
              id: entry.user_id,
              ...entry.profiles,
              totalMinutes: normalizedTimeEntries
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
        
        const monthEntries = normalizedTimeEntries.filter(e => {
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
      
      // Fetch client notes (messages)
      try {
        const { data: notesData } = await supabase
          .from('client_notes')
          .select('*, creator:created_by(full_name, avatar_url)')
          .eq('client_id', resolvedClientId)
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
          .eq('client_id', resolvedClientId)
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
          .select('*, tickets(id, title, status, assigned_to)')
          .eq('client_id', resolvedClientId)
          .eq('is_archived', false)
          .order('created_at', { ascending: false })
        setBoards(boardsData || [])
      } catch (err) {
        console.log('Error fetching boards:', err)
      }

    } catch (error) {
      console.error('Error fetching client data:', error)
      setClient(null)
      setLoadError('Something went wrong while loading this client. Please refresh and try again.')
      toast({ title: 'Error loading client', variant: 'destructive' })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleShareClientLink = async () => {
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    setSharingLink(true)
    try {
      let token = client?.public_token
      if (!token) {
        token = typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2) + Date.now().toString(36)
        const { error } = await supabase
          .from('clients')
          .update({ public_enabled: true, public_token: token })
          .eq('id', resolvedClientId)
        if (error) throw error
      } else if (!client?.public_enabled) {
        const { error } = await supabase
          .from('clients')
          .update({ public_enabled: true })
          .eq('id', resolvedClientId)
        if (error) throw error
      }

      const link = `${window.location.origin}/client-view/${token}`
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link)
      }
      toast({ title: 'Client shareable link copied', description: link, variant: 'success' })
      fetchClientData(true)
    } catch (error) {
      toast({ title: 'Unable to create link', description: error.message, variant: 'destructive' })
    } finally {
      setSharingLink(false)
    }
  }

  useEffect(() => {
    if (clientId) {
      fetchClientData()
    }
  }, [clientId])

  // Add a new note
  const handleAddNote = async () => {
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    if (!newNote.content.trim()) {
      toast({ title: 'Please enter note content', variant: 'destructive' })
      return
    }
    
    setSavingNote(true)
    try {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_id: resolvedClientId,
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

  const handleAddReply = async (parentId) => {
    const replyText = replyDrafts[parentId]?.trim()
    if (!replyText) return
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }

    try {
      const { error } = await supabase
        .from('client_notes')
        .insert({
          client_id: resolvedClientId,
          created_by: user.id,
          content: replyText,
          note_type: 'note',
          parent_id: parentId,
        })

      if (error) throw error

      setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }))
      fetchClientData(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reply.',
        variant: 'destructive',
      })
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
        .eq('id', resolvedClientId)
      
      if (clientError) throw clientError
      
      // Add a note about the stage change
      await supabase
        .from('client_notes')
        .insert({
          client_id: resolvedClientId,
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
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    
    setSavingAssignment(true)
    try {
      const selectedMember = allTeamMembers.find(m => m.id === selectedUserId)
      
      // Upsert the assignment (update if exists, insert if not)
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), 10000)
      )

      const upsertPromise = supabase
        .from('client_team_assignments')
        .upsert({
          client_id: resolvedClientId,
          role: selectedRole,
          user_id: selectedUserId,
          user_name: selectedMember?.full_name || 'Unknown',
        }, { onConflict: 'client_id,role' })

      const { error } = await Promise.race([upsertPromise, timeout])
      
      if (error) throw error

      // Refresh assignments only (avoid long full-page refresh)
      const { data: assignmentsData } = await supabase
        .from('client_team_assignments')
        .select('*, user:user_id(id, full_name, avatar_url, email)')
        .eq('client_id', resolvedClientId)
      setTeamAssignments(assignmentsData || [])
      
      toast({
        title: '✅ Team member assigned',
        description: `${selectedMember?.full_name} is now the ${TEAM_ROLES.find(r => r.value === selectedRole)?.label}`,
        variant: 'success',
      })
      
      setAssignTeamOpen(false)
      setSelectedRole('')
      setSelectedUserId('')
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
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    
    setSavingBoard(true)
    try {
      const { data, error } = await supabase
        .from('boards')
        .insert({
          name: newBoard.name,
          description: newBoard.description,
          client_id: resolvedClientId,
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
    if (!newTask.title.trim()) {
      toast({ title: 'Task title is required', variant: 'destructive' })
      return
    }
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    
    setSavingTask(true)
    try {
      let boardId = newTask.board_id
      
      // If no board selected, create or find a "General Tasks" board
      if (!boardId) {
        // Check if a General Tasks board already exists
        const { data: existingBoard } = await supabase
          .from('boards')
          .select('id')
          .eq('client_id', resolvedClientId)
          .eq('name', 'General Tasks')
          .maybeSingle()
        
        if (existingBoard) {
          boardId = existingBoard.id
        } else {
          // Create a new General Tasks board
          const { data: newBoard, error: boardError } = await supabase
            .from('boards')
            .insert({
              name: 'General Tasks',
              description: 'Quick tasks and one-off items',
              client_id: resolvedClientId,
              created_by: user.id,
              is_archived: false,
            })
            .select()
            .single()
          
          if (boardError) throw boardError
          boardId = newBoard.id
        }
      }
      
      const { data: createdTicket, error } = await supabase
        .from('tickets')
        .insert({
          title: newTask.title,
          description: newTask.description,
          board_id: boardId,
          client_id: resolvedClientId,
          assigned_to: newTask.assignee_id || user.id, // Default to current user
          status: 'todo',
          priority: newTask.priority || 'medium',
          created_by: user.id,
        })
        .select()
        .single()
      
      if (error) throw error
      
      toast({
        title: '✅ Task created',
        description: `"${newTask.title}" has been assigned`,
        variant: 'success',
      })

      logActivity({
        activity_type: 'ticket_created',
        user_id: user?.id,
        client_id: resolvedClientId,
        entity_type: 'ticket',
        entity_id: createdTicket.id,
        entity_name: createdTicket.ticket_id || createdTicket.title,
        metadata: { board_id: boardId },
      })
      
      setCreateTaskOpen(false)
      setNewTask({ title: '', description: '', board_id: '', assignee_id: '', service_category: '', priority: 'medium' })
      fetchClientData(true)
    } catch (error) {
      console.error('Error creating task:', error)
      toast({ title: 'Error creating task', description: error.message, variant: 'destructive' })
    } finally {
      setSavingTask(false)
    }
  }
  
  // Handle creating project from templates
  const handleCreateFromTemplates = async () => {
    if (selectedTemplates.length === 0) {
      toast({ title: 'Select at least one template', variant: 'destructive' })
      return
    }
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    
    setCreatingFromTemplate(true)
    try {
      let boardsCreated = 0
      let tasksCreated = 0
      
      for (const templateId of selectedTemplates) {
        const template = PROJECT_TEMPLATES.find(t => t.id === templateId)
        if (!template) continue
        
        // Create board for this template
        const { data: boardData, error: boardError } = await supabase
          .from('boards')
          .insert({
            name: template.name,
            description: template.description,
            client_id: resolvedClientId,
            created_by: user.id,
            is_archived: false,
          })
          .select()
          .single()
        
        if (boardError) {
          console.error('Error creating board:', boardError)
          continue
        }
        
        boardsCreated++
        
        // Create tasks for this board
        const tasksToInsert = template.tasks.map((task, index) => ({
          title: task.title,
          board_id: boardData.id,
          client_id: resolvedClientId,
          status: 'todo',
          priority: task.priority || 'medium',
          time_estimate: task.estimate ? Math.round(task.estimate * 60) : null,
          position: index,
          created_by: user.id,
        }))
        
        const { error: tasksError } = await supabase
          .from('tickets')
          .insert(tasksToInsert)
        
        if (tasksError) {
          console.error('Error creating tasks:', tasksError)
        } else {
          tasksCreated += template.tasks.length
        tasksToInsert.forEach((task) => {
          logActivity({
            activity_type: 'ticket_created',
            user_id: user?.id,
            client_id: resolvedClientId,
            entity_type: 'ticket',
            entity_id: null,
            entity_name: task.title,
            metadata: { board_id: boardData.id },
          })
        })
        }
      }
      
      toast({
        title: '🚀 Project created!',
        description: `Created ${boardsCreated} boards with ${tasksCreated} tasks. Open a board or the Tasks tab to track time.`,
        variant: 'success',
      })
      
      setTemplateSelectorOpen(false)
      setSelectedTemplates([])
      fetchClientData(true)
    } catch (error) {
      console.error('Error creating from templates:', error)
      toast({ title: 'Error creating project', description: error.message, variant: 'destructive' })
    } finally {
      setCreatingFromTemplate(false)
    }
  }
  
  // Toggle template selection
  const toggleTemplate = (templateId) => {
    setSelectedTemplates(prev => 
      prev.includes(templateId) 
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    )
  }
  
  // Get templates grouped by category
  const templatesByCategory = getTemplatesByCategory()

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

  if (loadError) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Client Unavailable</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/clients')} variant="outline">
              Back to Clients
            </Button>
          </CardContent>
        </Card>
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
            className="h-28 md:h-32 relative overflow-hidden"
            style={bannerSrc
              ? { backgroundImage: `url(${bannerSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `linear-gradient(135deg, ${client.color || '#F7931E'}dd, ${client.color || '#F7931E'}88, ${client.color || '#F7931E'}44)` }
            }
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>
          
          {/* Profile Info - Properly spaced below banner */}
          <CardContent className="relative pt-0 pb-4">
            <div className="flex flex-col lg:flex-row gap-3 lg:gap-4">
              {/* Logo - overlaps banner */}
              <div className="-mt-12 md:-mt-14 relative z-10 flex-shrink-0">
                <div 
                  className="w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl border-4 border-background overflow-hidden"
                  style={{ backgroundColor: client.color || '#F7931E' }}
                >
                  {logoSrc ? (
                    <img src={logoSrc} alt={client.name} className="w-full h-full object-cover" />
                  ) : (
                    client.name[0]
                  )}
                </div>
              </div>
              
              {/* Info */}
              <div className="flex-1 pt-1 md:pt-3">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                  <div className="min-w-0">
                    {/* Name & Badges */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
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
                      <div className="flex flex-wrap gap-1.5 mb-1">
                        {client.account_services.map((service, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{service}</Badge>
                        ))}
                      </div>
                    )}

                    {/* Contact Info */}
                    {(client.contact_email || client.contact_name) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 flex-shrink-0 lg:max-w-[520px]">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditClientOpen(true)}
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">Edit</span>
                    </Button>
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
                      onClick={() => setTemplateSelectorOpen(true)}
                      className="border-brand-purple text-brand-purple hover:bg-brand-purple/10"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">From Template</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateBoardOpen(true)}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="ml-2 hidden sm:inline">New Board</span>
                    </Button>
                    {isTeam && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          startClientPreview(client.id)
                          navigate('/portal')
                        }}
                      >
                        <Eye className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Client View</span>
                      </Button>
                    )}
                    {isTeam && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleShareClientLink}
                        disabled={sharingLink}
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Client Shareable Link</span>
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => setCreateTaskOpen(true)}
                      className="bg-brand-orange hover:bg-brand-orange/90"
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

                {/* Quick Summary */}
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="rounded-xl border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Monthly Hours</p>
                    <p className="font-semibold">{monthlyBudget}h</p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Hours Used</p>
                    <p className="font-semibold">{currentMonthHours}h</p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Remaining</p>
                    <p className="font-semibold">{Math.max(monthlyBudget - currentMonthHours, 0)}h</p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Open Tasks</p>
                    <p className="font-semibold">{ticketsByStatus.todo + ticketsByStatus.inprogress}</p>
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
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200"
                >
                  {ticketsByStatus.done} done
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                >
                  {ticketsByStatus.inprogress} active
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200"
                >
                  {ticketsByStatus.todo} todo
                </Badge>
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
        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList className="flex-nowrap overflow-x-auto gap-2 -mx-1 px-1 py-1 scrollbar-none">
            <TabsTrigger value="tickets" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Ticket className="h-4 w-4" />
              <span>Tasks</span>
              {tickets.length > 0 && (
                <span className="ml-1 text-[10px] bg-brand-orange text-white px-1.5 rounded-full">
                  {tickets.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <MessageSquare className="h-4 w-4" />
              <span>Messages</span>
              {notes.length > 0 && (
                <span className="ml-1 text-[10px] bg-muted-foreground/20 px-1.5 rounded-full">
                  {notes.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Activity className="h-4 w-4" />
              <span>Activity</span>
            </TabsTrigger>
            <TabsTrigger value="time" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Timer className="h-4 w-4" />
              <span className="whitespace-nowrap">Time Entries</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <BarChart3 className="h-4 w-4" />
              <span>Reports</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Users className="h-4 w-4" />
              <span>Team</span>
            </TabsTrigger>
          </TabsList>

          {/* Messages Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5 text-brand-orange" />
                      Client Messages
                    </CardTitle>
                    <CardDescription>Team messages for this client with replies</CardDescription>
                  </div>
                  <Button onClick={() => setAddNoteOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Message
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {notes.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">No messages yet</p>
                    <p className="text-sm mb-4">Start a message thread for this client</p>
                    <Button onClick={() => setAddNoteOpen(true)} variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Start Message
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {notes.filter((note) => !note.parent_id).map((note) => {
                      const replies = notes.filter((reply) => reply.parent_id === note.id)
                      return (
                        <div
                          key={note.id}
                          className="p-4 rounded-xl border bg-card hover:shadow-md transition-all"
                        >
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={note.creator?.avatar_url} />
                              <AvatarFallback className="text-xs">
                                {note.creator?.full_name?.[0] || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold">
                                  {note.creator?.full_name || 'Unknown'}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(note.created_at, 'MMM d, h:mm a')}
                                </span>
                              </div>
                              {note.title && (
                                <p className="text-sm font-medium mt-1">{note.title}</p>
                              )}
                              <p className="text-sm whitespace-pre-wrap mt-2">{note.content}</p>

                              {replies.length > 0 && (
                                <div className="mt-4 space-y-3 border-l pl-4">
                                  {replies.map((reply) => (
                                    <div key={reply.id} className="flex items-start gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarImage src={reply.creator?.avatar_url} />
                                        <AvatarFallback className="text-[10px]">
                                          {reply.creator?.full_name?.[0] || '?'}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-medium">
                                            {reply.creator?.full_name || 'Unknown'}
                                          </span>
                                          <span className="text-[11px] text-muted-foreground">
                                            {formatDate(reply.created_at, 'MMM d, h:mm a')}
                                          </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                                          {reply.content}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-4 space-y-2">
                                <Textarea
                                  placeholder="Reply to this message..."
                                  value={replyDrafts[note.id] || ''}
                                  onChange={(e) =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [note.id]: e.target.value,
                                    }))
                                  }
                                  className="min-h-[60px]"
                                />
                                <div className="flex justify-end">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddReply(note.id)}
                                    disabled={!replyDrafts[note.id]?.trim()}
                                  >
                                    Reply
                                  </Button>
                                </div>
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
                          <p className="font-medium truncate">
                            {entry.description || entry.ticket?.title || entry.notes || 'Time entry'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {entry.user?.full_name || entry.profiles?.full_name || 'Unknown'} • {formatDate(entry.date)}
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
                          <AvatarImage src={entry.user?.avatar_url || entry.profiles?.avatar_url} />
                          <AvatarFallback>{entry.user?.full_name?.[0] || entry.profiles?.full_name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {entry.description || entry.ticket?.title || entry.notes || 'Time entry'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {(entry.user?.full_name || entry.profiles?.full_name || 'Team Member')} • {formatDate(entry.date)}
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
                    <CardTitle>Tasks</CardTitle>
                    <CardDescription>All work items for this client</CardDescription>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => setCreateTaskOpen(true)}
                    className="bg-brand-orange hover:bg-brand-orange/90"
                  >
                    <Ticket className="h-4 w-4 mr-2" />
                    New Task
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
            to={`/clients/${client.slug || client.id}/tickets/${ticket.ticket_id || ticket.id}`}
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
                            {ticket.boards?.name || 'General Tasks'} • {ticket.ticket_id || ticket.id?.substring(0, 8)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {ticket.assigned_user ? (
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={ticket.assigned_user.avatar_url} />
                                  <AvatarFallback className="text-[10px]">
                                    {ticket.assigned_user.full_name?.[0] || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{ticket.assigned_user.full_name}</span>
                              </div>
                            ) : (
                              <span>Unassigned</span>
                            )}
                            <span>•</span>
                            <span>
                              Tracked: {Math.round((ticket.tracked_minutes || 0) / 60)}h{' '}
                              {(ticket.tracked_minutes || 0) % 60}m
                            </span>
                            {ticket.estimated_hours && (
                              <>
                                <span>•</span>
                                <span>Est: {ticket.estimated_hours}h</span>
                              </>
                            )}
                          </div>
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
                                <AvatarFallback>{assignment.user.full_name?.[0] || assignment.user_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{assignment.user.full_name || assignment.user_name}</p>
                                <p className="text-xs text-muted-foreground truncate">{assignment.user.email}</p>
                              </div>
                            </div>
                          ) : assignment?.user_name ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{assignment.user_name?.[0] || '?'}</AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{assignment.user_name}</p>
                                <p className="text-xs text-muted-foreground truncate">Assigned</p>
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

      {/* New Message Dialog */}
      <Dialog open={addNoteOpen} onOpenChange={setAddNoteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-brand-orange" />
              New Message for {client.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input
                placeholder="e.g., Quick update"
                value={newNote.title}
                onChange={(e) => setNewNote(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Message *</Label>
              <Textarea
                placeholder="Write your message here..."
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
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Message
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
      
      {/* Create Task Dialog - Improved */}
      <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-brand-orange" />
              New Task for {client?.name}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a task and assign it to a team member
            </p>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-5 py-4">
            {/* Service Category - Shows suggestions */}
            {client?.account_services && client.account_services.length > 0 && (
              <div className="space-y-2">
                <Label>Service Category</Label>
                <div className="flex flex-wrap gap-2">
                  {client.account_services.map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => setNewTask(prev => ({ 
                        ...prev, 
                        service_category: prev.service_category === service ? '' : service 
                      }))}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                        newTask.service_category === service
                          ? "bg-brand-orange text-white"
                          : "bg-muted hover:bg-muted/80 text-foreground"
                      )}
                    >
                      {service}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Task Suggestions - Show when category is selected */}
            {newTask.service_category && TASK_SUGGESTIONS[newTask.service_category] && (
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand-purple" />
                  Quick Ideas
                </Label>
                <div className="grid gap-2 md:grid-cols-2">
                  {TASK_SUGGESTIONS[newTask.service_category].slice(0, 4).map((suggestion, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setNewTask(prev => ({
                        ...prev,
                        title: suggestion.title,
                        description: suggestion.description,
                      }))}
                      className={cn(
                        "p-3 rounded-lg border text-left transition-all hover:border-brand-purple/50 hover:bg-brand-purple/5",
                        newTask.title === suggestion.title && "border-brand-purple bg-brand-purple/5"
                      )}
                    >
                      <p className="font-medium text-sm">{suggestion.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{suggestion.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* Task Title */}
            <div className="space-y-2">
              <Label>Task Title *</Label>
              <Input
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
                className="text-base"
              />
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Add details, context, or requirements..."
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            {/* Two column layout for assignee and priority */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Assign To */}
              <div className="space-y-2">
                <Label>Assign To</Label>
                <Select 
                  value={newTask.assignee_id || user?.id || ''} 
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, assignee_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
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
                          {member.id === user?.id && <span className="text-xs text-muted-foreground">(you)</span>}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Defaults to you if not changed</p>
              </div>
              
              {/* Priority */}
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-gray-400" />
                        Low
                      </span>
                    </SelectItem>
                    <SelectItem value="medium">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500" />
                        Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="high">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-orange-500" />
                        High
                      </span>
                    </SelectItem>
                    <SelectItem value="urgent">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        Urgent
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Board - Optional now */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Board
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Select 
                value={newTask.board_id || '__auto__'} 
                onValueChange={(value) => setNewTask(prev => ({ ...prev, board_id: value === '__auto__' ? '' : value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Auto-assign to General Tasks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">
                    <span className="text-muted-foreground">General Tasks (auto-create)</span>
                  </SelectItem>
                  {boards.map(board => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Leave empty to add to "General Tasks" board
              </p>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => {
              setCreateTaskOpen(false)
              setNewTask({ title: '', description: '', board_id: '', assignee_id: '', service_category: '', priority: 'medium' })
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateTask} 
              disabled={savingTask || !newTask.title.trim()}
              className="bg-brand-orange hover:bg-brand-orange/90"
            >
              {savingTask ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Task
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template Selector Dialog */}
      <Dialog open={templateSelectorOpen} onOpenChange={setTemplateSelectorOpen}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-6 w-6 text-brand-purple" />
              Create Project from Templates
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Select the service packages for <strong>{client?.name}</strong>. Each template creates a board with pre-configured tasks.
            </p>
          </DialogHeader>

          <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            After creating templates, open the new board or the client’s Tasks tab to start tracking time on any task.
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-6">
            {Object.entries(templatesByCategory).map(([category, templates]) => (
              <div key={category} className="rounded-2xl border bg-background p-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {category}
                </h3>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 auto-rows-fr">
                  {templates.map(template => {
                    const isSelected = selectedTemplates.includes(template.id)
                    return (
                      <button
                        key={template.id}
                        onClick={() => toggleTemplate(template.id)}
                        className={cn(
                          "group relative flex h-full flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/50",
                          isSelected 
                            ? "border-brand-purple bg-brand-purple/5 shadow-sm" 
                            : "border-muted bg-white hover:border-muted-foreground/30 hover:shadow-md"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{template.icon}</span>
                            <div>
                              <p className="font-semibold">{template.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {template.tasks.length} tasks • ~{template.estimatedHours}h
                              </p>
                            </div>
                          </div>
                          <div className={cn(
                            "h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all",
                            isSelected 
                              ? "border-brand-purple bg-brand-purple" 
                              : "border-muted-foreground/30"
                          )}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {template.description}
                        </p>
                        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground">
                          <span className="rounded-full bg-muted px-2 py-1">
                            {template.tasks.length} tasks
                          </span>
                          <span className="rounded-full bg-muted px-2 py-1">
                            ~{template.estimatedHours}h
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          
          {/* Summary Footer */}
          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                {selectedTemplates.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="text-brand-purple border-brand-purple">
                      {selectedTemplates.length} template{selectedTemplates.length !== 1 ? 's' : ''} selected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedTemplates.reduce((sum, id) => {
                        const t = PROJECT_TEMPLATES.find(t => t.id === id)
                        return sum + (t?.tasks.length || 0)
                      }, 0)} tasks • 
                      ~{selectedTemplates.reduce((sum, id) => {
                        const t = PROJECT_TEMPLATES.find(t => t.id === id)
                        return sum + (t?.estimatedHours || 0)
                      }, 0)}h estimated
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Select templates to get started</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => {
                  setTemplateSelectorOpen(false)
                  setSelectedTemplates([])
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateFromTemplates} 
                  disabled={creatingFromTemplate || selectedTemplates.length === 0}
                  className="bg-brand-purple hover:bg-brand-purple/90"
                >
                  {creatingFromTemplate ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Create {selectedTemplates.length} Board{selectedTemplates.length !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <ClientDialog
        open={editClientOpen}
        onOpenChange={setEditClientOpen}
        client={client}
        onSuccess={(updatedClient) => {
          setClient(updatedClient)
          fetchClientData(true)
          toast({ title: 'Client updated!', variant: 'success' })
        }}
      />
    </motion.div>
  )
}
