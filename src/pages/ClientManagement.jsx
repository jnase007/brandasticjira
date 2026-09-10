import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Plus, Search, Bell, MessageSquare,
  Send, Clock, AlertTriangle, ExternalLink,
  ThumbsUp, Image, FileText, Trash2, Eye, Star, Loader2,
  ChevronLeft, ChevronRight, Filter, RefreshCw, Zap,
  Trophy, TrendingUp, PartyPopper, Upload, X, Pause, Play, Target,
  LayoutGrid, Table2
} from 'lucide-react'
import { supabase, seedSampleClients, ensureValidSession, getClientHoursSummary } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, formatRelativeDate, getInitials, getHoursProgress } from '../lib/utils'
import { 
  CLIENT_TYPES, 
  CLIENT_TYPE_OPTIONS, 
  getClientTypeConfig, 
  getClientTypeBadgeClasses 
} from '../lib/clientTypes'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Textarea } from '../components/ui/textarea'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Progress } from '../components/ui/progress'
import { Skeleton } from '../components/ui/skeleton'
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
  DialogDescription,
} from '../components/ui/dialog'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'
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

const REQUEST_TYPES = [
  { value: 'approval', label: 'Approval Needed', icon: ThumbsUp, color: 'text-green-500' },
  { value: 'assets', label: 'Assets Request', icon: Image, color: 'text-blue-500' },
  { value: 'feedback', label: 'Feedback Request', icon: MessageSquare, color: 'text-purple-500' },
  { value: 'content', label: 'Content Needed', icon: FileText, color: 'text-orange-500' },
  { value: 'payment', label: 'Payment Reminder', icon: Clock, color: 'text-yellow-500' },
  { value: 'meeting', label: 'Meeting Request', icon: Users, color: 'text-teal-500' },
  { value: 'general', label: 'General Request', icon: Bell, color: 'text-gray-500' },
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-green-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'text-red-500' },
]


const DIRECTORY_PAGE_SIZE = 15
const DIRECTORY_VIEW_KEY = 'brandastic.clientsDirectoryView'

function formatHoursValue(value) {
  const n = Number(value) || 0
  const rounded = Math.round(n * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function getClientMonthlyRevenue(client) {
  return (Number(client?.monthly_hours) || 0) * 175
}

function getClientHoursStats(client, hoursUsedByClient) {
  const hours = Number(client?.monthly_hours) || 0
  const used = Number(hoursUsedByClient?.[client?.id] || 0)
  const progress = getHoursProgress(hours, used * 60)
  const actual = progress.actualHours ?? used
  const remaining = hours > 0 ? Math.round((hours - actual) * 10) / 10 : 0
  return {
    hours,
    used: actual,
    remaining,
    percentage: progress.percentage || 0,
    hoursStatus: progress.status || 'unknown',
  }
}

function getDirectoryStatus(client, hoursStats, options = {}) {
  if (client?.is_active === false) {
    return { label: 'Inactive', tone: 'inactive' }
  }
  if (client?.client_status === 'prospect') {
    return { label: 'Prospect', tone: 'prospect' }
  }
  if (hoursStats?.hoursStatus === 'warning' || hoursStats?.hoursStatus === 'over') {
    return { label: 'Attention', tone: 'attention' }
  }
  if (options.allowNotStarted && (Number(hoursStats?.used) || 0) <= 0) {
    return { label: 'Not started', tone: 'not_started' }
  }
  return { label: 'On track', tone: 'on_track' }
}

function directoryStatusClasses(tone) {
  if (tone === 'attention') return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
  if (tone === 'inactive') return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
  if (tone === 'prospect') return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
  if (tone === 'not_started') return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
  return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
}

function getUtilizationBarClass(hoursStats) {
  if (hoursStats?.hoursStatus === 'over' || (hoursStats?.percentage || 0) >= 100) {
    return 'bg-red-500'
  }
  if (hoursStats?.hoursStatus === 'warning' || (hoursStats?.percentage || 0) >= 80) {
    return 'bg-amber-500'
  }
  return 'bg-emerald-500'
}

function ClientMark({ client, size = 'md' }) {
  const dim = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm'
  if (client?.logo_url) {
    return (
      <img
        src={client.logo_url}
        alt=""
        className={cn(dim, 'rounded-lg object-contain bg-white border border-slate-200 dark:border-white/10')}
      />
    )
  }
  return (
    <div
      className={cn(dim, 'rounded-lg flex items-center justify-center text-white font-semibold')}
      style={{ backgroundColor: client?.color || '#F7931E' }}
    >
      {(client?.name || '?')[0]}
    </div>
  )
}

function ServiceChips({ services, limit = 2 }) {
  const list = Array.isArray(services) ? services.filter(Boolean) : []
  if (list.length === 0) {
    return <span className="text-slate-400 dark:text-white/40">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {list.slice(0, limit).map((service) => (
        <span
          key={service}
          className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white/70"
        >
          {service}
        </span>
      ))}
      {list.length > limit && (
        <span className="text-[11px] text-slate-400 dark:text-white/40">+{list.length - limit}</span>
      )}
    </div>
  )
}

// Empty state component for when there are no clients
function EmptyClientsState({ onImport, loading }) {
  return (
    <div className="text-center py-12">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/20 flex items-center justify-center mx-auto mb-4">
        <Building2 className="h-10 w-10 text-brand-orange" />
      </div>
      <h3 className="text-xl font-semibold mb-2">No Clients Yet</h3>
      <p className="text-slate-500 dark:text-white/50 mb-6 max-w-md mx-auto">
        Import your Brandastic clients to start tracking time, projects, and profitability.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={onImport}
          disabled={loading}
          size="lg"
          className="bg-gradient-to-r from-brand-orange to-brand-coral text-white"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 mr-2" />
              Import 22 Brandastic Clients
            </>
          )}
        </Button>
      </div>
      <div className="mt-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 max-w-lg mx-auto">
        <p className="text-sm text-slate-500 dark:text-white/50">
          <strong>Includes:</strong> Calops, Prudental Labs, Salvin, Check'n Play, DESS USA, and 17 more clients with calculated hours at $175/hr
        </p>
      </div>
    </div>
  )
}

export default function ClientManagement() {
  const { user, profile, isAdmin, loading: authLoading } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('clients')
  const [statusFilter, setStatusFilter] = useState('active') // 'active', 'inactive', 'all'
  const [clientTypeFilter, setClientTypeFilter] = useState('all') // 'all', 'retainer', 'project', 'personal_saas'
  const [directoryView, setDirectoryView] = useState(() => {
    try {
      return localStorage.getItem(DIRECTORY_VIEW_KEY) === 'cards' ? 'cards' : 'table'
    } catch {
      return 'table'
    }
  })
  const [directoryPage, setDirectoryPage] = useState(1)
  const [hoursUsedByClient, setHoursUsedByClient] = useState({})
  
  // Data
  const [clients, setClients] = useState([])
  const [requests, setRequests] = useState([])
  const [projects, setProjects] = useState([])
  const [clientUsers, setClientUsers] = useState([])
  const [clientWins, setClientWins] = useState([])
  
  // Pinned/favorite clients (stored in database for persistence)
  const [pinnedClients, setPinnedClients] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  
  // Delete client state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Fetch user's favorite clients from database
  const fetchFavorites = async () => {
    if (!user?.id) return
    try {
      const { data, error } = await supabase
        .from('user_favorite_clients')
        .select('client_id')
        .eq('user_id', user.id)
      
      if (error) {
        // Table might not exist yet - fall back to localStorage
        console.warn('[ClientManagement] Favorites table not ready, using localStorage:', error.message)
        try {
          const stored = localStorage.getItem('pinnedClients')
          setPinnedClients(stored ? JSON.parse(stored) : [])
        } catch (e) {
          setPinnedClients([])
        }
        return
      }
      
      const favoriteIds = (data || []).map(f => f.client_id)
      setPinnedClients(favoriteIds)
      // Also sync to localStorage as backup
      localStorage.setItem('pinnedClients', JSON.stringify(favoriteIds))
    } catch (err) {
      console.error('[ClientManagement] Error fetching favorites:', err)
    }
  }
  
  // Deactivate client (soft delete)
  const handleDeactivateClient = async () => {
    if (!deletingClient) return
    setIsDeleting(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false, client_status: 'inactive' })
        .eq('id', deletingClient.id)
      
      if (error) throw error
      
      toast({
        title: 'Client deactivated',
        description: `${deletingClient.name} has been deactivated.`,
        variant: 'success',
      })
      setDeleteDialogOpen(false)
      setDeletingClient(null)
      fetchData(true)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to deactivate client.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  // Permanently delete client (hard delete)
  const handlePermanentDeleteClient = async () => {
    if (!deletingClient) return
    setIsDeleting(true)
    try {
      // Delete related data first
      await supabase.from('time_entries').delete().eq('client_id', deletingClient.id)
      await supabase.from('tickets').delete().eq('client_id', deletingClient.id)
      await supabase.from('boards').delete().eq('client_id', deletingClient.id)
      await supabase.from('client_notes').delete().eq('client_id', deletingClient.id)
      await supabase.from('activity_log').delete().eq('client_id', deletingClient.id)
      await supabase.from('client_wins').delete().eq('client_id', deletingClient.id)
      
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', deletingClient.id)
      
      if (error) throw error
      
      toast({
        title: '🗑️ Client permanently deleted',
        description: `${deletingClient.name} and all related data have been removed.`,
        variant: 'success',
      })
      setDeleteDialogOpen(false)
      setDeletingClient(null)
      fetchData(true)
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: 'Error deleting client',
        description: error.message || 'Failed to delete client.',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const togglePinClient = async (clientId) => {
    if (!user?.id) return
    
    const wasPinned = pinnedClients.includes(clientId)
    
    // Optimistic update
    const newPinned = wasPinned 
      ? pinnedClients.filter(id => id !== clientId)
      : [...pinnedClients, clientId]
    setPinnedClients(newPinned)
    localStorage.setItem('pinnedClients', JSON.stringify(newPinned))
    
    try {
      if (wasPinned) {
        // Remove from favorites
        const { error } = await supabase
          .from('user_favorite_clients')
          .delete()
          .eq('user_id', user.id)
          .eq('client_id', clientId)
        
        if (error) throw error
      } else {
        // Add to favorites
        const { error } = await supabase
          .from('user_favorite_clients')
          .insert({
            user_id: user.id,
            client_id: clientId,
          })
        
        if (error) throw error
      }
    } catch (err) {
      console.error('[ClientManagement] Error toggling favorite:', err)
      // Revert on error
      setPinnedClients(pinnedClients)
      localStorage.setItem('pinnedClients', JSON.stringify(pinnedClients))
      
      // If table doesn't exist, show helpful message
      if (err.message?.includes('does not exist') || err.message?.includes('schema cache')) {
        toast({
          title: 'Database update needed',
          description: 'Run supabase/fix-adspend-favorites.sql to enable persistent favorites',
          variant: 'destructive',
        })
      }
    }
  }
  
  const isPinned = (clientId) => pinnedClients.includes(clientId)
  
  // Dialogs
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  
  // Request form
  const [requestClient, setRequestClient] = useState('')
  const [requestType, setRequestType] = useState('general')
  const [requestTitle, setRequestTitle] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestPriority, setRequestPriority] = useState('medium')
  const [requestDueDate, setRequestDueDate] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [requestSaving, setRequestSaving] = useState(false)
  
  // Project form
  const [projectClient, setProjectClient] = useState('')
  const [projectTitle, setProjectTitle] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectCategory, setProjectCategory] = useState('')
  const [projectUrl, setProjectUrl] = useState('')
  const [projectImageUrl, setProjectImageUrl] = useState('')
  const [projectImageFile, setProjectImageFile] = useState(null)
  const [projectImageUploading, setProjectImageUploading] = useState(false)
  const [projectFeatured, setProjectFeatured] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)

  const [fetchError, setFetchError] = useState(null)
  const [sessionStale, setSessionStale] = useState(false)

  // Fetch data with timeout to prevent hanging
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)
    setFetchError(null)
    setSessionStale(false)

    // Validate session before fetching - this refreshes token if expiring
    const sessionValid = await ensureValidSession()
    if (!sessionValid) {
      console.warn('[ClientManagement] Session invalid, cannot fetch data')
      setFetchError('Session expired. Please refresh the page or log in again.')
      setSessionStale(true)
      setLoading(false)
      setRefreshing(false)
      return
    }

    // Add timeout to prevent hanging forever
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout - please try again')), 15000)
    )

    try {
      // Debug: Check session before fetching
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[ClientManagement] Session check:', {
        hasSession: !!session,
        user: session?.user?.email,
        expiresAt: session?.expires_at
      })
      
      // Fetch clients first - this is the main table we need
      const clientsPromise = supabase
        .from('clients')
        .select('*')
        .order('name')
      
      console.log('[ClientManagement] Fetching clients...')
      const clientsRes = await Promise.race([clientsPromise, timeout])
      console.log('[ClientManagement] Clients response:', clientsRes.data?.length || 0, 'clients', clientsRes.error?.message || '')
      
      if (clientsRes.error) {
        console.error('Clients fetch error:', clientsRes.error)
        // If table doesn't exist, show empty state so user can import
        if (clientsRes.error.message?.includes('does not exist')) {
          toast({
            title: '⚠️ Database setup needed',
            description: 'Run supabase/all-features-setup.sql to create tables',
            variant: 'destructive',
          })
        }
        setFetchError(clientsRes.error.message)
      }
      
      setClients(clientsRes.data || [])

      // Fetch additional data for client cards
      try {
        const additionalDataPromise = Promise.all([
          // Tickets (for task/request count)
          supabase
            .from('tickets')
            .select('id, client_id, status')
            .order('created_at', { ascending: false }),
          // Boards (for project count)
          supabase
            .from('boards')
            .select('id, client_id')
            .order('created_at', { ascending: false }),
          // Team assignments (for team member count per client)
          supabase
            .from('client_team_assignments')
            .select('id, client_id, user_id'),
          // Client wins - use simpler query first
          supabase
            .from('client_wins')
            .select('*')
            .order('created_at', { ascending: false }),
          getClientHoursSummary(),
        ])

        const [ticketsRes, boardsRes, teamAssignmentsRes, winsRes, hoursSummaryRes] = await Promise.race([additionalDataPromise, timeout])
        const usedMap = {}
        for (const row of hoursSummaryRes?.data || []) {
          if (!row?.client_id) continue
          usedMap[row.client_id] = Number(row.hours_used) || 0
        }
        setHoursUsedByClient(usedMap)

        console.log('[ClientManagement] Wins query result:', winsRes)
        
        setRequests(ticketsRes.data || []) // Use tickets as "Requests"
        setProjects(boardsRes.data || []) // Use boards as "Projects"
        setClientUsers(teamAssignmentsRes.data || []) // Use team assignments as "Users"
        
        // If wins data exists, enrich it with client/user info
        if (winsRes.data && winsRes.data.length > 0) {
          // Get client names for each win
          const enrichedWins = await Promise.all(winsRes.data.map(async (win) => {
            let clientName = 'Unknown Client'
            let userName = 'Unknown User'
            let userAvatar = null
            
            if (win.client_id) {
              const client = clients.find(c => c.id === win.client_id)
              if (client) clientName = client.name
            }
            
            if (win.user_id) {
              const { data: userData } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', win.user_id)
                .single()
              if (userData) {
                userName = userData.full_name
                userAvatar = userData.avatar_url
              }
            }
            
            return {
              ...win,
              client: { id: win.client_id, name: clientName },
              user: { id: win.user_id, full_name: userName, avatar_url: userAvatar }
            }
          }))
          setClientWins(enrichedWins)
        } else {
          setClientWins([])
        }
      } catch (err) {
        console.error('[ClientManagement] Error fetching client wins:', err)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setFetchError(error.message || 'Failed to load data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    // Don't fetch if auth is still loading
    if (authLoading) {
      console.log('[ClientManagement] Auth still loading, waiting...')
      return
    }

    // If no user after auth loaded, don't attempt fetch (will redirect to login)
    if (!user) {
      console.log('[ClientManagement] No user after auth loaded')
      setLoading(false)
      return
    }
    
    console.log('[ClientManagement] Auth ready, fetching data for:', user.email)
    fetchData()
    fetchFavorites() // Fetch user's favorite clients from database
  }, [authLoading, user?.id])

  useEffect(() => {
    setDirectoryPage(1)
  }, [searchQuery, statusFilter, clientTypeFilter])

  // Create request
  const handleCreateRequest = async () => {
    if (!requestClient || !requestTitle) {
      toast({ title: 'Please fill required fields', variant: 'destructive' })
      return
    }

    setRequestSaving(true)
    
    try {
      const { error } = await supabase.from('client_requests').insert({
        client_id: requestClient,
        title: requestTitle,
        description: requestDescription,
        type: requestType,
        priority: requestPriority,
        due_date: requestDueDate || null,
        created_by: user.id,
      })

      if (error) throw error

      // If sendEmail is checked, create email notification
      if (sendEmail) {
        const client = clients.find(c => c.id === requestClient)
        if (client?.contact_email) {
          await supabase.from('email_notifications').insert({
            recipient_email: client.contact_email,
            recipient_name: client.contact_name,
            subject: `Action Required: ${requestTitle}`,
            body: `Hello,\n\nWe need your input on: ${requestTitle}\n\n${requestDescription}\n\nPlease log in to your client portal to respond.\n\nThank you,\nThe Brandastic Team`,
            type: 'request',
            status: 'pending',
          })
        }
      }

      toast({ title: 'Request created!', variant: 'success' })
      setRequestDialogOpen(false)
      resetRequestForm()
      fetchData(true)
    } catch (error) {
      toast({ title: 'Error creating request', variant: 'destructive' })
    } finally {
      setRequestSaving(false)
    }
  }

  const resetRequestForm = () => {
    setRequestClient('')
    setRequestType('general')
    setRequestTitle('')
    setRequestDescription('')
    setRequestPriority('medium')
    setRequestDueDate('')
    setSendEmail(true)
  }

  // Create project
  const handleCreateProject = async () => {
    if (!projectClient || !projectTitle) {
      toast({ title: 'Please fill required fields', variant: 'destructive' })
      return
    }

    setProjectSaving(true)
    
    try {
      const { error } = await supabase.from('client_projects').insert({
        client_id: projectClient,
        title: projectTitle,
        description: projectDescription,
        category: projectCategory,
        url: projectUrl || null,
        image_url: projectImageUrl || null,
        is_featured: projectFeatured,
        is_visible_to_client: true,
      })

      if (error) throw error

      toast({ title: '🎉 Win shared with the team!', variant: 'success' })
      setProjectDialogOpen(false)
      resetProjectForm()
      fetchData(true)
    } catch (error) {
      toast({ title: 'Error adding project', variant: 'destructive' })
    } finally {
      setProjectSaving(false)
    }
  }

  const resetProjectForm = () => {
    setProjectClient('')
    setProjectTitle('')
    setProjectDescription('')
    setProjectCategory('')
    setProjectUrl('')
    setProjectImageUrl('')
    setProjectImageFile(null)
    setProjectFeatured(false)
  }

  // Filter by status
  const activeClients = clients.filter((c) => c.is_active !== false && c.client_status !== 'prospect')
  const inactiveClients = clients.filter((c) => c.is_active === false)
  const prospectClients = clients.filter((c) => c.client_status === 'prospect')
  
  const clientsByStatus = statusFilter === 'active' 
    ? activeClients 
    : statusFilter === 'inactive' 
      ? inactiveClients 
      : statusFilter === 'prospect'
        ? prospectClients
        : clients

  const filteredClients = clientsByStatus
    .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(c => clientTypeFilter === 'all' || c.client_type === clientTypeFilter)
    .sort((a, b) => {
      // Pinned clients first
      const aPinned = pinnedClients.includes(a.id)
      const bPinned = pinnedClients.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return a.name.localeCompare(b.name)
    })

  const filteredActiveCount = filteredClients.filter((c) => c.is_active !== false && c.client_status !== 'prospect').length
  const filteredMonthlyRevenue = filteredClients.reduce((sum, c) => sum + getClientMonthlyRevenue(c), 0)
  const filteredMonthlyHours = filteredClients.reduce((sum, c) => sum + (Number(c.monthly_hours) || 0), 0)
  const directoryPageCount = Math.max(1, Math.ceil(filteredClients.length / DIRECTORY_PAGE_SIZE))
  const safeDirectoryPage = Math.min(directoryPage, directoryPageCount)
  const directoryStart = filteredClients.length === 0 ? 0 : (safeDirectoryPage - 1) * DIRECTORY_PAGE_SIZE
  const visibleClients = filteredClients.slice(directoryStart, directoryStart + DIRECTORY_PAGE_SIZE)
  const directoryEnd = directoryStart + visibleClients.length

  const rememberDirectoryView = (view) => {
    setDirectoryView(view)
    try {
      localStorage.setItem(DIRECTORY_VIEW_KEY, view)
    } catch {
      // ignore storage errors
    }
  }

  const pendingRequests = requests.filter(r => r.status === 'pending')

  // Handle reconnecting when session is stale
  const handleReconnect = async () => {
    setRefreshing(true)
    try {
      // Force a full session refresh
      const { data, error } = await supabase.auth.refreshSession()
      if (error) {
        // If refresh fails, user needs to log in again
        toast({
          title: 'Session expired',
          description: 'Please log in again to continue.',
          variant: 'destructive',
        })
        // Redirect to login after a moment
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      if (data?.session) {
        toast({ title: 'Reconnected!', description: 'Loading your data...' })
        setSessionStale(false)
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

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  // Show reconnect UI when session is stale
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
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white">Clients</h1>
            <p className="text-sm text-slate-500 dark:text-white/50 mt-1">
              Compare retainers, hours, and status across the book
            </p>
          </div>
          <div className="flex w-full sm:w-auto items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* No Clients Banner - Shows prominently at top */}
      {activeClients.length === 0 && (
        <motion.div
          variants={itemVariants}
          className="mb-8 p-6 rounded-2xl border-2 border-dashed border-brand-orange/40 bg-gradient-to-r from-brand-orange/10 to-brand-coral/10"
        >
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-orange to-brand-coral flex items-center justify-center">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold mb-2">
                🚀 Import Your Brandastic Clients
              </h2>
              <p className="text-slate-500 dark:text-white/50 mb-1">
                Get started by importing all 22 Brandastic clients with their monthly hours, billing rates, and project data.
              </p>
              <p className="text-sm text-slate-500 dark:text-white/50">
                Includes: Calops ($21k), Prudental Labs ($11k), Salvin, Check'n Play, DESS USA, and more...
              </p>
            </div>
            <Button
              size="lg"
              onClick={async () => {
                setRefreshing(true)
                try {
                  const results = await seedSampleClients()
                  toast({
                    title: '🎉 Clients Imported Successfully!',
                    description: `Added ${results.clients.length} clients with ${results.boards.length} boards and ${results.tickets.length} tickets`,
                    variant: 'success',
                  })
                  fetchData(true)
                } catch (error) {
                  console.error('Import error:', error)
                  toast({
                    title: '❌ Import Failed',
                    description: error.message || 'Make sure the database tables exist. Check console for details.',
                    variant: 'destructive',
                  })
                  setRefreshing(false)
                }
              }}
              disabled={refreshing}
              className="bg-gradient-to-r from-brand-orange to-brand-coral text-white shadow-lg shadow-brand-orange/25 hover:shadow-xl hover:shadow-brand-orange/30 transition-all px-8"
            >
              {refreshing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5 mr-2" />
                  Import 22 Clients Now
                </>
              )}
            </Button>
          </div>
        </motion.div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-100 dark:bg-slate-800/50">
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            <Bell className="h-4 w-4" />
            Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-brand-orange text-white">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="wins" className="gap-2">
            <Trophy className="h-4 w-4" />
            Client Wins
          </TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader className="min-w-0 overflow-hidden pb-4">
              <div className="flex flex-col gap-4 min-w-0">
                <div className="flex flex-wrap gap-2 items-center min-w-0">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-brand-orange to-brand-coral w-full sm:w-auto order-last sm:order-none"
                    onClick={() => setClientDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                  <div className="relative w-full min-w-0 sm:flex-1 sm:min-w-[220px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-white/50" />
                    <Input
                      placeholder="Search clients... (⌘K)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full min-w-[8rem] sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        <div className="flex items-center gap-2">
                          <Play className="h-3 w-3 text-green-500" />
                          Active ({activeClients.length})
                        </div>
                      </SelectItem>
                      <SelectItem value="prospect">
                        <div className="flex items-center gap-2">
                          <Target className="h-3 w-3 text-purple-500" />
                          Prospects ({prospectClients.length})
                        </div>
                      </SelectItem>
                      <SelectItem value="inactive">
                        <div className="flex items-center gap-2">
                          <Pause className="h-3 w-3 text-amber-500" />
                          Inactive ({inactiveClients.length})
                        </div>
                      </SelectItem>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3 w-3 text-slate-500 dark:text-white/50" />
                          All ({clients.length})
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={clientTypeFilter} onValueChange={setClientTypeFilter}>
                    <SelectTrigger className="w-full min-w-[8rem] sm:w-40">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Filter className="h-3 w-3 text-slate-500" />
                          All Types
                        </div>
                      </SelectItem>
                      {CLIENT_TYPE_OPTIONS.map((option) => {
                        const Icon = option.icon
                        const count = clients.filter(c => c.client_type === option.value).length
                        return (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-3 w-3", option.colors.icon)} />
                              {option.label} ({count})
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>

                  <div className="inline-flex rounded-lg border border-slate-200 dark:border-white/10 p-0.5 bg-slate-50 dark:bg-white/5">
                    <button
                      type="button"
                      onClick={() => rememberDirectoryView('table')}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                        directoryView === 'table'
                          ? "bg-white dark:bg-[#0d1d35] text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      <Table2 className="h-4 w-4" />
                      Table
                    </button>
                    <button
                      type="button"
                      onClick={() => rememberDirectoryView('cards')}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors",
                        directoryView === 'cards'
                          ? "bg-white dark:bg-[#0d1d35] text-slate-900 dark:text-white shadow-sm"
                          : "text-slate-500 dark:text-white/50 hover:text-slate-800 dark:hover:text-white"
                      )}
                    >
                      <LayoutGrid className="h-4 w-4" />
                      Cards
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <EmptyClientsState onImport={async () => {
                  setRefreshing(true)
                  try {
                    const results = await seedSampleClients()
                    toast({
                      title: '🎉 Clients Imported!',
                      description: `Added ${results.clients.length} clients with ${results.boards.length} boards`,
                      variant: 'success',
                    })
                    fetchData(true)
                  } catch (error) {
                    toast({
                      title: 'Error importing clients',
                      description: error.message,
                      variant: 'destructive',
                    })
                    setRefreshing(false)
                  }
                }} loading={refreshing} />
              ) : (
              <>
              {filteredClients.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mx-auto mb-4">
                    {statusFilter === 'inactive' ? (
                      <Pause className="h-8 w-8 text-amber-500" />
                    ) : statusFilter === 'active' ? (
                      <Play className="h-8 w-8 text-green-500" />
                    ) : statusFilter === 'prospect' ? (
                      <Target className="h-8 w-8 text-purple-500" />
                    ) : (
                      <Building2 className="h-8 w-8 text-slate-500 dark:text-white/50" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">
                    {searchQuery
                      ? 'No matching clients found'
                      : statusFilter === 'inactive'
                        ? 'No inactive clients'
                        : statusFilter === 'active'
                          ? 'No active clients'
                          : statusFilter === 'prospect'
                            ? 'No prospects yet'
                            : 'No clients found'
                    }
                  </h3>
                  <p className="text-slate-500 dark:text-white/50 text-sm mb-4">
                    {searchQuery
                      ? `No clients match "${searchQuery}" in the ${statusFilter} filter.`
                      : statusFilter === 'inactive'
                        ? 'All your clients are currently active.'
                        : statusFilter === 'active'
                          ? 'Try switching to "All" or "Prospects" to see other clients.'
                          : statusFilter === 'prospect'
                            ? 'Add a prospect to start your sales pipeline.'
                            : 'Import clients to get started.'
                    }
                  </p>
                  {(statusFilter !== 'all' || searchQuery || clientTypeFilter !== 'all') && statusFilter !== 'prospect' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all')
                        setSearchQuery('')
                        setClientTypeFilter('all')
                      }}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
              <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                <p className="text-sm text-slate-500 dark:text-white/50">
                  Showing {directoryStart + 1}–{directoryEnd} of {filteredClients.length} clients
                </p>
              </div>

              {directoryView === 'table' ? (
                <div className="overflow-auto max-h-[70vh] rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-[#12243d] border-b border-slate-200 dark:border-white/10">
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-white/50">
                        <th className="px-4 py-3 font-semibold">Client</th>
                        <th className="px-4 py-3 font-semibold">Services</th>
                        <th className="px-4 py-3 font-semibold text-right">Monthly</th>
                        <th className="px-4 py-3 font-semibold text-right">Hours</th>
                        <th className="px-4 py-3 font-semibold text-right">Used</th>
                        <th className="px-4 py-3 font-semibold text-right">Remaining</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleClients.map((client) => {
                        const hoursStats = getClientHoursStats(client, hoursUsedByClient)
                        const status = getDirectoryStatus(client, hoursStats)
                        const monthlyRevenue = getClientMonthlyRevenue(client)
                        return (
                          <tr
                            key={client.id}
                            className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50/80 dark:hover:bg-white/5"
                          >
                            <td className="px-4 py-3">
                              <Link to={`/clients/${client.slug || client.id}`} className="flex items-center gap-3 min-w-0">
                                <ClientMark client={client} size="sm" />
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 dark:text-white truncate">{client.name}</p>
                                  <p className="text-xs text-slate-400 dark:text-white/40">{getClientTypeConfig(client.client_type).label}</p>
                                </div>
                              </Link>
                            </td>
                            <td className="px-4 py-3">
                              <ServiceChips services={client.account_services} />
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-900 dark:text-white">
                              ${monthlyRevenue.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">{formatHoursValue(hoursStats.hours)}h</td>
                            <td className="px-4 py-3 text-right">{formatHoursValue(hoursStats.used)}h</td>
                            <td className={cn("px-4 py-3 text-right", hoursStats.remaining < 0 && "text-amber-600")}>
                              {formatHoursValue(hoursStats.remaining)}h
                            </td>
                            <td className="px-4 py-3">
                              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", directoryStatusClasses(status.tone))}>
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {visibleClients.map((client) => {
                    const hoursStats = getClientHoursStats(client, hoursUsedByClient)
                    const status = getDirectoryStatus(client, hoursStats, { allowNotStarted: true })
                    const monthlyRevenue = getClientMonthlyRevenue(client)
                    const utilizationPct = hoursStats.hours > 0 ? Math.max(0, hoursStats.percentage || 0) : 0
                    const barWidth = Math.min(100, utilizationPct)
                    return (
                      <Link
                        key={client.id}
                        to={`/clients/${client.slug || client.id}`}
                        className="block"
                      >
                        <div
                          className={cn(
                            "p-4 rounded-xl border bg-white dark:bg-[#0d1d35] hover:border-brand-orange/30 hover:shadow-sm transition-all h-full",
                            client.is_active === false && "opacity-75 border-dashed"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <ClientMark client={client} />
                              <div className="min-w-0">
                                <h3 className="font-semibold text-slate-900 dark:text-white truncate">{client.name}</h3>
                                <ServiceChips services={client.account_services} />
                              </div>
                            </div>
                            <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", directoryStatusClasses(status.tone))}>
                              {status.label}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/50">Monthly Retainer</p>
                              <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                                ${monthlyRevenue.toLocaleString()} · {formatHoursValue(hoursStats.hours)} hours
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-white/50 mb-1.5">Utilization</p>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-700 dark:text-white/80">{formatHoursValue(hoursStats.used)}h used</span>
                                <span className="font-medium text-slate-900 dark:text-white">{utilizationPct}%</span>
                              </div>
                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
                                <div
                                  className={cn("h-full rounded-full transition-all", getUtilizationBarClass(hoursStats))}
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <p className={cn("mt-1.5 text-sm", hoursStats.remaining < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500 dark:text-white/50")}>
                                {formatHoursValue(hoursStats.remaining)}h remaining
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              )}

              {filteredClients.length > DIRECTORY_PAGE_SIZE && (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500 dark:text-white/50">
                    Page {safeDirectoryPage} of {directoryPageCount}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeDirectoryPage <= 1}
                      onClick={() => setDirectoryPage((page) => Math.max(1, page - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safeDirectoryPage >= directoryPageCount}
                      onClick={() => setDirectoryPage((page) => Math.min(directoryPageCount, page + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
              </>
              )}

              <div className="mt-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border">
                <div className="flex flex-wrap gap-6 justify-center text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{filteredActiveCount}</p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Active clients</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-brand-orange">
                      ${filteredMonthlyRevenue.toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Monthly revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {formatHoursValue(filteredMonthlyHours)}h
                    </p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Total monthly hours</p>
                  </div>
                </div>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-900 dark:text-white">Client Requests</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-white/50">Track approvals, assets, and feedback from clients</CardDescription>
                </div>
                <Button onClick={() => setRequestDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-white/50">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No requests yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setRequestDialogOpen(true)}>
                    Create your first request
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((request) => {
                    const typeConfig = REQUEST_TYPES.find(t => t.value === request.type) || REQUEST_TYPES[6]
                    const Icon = typeConfig.icon
                    
                    return (
                      <div
                        key={request.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border hover:bg-slate-100 dark:bg-slate-800/50 transition-colors",
                          request.status === 'pending' && "border-brand-orange/30 bg-brand-orange/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50", typeConfig.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{request.title}</p>
                              <Badge variant="outline">{request.client?.name}</Badge>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-white/50">
                              {typeConfig.label} • {formatRelativeDate(new Date(request.created_at))}
                              {request.due_date && ` • Due ${formatDate(request.due_date)}`}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={request.status === 'pending' ? 'default' : 'secondary'}
                          className={request.status === 'pending' ? 'bg-brand-orange' : ''}
                        >
                          {request.status}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Client Wins Tab */}
        <TabsContent value="wins">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    🏆 Client Wins
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-white/50">Celebrate team achievements and client successes</CardDescription>
                </div>
                <Button onClick={() => setProjectDialogOpen(true)} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                  <Trophy className="h-4 w-4 mr-2" />
                  Share a Win
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {clientWins.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-white/50">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30 text-yellow-500" />
                  <p className="text-lg font-medium mb-1">No wins shared yet</p>
                  <p className="text-sm mb-4">Be the first to celebrate a client success!</p>
                  <Button className="bg-yellow-500 hover:bg-yellow-600" onClick={() => setProjectDialogOpen(true)}>
                    <PartyPopper className="h-4 w-4 mr-2" />
                    Share Your First Win
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clientWins.map((win) => (
                    <motion.div
                      key={win.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-5 rounded-xl border-2 border-yellow-200 dark:border-yellow-900/30 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 hover:shadow-lg transition-all group"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-lg bg-yellow-500/20">
                            <Trophy className="h-5 w-5 text-yellow-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-lg">{win.title}</h3>
                            <p className="text-sm text-slate-500 dark:text-white/50">{win.client?.name}</p>
                          </div>
                        </div>
                        {win.is_featured && (
                          <Badge className="bg-yellow-500 text-white">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      
                      {win.description && (
                        <p className="text-sm text-slate-500 dark:text-white/50 mb-3 line-clamp-2">{win.description}</p>
                      )}
                      
                      {win.image_url && (
                        <img 
                          src={win.image_url} 
                          alt={win.title}
                          className="w-full h-32 object-cover rounded-lg mb-3 border"
                        />
                      )}
                      
                      {win.category && win.category !== 'general' && (
                        <Badge variant="outline" className="mb-3 bg-white/50 dark:bg-white/10">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {win.category.replace('_', ' ')}
                        </Badge>
                      )}
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800/30">
                        <div className="flex items-center gap-2">
                          {win.user && (
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={win.user.avatar_url} />
                              <AvatarFallback className="text-[10px]">{win.user.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="text-xs text-slate-500 dark:text-white/50">
                            {win.user?.full_name} • {win.created_at ? formatRelativeDate(new Date(win.created_at)) : 'Recently'}
                          </span>
                        </div>
                        {win.client?.id && (
                          <Button variant="ghost" size="sm" asChild className="text-yellow-600 hover:text-yellow-700">
                            <Link to={`/clients/${win.client.id}`}>
                              View Client
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Client invite dialog removed - using shareable link for now */}

      {/* New Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={(open) => {
        setRequestDialogOpen(open)
        if (!open) resetRequestForm()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-orange" />
              Create Client Request
            </DialogTitle>
            <DialogDescription>
              Request approvals, assets, or feedback from a client
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client *</Label>
                <Select value={requestClient} onValueChange={setRequestClient}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeClients.map(client => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={requestType} onValueChange={setRequestType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className={cn("h-4 w-4", type.color)} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="e.g., Approve homepage design"
                value={requestTitle}
                onChange={(e) => setRequestTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Provide details about what you need..."
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={requestDueDate}
                onChange={(e) => setRequestDueDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
              <input
                type="checkbox"
                id="sendEmail"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="sendEmail" className="text-sm cursor-pointer">
                Send email notification to client
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateRequest} disabled={requestSaving || !requestClient || !requestTitle}>
              {requestSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share a Win Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={(open) => {
        setProjectDialogOpen(open)
        if (!open) resetProjectForm()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Share a Client Win 🎉
            </DialogTitle>
            <DialogDescription>
              Celebrate a success! Share great results, milestones, or achievements.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={projectClient} onValueChange={setProjectClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Which client is this win for?" />
                </SelectTrigger>
                <SelectContent>
                  {activeClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Win Title *</Label>
              <Input
                placeholder="e.g., 150% increase in conversions!"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Category / Type</Label>
              <Select value={projectCategory} onValueChange={setProjectCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select win type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Conversion Rate">📈 Conversion Rate</SelectItem>
                  <SelectItem value="Traffic Growth">🚀 Traffic Growth</SelectItem>
                  <SelectItem value="ROI / ROAS">💰 ROI / ROAS</SelectItem>
                  <SelectItem value="Lead Generation">🎯 Lead Generation</SelectItem>
                  <SelectItem value="Campaign Performance">📊 Campaign Performance</SelectItem>
                  <SelectItem value="SEO Rankings">🔍 SEO Rankings</SelectItem>
                  <SelectItem value="Social Engagement">💬 Social Engagement</SelectItem>
                  <SelectItem value="Client Milestone">🏆 Client Milestone</SelectItem>
                  <SelectItem value="Project Launch">🎉 Project Launch</SelectItem>
                  <SelectItem value="Other">✨ Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Details / Story</Label>
              <Textarea
                placeholder="Share the details! What did we achieve? What was the result?"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Screenshot / Image (optional)</Label>
              {projectImageUrl ? (
                <div className="relative rounded-lg border overflow-hidden">
                  <img 
                    src={projectImageUrl} 
                    alt="Win screenshot" 
                    className="w-full h-32 object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setProjectImageUrl('')
                      setProjectImageFile(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                    "hover:border-brand-orange/50 hover:bg-brand-orange/5",
                    projectImageUploading && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => document.getElementById('win-image-upload')?.click()}
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
                    setProjectImageUploading(true)
                    try {
                      const fileName = `wins/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                      const { error: uploadError } = await supabase.storage
                        .from('images')
                        .upload(fileName, file, { cacheControl: '3600', upsert: false })
                      if (uploadError) throw uploadError
                      const { data: { publicUrl } } = supabase.storage
                        .from('images')
                        .getPublicUrl(fileName)
                      setProjectImageUrl(publicUrl)
                      setProjectImageFile(file)
                      toast({ title: '📸 Image uploaded!', variant: 'success' })
                    } catch (err) {
                      console.error('Upload error:', err)
                      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
                    } finally {
                      setProjectImageUploading(false)
                    }
                  }}
                >
                  <input
                    id="win-image-upload"
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
                      setProjectImageUploading(true)
                      try {
                        const fileName = `wins/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
                        const { error: uploadError } = await supabase.storage
                          .from('images')
                          .upload(fileName, file, { cacheControl: '3600', upsert: false })
                        if (uploadError) throw uploadError
                        const { data: { publicUrl } } = supabase.storage
                          .from('images')
                          .getPublicUrl(fileName)
                        setProjectImageUrl(publicUrl)
                        setProjectImageFile(file)
                        toast({ title: '📸 Image uploaded!', variant: 'success' })
                      } catch (err) {
                        console.error('Upload error:', err)
                        toast({ title: 'Upload failed', description: err.message, variant: 'destructive' })
                      } finally {
                        setProjectImageUploading(false)
                        e.target.value = ''
                      }
                    }}
              />
                  {projectImageUploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
                      <p className="text-sm text-slate-500 dark:text-white/50">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800/50">
                        <Upload className="h-6 w-6 text-slate-500 dark:text-white/50" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Drag & drop or click to upload</p>
                        <p className="text-xs text-slate-500 dark:text-white/50">PNG, JPG, GIF, or PDF (max 10MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Link to Report/Dashboard (optional)</Label>
              <Input
                placeholder="https://analytics.google.com/..."
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <input
                type="checkbox"
                id="featured"
                checked={projectFeatured}
                onChange={(e) => setProjectFeatured(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="featured" className="text-sm cursor-pointer flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Feature this win (show at top)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreateProject} 
              disabled={projectSaving || !projectClient || !projectTitle}
              className="bg-yellow-500 hover:bg-yellow-600"
            >
              {projectSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PartyPopper className="h-4 w-4 mr-2" />}
              Share Win
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        onSuccess={() => {
          fetchData(true)
          setClientDialogOpen(false)
        }}
      />

      {/* Delete Client Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Remove Client: {deletingClient?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 py-4">
            {/* Deactivate Option */}
            <button 
              className="w-full p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 cursor-pointer hover:border-amber-400 transition-colors text-left"
              onClick={handleDeactivateClient}
              disabled={isDeleting}
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
              disabled={isDeleting}
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
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="w-full" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
    </div>
  )
}
