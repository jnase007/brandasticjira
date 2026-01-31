import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { format } from 'date-fns'
import {
  Building2, Clock, DollarSign, Users, ArrowLeft, Calendar,
  TrendingUp, FileText, Timer, CheckCircle, AlertCircle,
  BarChart3, PieChart, Activity, ExternalLink, Edit2, Eye,
  Play, Ticket, Loader2, ChevronRight, Target, Zap,
  Download, RefreshCw, Mail, Phone, MessageSquare, Plus,
  Send, Pin, Phone as PhoneCall, Video, FileText as FileIcon,
  Sparkles, AlertTriangle, Trophy, ArrowRight, Save, Award, Star, Camera, ImagePlus,
  Kanban, Circle, Upload, X, Trash2, MoreVertical, Pencil, Repeat, CalendarDays,
  PlayCircle, UserCheck, ThumbsUp, Receipt, CheckCircle2, ArrowUpDown
} from 'lucide-react'
import { supabase, logActivity, getTimeEntries, ensureValidSession } from '../lib/supabase'
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
import MentionInput, { sendMentionNotifications, MentionText } from '../components/MentionInput'
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
  const { user, profile, isTeam, startClientPreview, loading: authLoading } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [tickets, setTickets] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [monthlyStats, setMonthlyStats] = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const bannerInputRef = useRef(null)
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
  const [noteMentionedUserIds, setNoteMentionedUserIds] = useState([])
  const [savingNote, setSavingNote] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState({})
  const [replyMentions, setReplyMentions] = useState({})
  
  // Pipeline stage editing
  const [editingStage, setEditingStage] = useState(false)
  
  // Team assignments state
  const [teamAssignments, setTeamAssignments] = useState([])
  const [allTeamMembers, setAllTeamMembers] = useState([])
  
  // Client rate (hourly billing rate for this client)
  const [clientRate, setClientRate] = useState(175) // Default hourly rate
  
  // Client wins state
  const [clientWins, setClientWins] = useState([])
  const [addWinOpen, setAddWinOpen] = useState(false)
  const [editWinOpen, setEditWinOpen] = useState(false)
  const [editingWin, setEditingWin] = useState(null)
  const [deletingWinId, setDeletingWinId] = useState(null)
  const [newWin, setNewWin] = useState({
    title: '',
    description: '',
    category: 'general',
    image_url: '',
  })
  const [winImageUploading, setWinImageUploading] = useState(false)
  const [savingWin, setSavingWin] = useState(false)
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
  
  // Delete client state
  const [deleteClientOpen, setDeleteClientOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState(false)
  
  // Task sorting state
  const [taskSort, setTaskSort] = useState('newest') // 'newest' | 'oldest' | 'due_date' | 'assignee'
  
  // Quick task state
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  // Simplified task form - removed billing type, priority, and other clutter per QA feedback
  const getEmptyTaskForm = () => ({
    title: '', 
    description: '', 
    board_id: '', 
    assignee_id: '',
    service_category: '',
    estimated_hours: '',
    due_date: '',
  })
  const [newTask, setNewTask] = useState(getEmptyTaskForm())
  const [savingTask, setSavingTask] = useState(false)
  
  // Reset form when dialog opens/closes
  const handleCreateTaskDialogChange = (open) => {
    setCreateTaskOpen(open)
    if (!open) {
      setNewTask(getEmptyTaskForm())
    }
  }
  
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
  
  // Default team roles with colors
  const DEFAULT_ROLE_COLORS = {
    marketing_manager: 'bg-purple-500',
    account_specialist: 'bg-blue-500',
    marketing_coordinator: 'bg-green-500',
    paid_media: 'bg-orange-500',
    seo: 'bg-teal-500',
    design: 'bg-pink-500',
  }
  
  // Get roles from localStorage (synced with TeamHub) or use defaults
  const getTeamRoles = () => {
    const saved = localStorage.getItem('team_roster_roles')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return parsed.map(r => ({
          value: r.key,
          label: r.label,
          color: DEFAULT_ROLE_COLORS[r.key] || 'bg-gray-500'
        }))
      } catch (e) {
        console.error('Error parsing saved roles:', e)
      }
    }
    // Default roles
    return [
    { value: 'marketing_manager', label: 'Marketing Manager', color: 'bg-purple-500' },
    { value: 'account_specialist', label: 'Account Specialist', color: 'bg-blue-500' },
    { value: 'marketing_coordinator', label: 'Marketing Coordinator', color: 'bg-green-500' },
    { value: 'paid_media', label: 'Paid Media', color: 'bg-orange-500' },
    { value: 'seo', label: 'SEO', color: 'bg-teal-500' },
    { value: 'design', label: 'Design', color: 'bg-pink-500' },
  ]
  }
  
  const TEAM_ROLES = getTeamRoles()

  // Fetch all client data
  const fetchClientData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Validate session before fetching
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[ClientDetail] Session invalid')
        setLoadError('Session expired. Please refresh the page.')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
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
          // Check for 'user' property (from getTimeEntries join) or 'profiles'
          const userProfile = entry.user || entry.profiles
          if (userProfile && !seenIds.has(entry.user_id)) {
            seenIds.add(entry.user_id)
            uniqueMembers.push({
              id: entry.user_id,
              ...userProfile,
              totalMinutes: normalizedTimeEntries
                .filter(e => e.user_id === entry.user_id)
                .reduce((sum, e) => sum + (e.minutes || 0), 0)
            })
          }
        }
        console.log('[ClientDetail] Team members from time entries:', uniqueMembers.length)
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
      
      // Fetch all team members first (needed for enriching assignments)
      let allMembersData = []
      try {
        const { data: allMembers } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, email, role')
          .in('role', ['team', 'admin'])
          .order('full_name')
        allMembersData = allMembers || []
        setAllTeamMembers(allMembersData)
      } catch (err) {
        console.log('Error fetching team members:', err)
      }
      
      // Fetch team assignments for this client (without join to avoid schema issues)
      try {
        const { data: assignmentsData, error: assignError } = await supabase
          .from('client_team_assignments')
          .select('*')
          .eq('client_id', resolvedClientId)
        
        if (assignError) {
          console.error('Team assignments fetch error:', assignError)
        }
        
        // Enrich with user data from allMembersData
        const enrichedAssignments = (assignmentsData || []).map(a => ({
          ...a,
          user: allMembersData.find(m => m.id === a.user_id) || null
        }))
        
        console.log('[ClientDetail] Fetched assignments for client:', resolvedClientId, enrichedAssignments)
        setTeamAssignments(enrichedAssignments)
      } catch (err) {
        console.log('Team assignments table may not exist yet:', err)
      }
      
      // Fetch client wins for this client
      try {
        const { data: winsData, error: winsError } = await supabase
          .from('client_wins')
          .select('*')
          .eq('client_id', resolvedClientId)
          .order('created_at', { ascending: false })
        
        if (winsError) {
          console.error('[ClientDetail] Error fetching wins:', winsError)
        }
        
        // Enrich wins with user data from profiles
        const enrichedWins = (winsData || []).map(win => ({
          ...win,
          user: allMembersData.find(m => m.id === win.user_id) || null
        }))
        
        setClientWins(enrichedWins)
      } catch (err) {
        console.log('Client wins table may not exist yet:', err)
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
      
      // Fetch client hourly rate (what we charge this client)
      try {
        const { data: rateData } = await supabase
          .from('client_rates')
          .select('hourly_rate')
          .eq('client_id', resolvedClientId)
          .order('effective_date', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        if (rateData?.hourly_rate) {
          setClientRate(rateData.hourly_rate)
        }
      } catch (err) {
        console.log('Client rates table may not exist yet:', err)
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

  // Deactivate client (soft delete)
  const handleDeactivateClient = async () => {
    if (!resolvedClientId) return
    setDeletingClient(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false, client_status: 'inactive' })
        .eq('id', resolvedClientId)
      
      if (error) throw error
      
      toast({
        title: 'Client deactivated',
        description: `${client.name} has been deactivated.`,
        variant: 'success',
      })
      setDeleteClientOpen(false)
      navigate('/clients')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate client.',
        variant: 'destructive',
      })
    } finally {
      setDeletingClient(false)
    }
  }

  // Permanently delete client (hard delete)
  const handlePermanentDeleteClient = async () => {
    if (!resolvedClientId) return
    setDeletingClient(true)
    try {
      // Delete related data first (due to foreign key constraints)
      await supabase.from('time_entries').delete().eq('client_id', resolvedClientId)
      await supabase.from('tickets').delete().eq('client_id', resolvedClientId)
      await supabase.from('boards').delete().eq('client_id', resolvedClientId)
      await supabase.from('client_notes').delete().eq('client_id', resolvedClientId)
      await supabase.from('activity_log').delete().eq('client_id', resolvedClientId)
      await supabase.from('client_wins').delete().eq('client_id', resolvedClientId)
      
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', resolvedClientId)
      
      if (error) throw error
      
      toast({
        title: '🗑️ Client permanently deleted',
        description: `${client.name} and all related data have been removed.`,
        variant: 'success',
      })
      setDeleteClientOpen(false)
      navigate('/clients')
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Error deleting client',
        description: error.message || 'Failed to delete client.',
        variant: 'destructive',
      })
    } finally {
      setDeletingClient(false)
    }
  }

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) {
      console.log('[ClientDetail] Auth still loading, waiting...')
      return
    }
    if (!user) {
      console.log('[ClientDetail] No user after auth loaded')
      setLoading(false)
      return
    }
    if (clientId) {
      console.log('[ClientDetail] Auth ready, fetching client:', clientId)
      fetchClientData()
    }
  }, [clientId, authLoading, user?.id])

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
      
      // Send mention notifications
      if (noteMentionedUserIds.length > 0) {
        await sendMentionNotifications({
          mentionedUserIds: noteMentionedUserIds,
          fromUserId: user.id,
          fromUserName: profile?.full_name || 'Someone',
          entityType: 'client_note',
          entityId: data.id,
          entityName: client?.name,
          messagePreview: newNote.content,
          clientId: resolvedClientId,
        })
      }
      
      setNotes(prev => [data, ...prev])
      setNewNote({ title: '', content: '', note_type: 'note' })
      setNoteMentionedUserIds([])
      setAddNoteOpen(false)
      
      toast({
        title: '✅ Message sent',
        description: noteMentionedUserIds.length > 0 
          ? `Notified ${noteMentionedUserIds.length} team member(s)`
          : 'Your message has been saved.',
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

  // Add a new client win
  const handleAddWin = async () => {
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }
    if (!newWin.title.trim()) {
      toast({ title: 'Please enter a title for the win', variant: 'destructive' })
      return
    }
    
    setSavingWin(true)
    try {
      // Build insert data - only include image_url if it has a value (in case column doesn't exist yet)
      const insertData = {
          client_id: resolvedClientId,
          user_id: user.id,
          title: newWin.title,
          description: newWin.description || null,
          category: newWin.category,
      }
      
      // Only add image_url if it has a value (column might not exist in older schemas)
      if (newWin.image_url) {
        insertData.image_url = newWin.image_url
      }
      
      // First try with user join
      let { data, error } = await supabase
        .from('client_wins')
        .insert(insertData)
        .select('*, user:user_id(id, full_name, avatar_url)')
        .single()
      
      // If join fails, try without it
      if (error && error.message?.includes('user_id')) {
        console.log('[ClientDetail] Retrying without user join...')
        const retryResult = await supabase
          .from('client_wins')
          .insert(insertData)
          .select('*')
          .single()
        data = retryResult.data
        error = retryResult.error
      }
      
      if (error) {
        console.error('[ClientDetail] Win insert error:', error)
        throw error
      }
      
      // Enrich with user data if missing
      if (data && !data.user) {
        data.user = { id: user.id, full_name: profile?.full_name, avatar_url: profile?.avatar_url }
      }
      
      setClientWins(prev => [data, ...prev])
      setNewWin({ title: '', description: '', category: 'general', image_url: '' })
      setAddWinOpen(false)
      
      // Log activity
      logActivity({
        activity_type: 'client_win_added',
        user_id: user.id,
        entity_type: 'client',
        entity_id: resolvedClientId,
        entity_name: client?.name,
        metadata: { win_title: newWin.title, category: newWin.category },
      })
      
      toast({
        title: '🏆 Win added!',
        description: 'Nice work! Your win has been saved.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error adding win:', error)
      toast({
        title: 'Error adding win',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingWin(false)
    }
  }

  // Edit an existing win
  const handleEditWin = async () => {
    if (!editingWin?.id) return
    if (!editingWin.title?.trim()) {
      toast({ title: 'Please enter a title for the win', variant: 'destructive' })
      return
    }
    
    setSavingWin(true)
    try {
      const updateData = {
        title: editingWin.title,
        description: editingWin.description || null,
        category: editingWin.category,
      }
      
      if (editingWin.image_url !== undefined) {
        updateData.image_url = editingWin.image_url || null
      }
      
      const { data, error } = await supabase
        .from('client_wins')
        .update(updateData)
        .eq('id', editingWin.id)
        .select('*')
        .single()
      
      if (error) throw error
      
      // Update local state with user data preserved
      setClientWins(prev => prev.map(win => 
        win.id === editingWin.id 
          ? { ...data, user: win.user }
          : win
      ))
      
      setEditWinOpen(false)
      setEditingWin(null)
      
      toast({
        title: '✏️ Win updated!',
        description: 'Your changes have been saved.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error updating win:', error)
      toast({
        title: 'Error updating win',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingWin(false)
    }
  }

  // Delete a win
  const handleDeleteWin = async (winId) => {
    if (!winId) return
    
    setDeletingWinId(winId)
    try {
      const { error } = await supabase
        .from('client_wins')
        .delete()
        .eq('id', winId)
      
      if (error) throw error
      
      setClientWins(prev => prev.filter(win => win.id !== winId))
      
      toast({
        title: 'Win deleted',
        description: 'The win has been removed.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Error deleting win:', error)
      toast({
        title: 'Error deleting win',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setDeletingWinId(null)
    }
  }

  // Open edit dialog with win data
  const openEditWin = (win) => {
    setEditingWin({
      id: win.id,
      title: win.title,
      description: win.description || '',
      category: win.category || 'general',
      image_url: win.image_url || '',
    })
    setEditWinOpen(true)
  }

  const handleAddReply = async (parentId) => {
    const replyText = replyDrafts[parentId]?.trim()
    if (!replyText) return
    if (!resolvedClientId) {
      toast({ title: 'Client not ready yet', variant: 'destructive' })
      return
    }

    try {
      const { data, error } = await supabase
        .from('client_notes')
        .insert({
          client_id: resolvedClientId,
          created_by: user.id,
          content: replyText,
          note_type: 'note',
          parent_id: parentId,
        })
        .select()
        .single()

      if (error) throw error

      // Send mention notifications for reply
      const mentions = replyMentions[parentId] || []
      if (mentions.length > 0) {
        await sendMentionNotifications({
          mentionedUserIds: mentions,
          fromUserId: user.id,
          fromUserName: profile?.full_name || 'Someone',
          entityType: 'client_note_reply',
          entityId: data?.id,
          entityName: client?.name,
          messagePreview: replyText,
          clientId: resolvedClientId,
        })
      }

      setReplyDrafts((prev) => ({ ...prev, [parentId]: '' }))
      setReplyMentions((prev) => ({ ...prev, [parentId]: [] }))
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
  
  // Handle banner upload
  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      console.log('[ClientDetail BannerUpload] No file selected')
      return
    }
    if (!resolvedClientId) {
      console.error('[ClientDetail BannerUpload] No client ID')
      toast({ title: 'Error: No client ID', variant: 'destructive' })
      return
    }
    
    console.log('[ClientDetail BannerUpload] Starting upload:', file.name, file.type, file.size)
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please select an image file', variant: 'destructive' })
      return
    }
    
    // Validate file size (max 50MB to match dialog)
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Image must be less than 50MB', variant: 'destructive' })
      return
    }
    
    setUploadingBanner(true)
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${resolvedClientId}-banner-${Date.now()}.${fileExt}`
      const filePath = `client-banners/${fileName}`
      
      console.log('[ClientDetail BannerUpload] Uploading to path:', filePath)
      
      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })
      
      console.log('[ClientDetail BannerUpload] Upload result:', { uploadData, uploadError })
      
      if (uploadError) {
        console.error('[ClientDetail BannerUpload] Storage error:', uploadError)
        throw uploadError
      }
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)
      
      console.log('[ClientDetail BannerUpload] Public URL:', publicUrl)
      
      // Update client with new banner URL
      const { error: updateError } = await supabase
        .from('clients')
        .update({ banner_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', resolvedClientId)
      
      if (updateError) {
        console.error('[ClientDetail BannerUpload] DB update error:', updateError)
        throw updateError
      }
      
      // Update local state
      setClient(prev => ({ ...prev, banner_url: publicUrl, updated_at: new Date().toISOString() }))
      
      toast({
        title: '✅ Banner updated!',
        description: 'Your new banner has been saved.',
        variant: 'success',
      })
    } catch (error) {
      console.error('[ClientDetail BannerUpload] Error:', error)
      toast({ 
        title: 'Error uploading banner', 
        description: error.message || 'Check storage permissions', 
        variant: 'destructive' 
      })
    } finally {
      setUploadingBanner(false)
      // Reset input
      if (bannerInputRef.current) {
        bannerInputRef.current.value = ''
      }
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
      // Validate session first
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        toast({ title: 'Session expired', description: 'Please refresh the page and try again.', variant: 'destructive' })
        setSavingAssignment(false)
        return
      }
      
      const selectedMember = allTeamMembers.find(m => m.id === selectedUserId)
      
      // Delete existing assignment for this role (if any), then insert new one
      // This is more reliable than upsert which requires a unique constraint
      console.log('[ClientDetail] Deleting existing assignment for role:', selectedRole, 'client:', resolvedClientId)
      const { error: deleteError } = await supabase
        .from('client_team_assignments')
        .delete()
        .eq('client_id', resolvedClientId)
        .eq('role', selectedRole)
      
      if (deleteError) {
        console.warn('[ClientDetail] Delete error (non-fatal):', deleteError)
      }
      
      // Insert the new assignment
      console.log('[ClientDetail] Inserting new assignment:', { client_id: resolvedClientId, role: selectedRole, user_id: selectedUserId })
      const { data: insertData, error } = await supabase
        .from('client_team_assignments')
        .insert({
          client_id: resolvedClientId,
          role: selectedRole,
          user_id: selectedUserId,
        })
        .select()

      console.log('[ClientDetail] Insert result:', insertData, 'error:', error)
      
      if (error) throw error

      // Refresh assignments only (avoid long full-page refresh)
      // Use same approach as fetchClientData - no join, then enrich
      const { data: assignmentsData, error: fetchError } = await supabase
        .from('client_team_assignments')
        .select('*')
        .eq('client_id', resolvedClientId)
      
      if (fetchError) {
        console.error('[ClientDetail] Fetch error:', fetchError)
      }
      
      // Enrich with user data from allTeamMembers
      const enrichedAssignments = (assignmentsData || []).map(a => ({
        ...a,
        user: allTeamMembers.find(m => m.id === a.user_id) || null
      }))
      
      console.log('[ClientDetail] Refreshed assignments:', enrichedAssignments)
      setTeamAssignments(enrichedAssignments)
      
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
      
      // Simplified task data - just the essentials
      const taskData = {
        title: newTask.title,
        description: newTask.description,
        board_id: boardId,
        client_id: resolvedClientId,
        assigned_to: newTask.assignee_id || user.id, // Default to current user
        status: 'new',
        priority: 'medium', // Default priority
        created_by: user.id,
      }
      
      // Add estimated hours if provided
      if (newTask.estimated_hours) {
        taskData.estimated_hours = parseFloat(newTask.estimated_hours)
      }
      
      // Add due date if provided
      if (newTask.due_date) {
        taskData.due_date = newTask.due_date
      }
      
      const { data: createdTicket, error } = await supabase
        .from('tickets')
        .insert(taskData)
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
      setNewTask(getEmptyTaskForm())
      
      // Navigate to the newly created task
      const taskId = createdTicket.ticket_id || createdTicket.id
      navigate(`/tickets/${taskId}`)
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

  // 7-status workflow - normalize legacy statuses
  const normalizeStatus = (status) => {
    if (!status) return 'new'
    const statusMap = {
      'todo': 'new',
      'inprogress': 'in_progress',
      'done': 'closed',
    }
    return statusMap[status] || status
  }
  
  // Sort tickets based on selected sort option
  const sortTickets = (ticketList) => {
    return [...ticketList].sort((a, b) => {
      switch (taskSort) {
        case 'newest':
          return new Date(b.created_at) - new Date(a.created_at)
        case 'oldest':
          return new Date(a.created_at) - new Date(b.created_at)
        case 'due_date':
          // Tasks with due dates come first (soonest first), then tasks without due dates
          if (a.due_date && !b.due_date) return -1
          if (!a.due_date && b.due_date) return 1
          if (!a.due_date && !b.due_date) return new Date(b.created_at) - new Date(a.created_at)
          return new Date(a.due_date) - new Date(b.due_date)
        case 'assignee':
          const aName = a.assigned_user?.full_name || 'zzz' // Unassigned at bottom
          const bName = b.assigned_user?.full_name || 'zzz'
          const nameCompare = aName.localeCompare(bName)
          if (nameCompare !== 0) return nameCompare
          // Secondary sort by newest
          return new Date(b.created_at) - new Date(a.created_at)
        default:
          return new Date(b.created_at) - new Date(a.created_at)
      }
    })
  }
  
  const ticketsByStatus = {
    new: tickets.filter(t => normalizeStatus(t.status) === 'new').length,
    in_progress: tickets.filter(t => normalizeStatus(t.status) === 'in_progress').length,
    internal_review: tickets.filter(t => normalizeStatus(t.status) === 'internal_review').length,
    client_review: tickets.filter(t => normalizeStatus(t.status) === 'client_review').length,
    approved: tickets.filter(t => normalizeStatus(t.status) === 'approved').length,
    ready_for_billing: tickets.filter(t => normalizeStatus(t.status) === 'ready_for_billing').length,
    closed: tickets.filter(t => normalizeStatus(t.status) === 'closed').length,
  }
  
  // Count active (non-closed) tasks
  const activeTaskCount = tickets.filter(t => normalizeStatus(t.status) !== 'closed').length

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

      {/* Budget Alert Banner */}
      {monthlyBudget > 0 && budgetUsed >= 80 && (
        <motion.div 
          variants={itemVariants} 
          className={cn(
            "mb-4 p-3 rounded-lg flex items-center gap-3",
            budgetUsed >= 100 
              ? "bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400"
              : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400"
          )}
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              {budgetUsed >= 100 
                ? `⚠️ Budget exceeded! ${currentMonthHours}h used of ${monthlyBudget}h monthly budget (${budgetUsed}%)`
                : `⚡ Approaching budget limit: ${currentMonthHours}h used of ${monthlyBudget}h (${budgetUsed}%)`
              }
            </p>
          </div>
          <Badge variant={budgetUsed >= 100 ? "destructive" : "outline"} className="ml-auto">
            {budgetUsed}%
          </Badge>
        </motion.div>
      )}

      {/* Inactive Client Banner */}
      {client.client_status === 'inactive' && (
        <motion.div 
          variants={itemVariants} 
          className="mb-4 p-3 rounded-lg flex items-center gap-3 bg-slate-500/10 border border-slate-500/30 text-slate-700 dark:text-slate-300"
        >
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">
              ⏸️ Inactive Client
              {client.deactivated_at && (
                <span className="font-normal text-muted-foreground">
                  {' '}— Ended {format(new Date(client.deactivated_at), 'MMM d, yyyy')}
                </span>
              )}
            </p>
            {client.deactivation_reason && (
              <p className="text-sm text-muted-foreground">
                Reason: {client.deactivation_reason.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
            )}
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setEditClientOpen(true)}
          >
            Reactivate
          </Button>
        </motion.div>
      )}

      {/* Client Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="overflow-hidden">
          {/* Banner */}
          <div 
            className="h-28 md:h-32 relative overflow-hidden group"
            style={bannerSrc
              ? { backgroundImage: `url(${bannerSrc})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: `linear-gradient(135deg, ${client.color || '#F7931E'}dd, ${client.color || '#F7931E'}88, ${client.color || '#F7931E'}44)` }
            }
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
            
            {/* Banner Upload Button - appears on hover */}
            <input
              type="file"
              ref={bannerInputRef}
              onChange={handleBannerUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={uploadingBanner}
              className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 backdrop-blur-sm"
            >
              {uploadingBanner ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <ImagePlus className="h-4 w-4" />
                  {bannerSrc ? 'Change Banner' : 'Add Banner'}
                </>
              )}
            </button>
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
                    {(client.contact_email || client.contact_name || client.contact_phone) && (
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
                        {client.contact_phone && (
                          <a href={`tel:${client.contact_phone}`} className="flex items-center gap-1.5 hover:text-brand-orange transition-colors">
                            <Phone className="h-4 w-4" />
                            {client.contact_phone}
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
                    {profile?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteClientOpen(true)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-2 hidden sm:inline">Delete</span>
                      </Button>
                    )}
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
                <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                  <div className={cn(
                    "rounded-xl border px-3 py-2",
                    client.engagement_type === 'retainer' 
                      ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800" 
                      : "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
                  )}>
                    <p className="text-xs text-muted-foreground">Engagement</p>
                    <p className="font-semibold flex items-center gap-1">
                      {client.engagement_type === 'retainer' ? '📅 Retainer' : '🎯 Project'}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/40 px-3 py-2">
                    <p className="text-xs text-muted-foreground">{client.engagement_type === 'retainer' ? 'Monthly Hours' : 'Project Hours'}</p>
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
                    <p className="font-semibold">{activeTaskCount}</p>
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
                    {Math.round(currentMonthHours)}h
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
          <Card className={cn(
            client.engagement_type === 'retainer' 
              ? "border-blue-200 dark:border-blue-800" 
              : "border-orange-200 dark:border-orange-800"
          )}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-xl",
                  client.engagement_type === 'retainer' ? "bg-blue-500/10" : "bg-orange-500/10"
                )}>
                  <DollarSign className={cn(
                    "h-5 w-5",
                    client.engagement_type === 'retainer' ? "text-blue-500" : "text-orange-500"
                  )} />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {client.engagement_type === 'retainer' ? 'Retainer Revenue' : 'Project Revenue'}
                  </p>
                  <p className={cn(
                    "text-2xl font-bold",
                    client.engagement_type === 'retainer' ? "text-blue-600" : "text-orange-600"
                  )}>
                    ${Math.round(totalRevenue).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {billableHours}h billable @ $175/hr
                {client.engagement_type === 'retainer' && ' • Monthly'}
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
                    {tickets.length}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge variant="secondary" className="bg-slate-100 text-slate-800 dark:bg-slate-800/50 dark:text-slate-200">
                  {ticketsByStatus.new} new
                </Badge>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  {ticketsByStatus.in_progress} in progress
                </Badge>
                <Badge variant="secondary" className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                  {ticketsByStatus.internal_review} review
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                  {ticketsByStatus.closed} closed
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
                    {teamMembers.length}
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
            <TabsTrigger value="financials" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <DollarSign className="h-4 w-4" />
              <span>Financials</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Users className="h-4 w-4" />
              <span>Team</span>
            </TabsTrigger>
            <TabsTrigger value="wins" className="flex items-center gap-1.5 text-xs sm:text-sm px-3 py-2 shrink-0">
              <Award className="h-4 w-4" />
              <span>Wins</span>
              {clientWins.length > 0 && (
                <span className="ml-1 text-[10px] bg-yellow-500 text-white px-1.5 rounded-full">
                  {clientWins.length}
                </span>
              )}
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
                              <MentionText text={note.content} className="text-sm whitespace-pre-wrap mt-2 block" />

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
                                        <MentionText 
                                          text={reply.content} 
                                          className="text-xs text-muted-foreground whitespace-pre-wrap mt-1 block" 
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="mt-4 space-y-2">
                                <MentionInput
                                  placeholder="Reply to this message... Type @ to mention"
                                  value={replyDrafts[note.id] || ''}
                                  onChange={(value) =>
                                    setReplyDrafts((prev) => ({
                                      ...prev,
                                      [note.id]: value,
                                    }))
                                  }
                                  onMentionsChange={(mentions) =>
                                    setReplyMentions((prev) => ({
                                      ...prev,
                                      [note.id]: mentions,
                                    }))
                                  }
                                  rows={2}
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
                            <Badge className="bg-green-500 text-white hover:bg-green-600">Billable</Badge>
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

          {/* Tickets Tab - Enhanced with status grouping and quick actions */}
          <TabsContent value="tickets">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="h-5 w-5" />
                      Tasks
                    </CardTitle>
                    <CardDescription>All work items for this client • Drag tasks on boards to change status</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Sort Dropdown */}
                    <Select value={taskSort} onValueChange={setTaskSort}>
                      <SelectTrigger className="w-[140px] h-9">
                        <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="due_date">Due Date</SelectItem>
                        <SelectItem value="assignee">Assignee</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setCreateBoardOpen(true)}
                    >
                      <Kanban className="h-4 w-4 mr-2" />
                      New Board
                    </Button>
                  <Button 
                    size="sm"
                    onClick={() => setCreateTaskOpen(true)}
                    className="bg-brand-orange hover:bg-brand-orange/90"
                  >
                      <Plus className="h-4 w-4 mr-2" />
                    New Task
                  </Button>
                </div>
                </div>
                
                {/* Status Summary Bar - All 7 Workflow Statuses */}
                {tickets.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3 mt-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-1.5">
                      <Circle className="w-3.5 h-3.5 text-slate-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.new} New</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <PlayCircle className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.in_progress} In Progress</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-purple-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.internal_review} Internal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.client_review} Client</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <ThumbsUp className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.approved} Approved</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.ready_for_billing} Billing</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      <span className="text-sm font-medium">{ticketsByStatus.closed} Closed</span>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {tickets.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="mb-2">No tasks yet</p>
                    <p className="text-sm">Create a task or board to get started</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Task Status Sections - All 7 Workflow Statuses */}
                    {[
                      { key: 'new', label: 'New', icon: Circle, color: 'slate', bgClass: 'bg-slate-50 dark:bg-slate-900/20', borderClass: 'border-slate-200' },
                      { key: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'amber', bgClass: 'bg-amber-50 dark:bg-amber-900/20', borderClass: 'border-amber-200' },
                      { key: 'internal_review', label: 'Internal Review', icon: Eye, color: 'purple', bgClass: 'bg-purple-50 dark:bg-purple-900/20', borderClass: 'border-purple-200' },
                      { key: 'client_review', label: 'Client Review', icon: UserCheck, color: 'blue', bgClass: 'bg-blue-50 dark:bg-blue-900/20', borderClass: 'border-blue-200' },
                      { key: 'approved', label: 'Approved', icon: ThumbsUp, color: 'emerald', bgClass: 'bg-emerald-50 dark:bg-emerald-900/20', borderClass: 'border-emerald-200' },
                      { key: 'ready_for_billing', label: 'Ready for Billing', icon: Receipt, color: 'orange', bgClass: 'bg-orange-50 dark:bg-orange-900/20', borderClass: 'border-orange-200' },
                      { key: 'closed', label: 'Closed', icon: CheckCircle2, color: 'green', bgClass: 'bg-green-50 dark:bg-green-900/20', borderClass: 'border-green-200', isClosed: true },
                    ].map(({ key, label, icon: StatusIcon, color, bgClass, borderClass, isClosed }) => {
                      const statusTickets = sortTickets(tickets.filter(t => normalizeStatus(t.status) === key))
                      if (statusTickets.length === 0) return null
                      
                      return (
                        <div key={key}>
                          <div className="flex items-center gap-2 mb-2">
                            <StatusIcon className={`w-4 h-4 text-${color}-500`} />
                            <h4 className={`font-semibold text-${color}-600`}>{label}</h4>
                            <Badge variant="outline" className={`text-${color}-600 border-${color}-300`}>{statusTickets.length}</Badge>
                          </div>
                          <div className={`space-y-2 pl-4 border-l-2 ${borderClass}`}>
                            {(isClosed ? statusTickets.slice(0, 5) : statusTickets).map((ticket) => (
                              <Link
                                key={ticket.id}
                                to={`/clients/${client.slug || client.id}/tickets/${ticket.ticket_id || ticket.id}`}
                                className={cn(
                                  "flex items-center gap-3 p-3 rounded-lg border hover:shadow-sm transition-all group",
                                  bgClass, borderClass,
                                  isClosed && "opacity-60 hover:opacity-100"
                                )}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <StatusIcon className={`h-4 w-4 text-${color}-500 flex-shrink-0`} />
                                    <p className={cn("font-medium truncate", isClosed && "line-through text-muted-foreground")}>
                                      {ticket.title}
                                    </p>
                                    {ticket.due_date && new Date(ticket.due_date) < new Date() && !isClosed && (
                                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex-shrink-0">OVERDUE</Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                    {ticket.assigned_user ? (
                                      <div className="flex items-center gap-1">
                                        <Avatar className="h-4 w-4">
                                          <AvatarImage src={ticket.assigned_user.avatar_url} />
                                          <AvatarFallback className="text-[8px]">{ticket.assigned_user.full_name?.[0]}</AvatarFallback>
                                        </Avatar>
                                        <span>{ticket.assigned_user.full_name?.split(' ')[0]}</span>
                                      </div>
                                    ) : (
                                      <span className="text-orange-500">Unassigned</span>
                                    )}
                                    <span>•</span>
                                    <span>{ticket.boards?.name || 'General Tasks'}</span>
                                  </div>
                                </div>
                              </Link>
                            ))}
                            {isClosed && statusTickets.length > 5 && (
                              <p className="text-xs text-muted-foreground text-center py-2">
                                + {statusTickets.length - 5} more closed tasks
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}

                    {/* Boards Quick Access */}
                    {boards.length > 0 && (
                      <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <Kanban className="h-4 w-4" />
                          Project Boards
                          <span className="text-xs text-muted-foreground font-normal">
                            (drag tasks here to change status)
                          </span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {boards.map((board) => (
                            <Link 
                              key={board.id} 
                              to={`/boards/${board.id}`}
                              className="p-3 rounded-lg border hover:border-brand-orange/50 hover:shadow-sm transition-all group"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Kanban className="h-4 w-4 text-brand-orange" />
                                <span className="font-medium text-sm truncate">{board.name}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{tickets.filter(t => t.board_id === board.id && normalizeStatus(t.status) !== 'closed').length} active</span>
                                <span>•</span>
                                <span className="text-green-600">{tickets.filter(t => t.board_id === board.id && normalizeStatus(t.status) === 'closed').length} closed</span>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
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

          {/* Financials Tab */}
          <TabsContent value="financials">
            <div className="space-y-6">
              {/* Progress Overview - Like the Kantata screenshot */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Financial Stats */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Budget Overview Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-orange-500 mb-1">
                          <DollarSign className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase">Budget</span>
                        </div>
                        <p className="text-2xl font-bold">
                          ${(client.project_budget || (client.monthly_hours || 0) * 175).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-blue-500 mb-1">
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase">Actual Cost</span>
                        </div>
                        <p className="text-2xl font-bold">
                          ${Math.round(
                            (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 
                            (client.overhead_percentage ? 50 * (1 + (client.overhead_percentage / 100)) : 60)
                          ).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-green-500 mb-1">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-medium uppercase">Budget Remaining</span>
                        </div>
                        <p className="text-2xl font-bold">
                          ${Math.max(0, (client.project_budget || (client.monthly_hours || 0) * 175) - 
                            Math.round(
                              (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 
                              (client.overhead_percentage ? 50 * (1 + (client.overhead_percentage / 100)) : 60)
                            )).toLocaleString()}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Cost Breakdown */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <PieChart className="h-5 w-5 text-brand-orange" />
                        Cost Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="font-medium">Labor</span>
                          </div>
                          <span className="font-bold">
                            ${Math.round((timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 50).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-purple-500" />
                            <span className="font-medium">Overhead ({client.overhead_percentage || 20}%)</span>
                          </div>
                          <span className="font-bold">
                            ${Math.round((timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 50 * ((client.overhead_percentage || 20) / 100)).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-cyan-500" />
                            <span className="font-medium">Expenses</span>
                          </div>
                          <span className="font-bold text-muted-foreground">$0</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Monthly Burn Chart Placeholder */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-brand-orange" />
                        Monthly Burn Rate
                      </CardTitle>
                      <CardDescription>Budget vs actual spending over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {monthlyStats.slice(-6).map((stat, idx) => {
                          const budgetLine = (client.project_budget || (client.monthly_hours || 0) * 175) / 6
                          const percentage = budgetLine > 0 ? Math.min((stat.revenue / budgetLine) * 100, 150) : 0
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center justify-between text-sm">
                                <span className="font-medium">{stat.month}</span>
                                <span className="text-muted-foreground">
                                  ${stat.revenue.toLocaleString()} / ${Math.round(budgetLine).toLocaleString()}
                                </span>
                              </div>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all",
                                    percentage > 100 ? "bg-red-500" : percentage > 80 ? "bg-yellow-500" : "bg-green-500"
                                  )}
                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Sidebar */}
                <div className="space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Schedule Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Schedule</span>
                        </div>
                        <Progress 
                          value={client.project_end_date 
                            ? Math.min(
                                ((new Date() - new Date(client.project_start_date || new Date())) / 
                                (new Date(client.project_end_date) - new Date(client.project_start_date || new Date()))) * 100,
                                100
                              )
                            : budgetUsed
                          } 
                          className="h-3" 
                        />
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>
                            {client.project_start_date 
                              ? `${Math.round((new Date() - new Date(client.project_start_date)) / (1000 * 60 * 60 * 24))} days elapsed`
                              : `${currentMonthHours}h used`
                            }
                          </span>
                          <span>
                            {client.project_end_date 
                              ? `${Math.max(0, Math.round((new Date(client.project_end_date) - new Date()) / (1000 * 60 * 60 * 24)))} remaining`
                              : `${Math.max(0, monthlyBudget - currentMonthHours)}h remaining`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Scope Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Scope</span>
                        </div>
                        <Progress 
                          value={tickets.length > 0 
                            ? (ticketsByStatus.done / tickets.length) * 100 
                            : 0
                          } 
                          className="h-3" 
                        />
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>{ticketsByStatus.done}/{tickets.length} Completed</span>
                          <span>{tickets.length - ticketsByStatus.done} Remaining</span>
                        </div>
                      </div>

                      {/* Cost Progress */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Cost</span>
                        </div>
                        <Progress 
                          value={Math.min(budgetUsed, 100)} 
                          className={cn("h-3", budgetUsed > 100 && "[&>div]:bg-red-500")}
                        />
                        <div className="flex items-center justify-between mt-1 text-xs text-muted-foreground">
                          <span>
                            ${Math.round(
                              (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 
                              (client.overhead_percentage ? 50 * (1 + (client.overhead_percentage / 100)) : 60)
                            ).toLocaleString()} spent
                          </span>
                          <span>
                            ${Math.max(0, (client.project_budget || (client.monthly_hours || 0) * 175) - 
                              Math.round(
                                (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60
                              )).toLocaleString()} remaining
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Break-even Status */}
                  <Card className={cn(
                    "border-2",
                    totalRevenue > (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60
                      ? "border-green-500/50 bg-green-500/5"
                      : "border-yellow-500/50 bg-yellow-500/5"
                  )}>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2",
                          totalRevenue > (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60
                            ? "bg-green-500/20 text-green-600"
                            : "bg-yellow-500/20 text-yellow-600"
                        )}>
                          {totalRevenue > (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60 ? (
                            <TrendingUp className="h-6 w-6" />
                          ) : (
                            <AlertTriangle className="h-6 w-6" />
                          )}
                        </div>
                        <p className="font-bold text-lg">
                          {totalRevenue > (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60
                            ? "Profitable"
                            : "Below Break-even"
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {totalRevenue > (timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60
                            ? `+$${Math.round(totalRevenue - ((timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60)).toLocaleString()} profit`
                            : `$${Math.round(((timeEntries.reduce((sum, e) => sum + (e.minutes || 0), 0) / 60) * 60) - totalRevenue).toLocaleString()} to break-even`
                          }
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Quick Settings */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Financial Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Billing Rate</span>
                        <span className="font-medium">$175/hr</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Overhead</span>
                        <span className="font-medium">{client.overhead_percentage || 20}%</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Avg Employee Cost</span>
                        <span className="font-medium">$50/hr</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
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
                    {/* Show all roles from the list plus any additional from assignments */}
                    {(() => {
                      // Get all roles from TEAM_ROLES plus any additional from assignments
                      const allRoleKeys = new Set(TEAM_ROLES.map(r => r.value))
                      const additionalRoles = teamAssignments
                        .filter(a => !allRoleKeys.has(a.role))
                        .map(a => ({
                          value: a.role,
                          label: a.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                          color: 'bg-gray-500'
                        }))
                      const allRoles = [...TEAM_ROLES, ...additionalRoles]
                      
                      return allRoles.map((role) => {
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
                      })
                    })()}
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

          {/* Wins Tab */}
          <TabsContent value="wins">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5 text-yellow-500" />
                      Client Wins
                    </CardTitle>
                    <CardDescription>Celebrate successes and achievements for {client.name}</CardDescription>
                  </div>
                  <Button onClick={() => setAddWinOpen(true)} className="bg-yellow-500 hover:bg-yellow-600">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Win
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {clientWins.length === 0 ? (
                  <div className="text-center py-12">
                    <Award className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No wins yet</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                      Be the first to document a win for this client!
                    </p>
                    <Button onClick={() => setAddWinOpen(true)} variant="outline">
                      <Trophy className="h-4 w-4 mr-2" />
                      Add First Win
                    </Button>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {clientWins.map((win) => (
                      <motion.div
                        key={win.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative p-4 rounded-xl border bg-gradient-to-br from-yellow-500/10 to-orange-500/10 hover:shadow-lg hover:border-yellow-500/30 transition-all group"
                      >
                        {/* Edit/Delete buttons - visible on hover */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditWin(win)}
                            className="p-1.5 rounded-lg bg-background/80 hover:bg-background border shadow-sm text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit win"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteWin(win.id)}
                            disabled={deletingWinId === win.id}
                            className="p-1.5 rounded-lg bg-background/80 hover:bg-red-50 dark:hover:bg-red-950 border shadow-sm text-muted-foreground hover:text-red-600 transition-colors disabled:opacity-50"
                            title="Delete win"
                          >
                            {deletingWinId === win.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-yellow-500" />
                            <h3 className="font-semibold">{win.title}</h3>
                          </div>
                          {win.is_featured && (
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{win.description}</p>
                        {win.image_url && (
                          <img 
                            src={win.image_url} 
                            alt={win.title}
                            className="w-full h-32 object-cover rounded-lg mb-3 border"
                          />
                        )}
                        {win.category && win.category !== 'general' && (
                          <Badge variant="outline" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
                            {win.category.replace('_', ' ')}
                          </Badge>
                        )}
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={win.user?.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {win.user?.full_name?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {win.user?.full_name} • {formatDate(win.created_at)}
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
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
              <MentionInput
                placeholder="Write your message here... Type @ to mention someone"
                value={newNote.content}
                onChange={(value) => setNewNote(prev => ({ ...prev, content: value }))}
                onMentionsChange={setNoteMentionedUserIds}
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                💡 Type @ to mention a team member and notify them
              </p>
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
      
      {/* Add Win Dialog */}
      <Dialog open={addWinOpen} onOpenChange={setAddWinOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Add Client Win
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Win Title *</Label>
              <Input
                placeholder="e.g., 50% increase in conversions!"
                value={newWin.title}
                onChange={(e) => setNewWin(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={newWin.category} onValueChange={(v) => setNewWin(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Win</SelectItem>
                  <SelectItem value="conversion_rate">Conversion Rate</SelectItem>
                  <SelectItem value="traffic_growth">Traffic Growth</SelectItem>
                  <SelectItem value="roi">ROI Improvement</SelectItem>
                  <SelectItem value="revenue">Revenue Increase</SelectItem>
                  <SelectItem value="leads">Lead Generation</SelectItem>
                  <SelectItem value="seo">SEO Rankings</SelectItem>
                  <SelectItem value="social">Social Media</SelectItem>
                  <SelectItem value="design">Design/Creative</SelectItem>
                  <SelectItem value="launch">Campaign Launch</SelectItem>
                  <SelectItem value="testimonial">Client Testimonial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                placeholder="Tell us more about this win..."
                value={newWin.description}
                onChange={(e) => setNewWin(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Screenshot / Image (optional)</Label>
              {newWin.image_url ? (
                <div className="relative rounded-lg border overflow-hidden">
                  <img 
                    src={newWin.image_url} 
                    alt="Win screenshot" 
                    className="w-full h-32 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => setNewWin(prev => ({ ...prev, image_url: '' }))}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-all",
                    "hover:border-brand-orange/50 hover:bg-brand-orange/5",
                    winImageUploading && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => document.getElementById('win-detail-image-upload')?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={async (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files?.[0]
                    if (!file) return
                    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                      toast({ title: 'Please upload an image or PDF', variant: 'destructive' })
                      return
                    }
                    if (file.size > 10 * 1024 * 1024) {
                      toast({ title: 'File too large (max 10MB)', variant: 'destructive' })
                      return
                    }
                    setWinImageUploading(true)
                    try {
                      const fileName = `wins/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                      console.log('[WinUpload] Uploading file:', fileName, file.type, file.size)
                      const { data, error: uploadError } = await supabase.storage
                        .from('images')
                        .upload(fileName, file, { cacheControl: '3600', upsert: true })
                      console.log('[WinUpload] Upload result:', { data, uploadError })
                      if (uploadError) throw uploadError
                      const { data: { publicUrl } } = supabase.storage
                        .from('images')
                        .getPublicUrl(fileName)
                      console.log('[WinUpload] Public URL:', publicUrl)
                      setNewWin(prev => ({ ...prev, image_url: publicUrl }))
                      toast({ title: '📸 Image uploaded!', variant: 'success' })
                    } catch (err) {
                      console.error('[WinUpload] Error:', err)
                      toast({ title: 'Upload failed', description: err.message || 'Check storage permissions', variant: 'destructive' })
                    } finally {
                      setWinImageUploading(false)
                    }
                  }}
                >
                  <input
                    id="win-detail-image-upload"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
                        toast({ title: 'Please upload an image or PDF', variant: 'destructive' })
                        return
                      }
                      if (file.size > 10 * 1024 * 1024) {
                        toast({ title: 'File too large (max 10MB)', variant: 'destructive' })
                        return
                      }
                      setWinImageUploading(true)
                      try {
                        const fileName = `wins/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                        console.log('[WinUpload] Uploading file:', fileName, file.type, file.size)
                        const { data, error: uploadError } = await supabase.storage
                          .from('images')
                          .upload(fileName, file, { cacheControl: '3600', upsert: true })
                        console.log('[WinUpload] Upload result:', { data, uploadError })
                        if (uploadError) throw uploadError
                        const { data: { publicUrl } } = supabase.storage
                          .from('images')
                          .getPublicUrl(fileName)
                        console.log('[WinUpload] Public URL:', publicUrl)
                        setNewWin(prev => ({ ...prev, image_url: publicUrl }))
                        toast({ title: '📸 Image uploaded!', variant: 'success' })
                      } catch (err) {
                        console.error('[WinUpload] Error:', err)
                        toast({ title: 'Upload failed', description: err.message || 'Check storage permissions', variant: 'destructive' })
                      } finally {
                        setWinImageUploading(false)
                        e.target.value = ''
                      }
                    }}
                  />
                  {winImageUploading ? (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Loader2 className="h-6 w-6 animate-spin text-brand-orange" />
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-2">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Drag & drop or click to upload</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddWinOpen(false)
              setNewWin({ title: '', description: '', category: 'general', image_url: '' })
            }}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddWin} 
              disabled={savingWin || !newWin.title.trim()}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {savingWin ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Trophy className="h-4 w-4 mr-2" />
                  Add Win
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Win Dialog */}
      <Dialog open={editWinOpen} onOpenChange={(open) => {
        setEditWinOpen(open)
        if (!open) setEditingWin(null)
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-yellow-500" />
              Edit Win
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>What's the win? *</Label>
              <Input
                placeholder="e.g., Hit 10K followers on Instagram"
                value={editingWin?.title || ''}
                onChange={(e) => setEditingWin(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Details (optional)</Label>
              <Textarea
                placeholder="Tell us more about this achievement..."
                value={editingWin?.description || ''}
                onChange={(e) => setEditingWin(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Category</Label>
              <Select 
                value={editingWin?.category || 'general'}
                onValueChange={(val) => setEditingWin(prev => ({ ...prev, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Win</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="award">Award</SelectItem>
                  <SelectItem value="launch">Launch</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                setEditWinOpen(false)
                setEditingWin(null)
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditWin} 
              disabled={savingWin || !editingWin?.title?.trim()}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {savingWin ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
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
      
      {/* Create Task Dialog - Simplified per QA feedback */}
      <Dialog open={createTaskOpen} onOpenChange={handleCreateTaskDialogChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-brand-orange" />
              New Task for {client?.name}
              {client?.ticket_prefix && (
                <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">
                  {client.ticket_prefix}
                </span>
              )}
            </DialogTitle>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Create a task and assign it to a team member
              </p>
              {/* Client Rate Reminder */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                  ${clientRate}/hr
                </span>
                <span className="text-xs text-green-600 dark:text-green-500">client rate</span>
              </div>
            </div>
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
            
            {/* Simplified two column layout: Assign To and Estimated Hours */}
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
              
              {/* Estimated Hours */}
              <div className="space-y-2">
                <Label>Estimated Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g., 2"
                  value={newTask.estimated_hours}
                  onChange={(e) => setNewTask(prev => ({ ...prev, estimated_hours: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">Optional time estimate</p>
              </div>
            </div>
            
            {/* Due Date - Optional */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Due Date
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask(prev => ({ ...prev, due_date: e.target.value }))}
              />
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4">
            <Button variant="outline" onClick={() => handleCreateTaskDialogChange(false)}>
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
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map(template => {
                    const isSelected = selectedTemplates.includes(template.id)
                    return (
                      <button
                        key={template.id}
                        onClick={() => toggleTemplate(template.id)}
                        className={cn(
                          "relative rounded-lg border-2 p-4 text-left transition-all",
                          isSelected 
                            ? "border-brand-purple bg-brand-purple/5" 
                            : "border-border bg-white hover:border-brand-purple/50 dark:bg-slate-900"
                        )}
                      >
                        {/* Selection checkbox - top right */}
                          <div className={cn(
                          "absolute top-3 right-3 h-5 w-5 rounded-full border-2 flex items-center justify-center",
                            isSelected 
                              ? "border-brand-purple bg-brand-purple" 
                            : "border-gray-300"
                          )}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>

                        {/* Icon */}
                        <div className="text-3xl mb-2">{template.icon}</div>
                        
                        {/* Title - prominent and readable */}
                        <h4 className="font-semibold text-base mb-1 pr-6">{template.name}</h4>
                        
                        {/* Stats */}
                        <p className="text-sm text-muted-foreground">
                          {template.tasks.length} tasks • ~{template.estimatedHours}h
                        </p>
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

      {/* Delete Client Dialog */}
      <Dialog open={deleteClientOpen} onOpenChange={setDeleteClientOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove Client: {client?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Deactivate Option */}
            <button 
              className="w-full p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:border-amber-400 transition-colors text-left"
              onClick={handleDeactivateClient}
              disabled={deletingClient}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Eye className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-amber-700 dark:text-amber-400">Deactivate (Recommended)</h4>
                  <p className="text-sm text-amber-600/80 dark:text-amber-400/70">Hide from active lists but keep all data. Can be reactivated later.</p>
                </div>
              </div>
            </button>
            
            {/* Permanent Delete Option */}
            <button 
              className="w-full p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 cursor-pointer hover:border-red-400 transition-colors text-left"
              onClick={handlePermanentDeleteClient}
              disabled={deletingClient}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-700 dark:text-red-400">Permanently Delete</h4>
                  <p className="text-sm text-red-600/80 dark:text-red-400/70">Remove client and ALL related data forever. Cannot be undone!</p>
                </div>
              </div>
            </button>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteClientOpen(false)} className="w-full" disabled={deletingClient}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
