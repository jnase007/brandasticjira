import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Building2, Users, Plus, Search, Bell, MessageSquare, Calendar,
  Send, Mail, Copy, CheckCircle, Clock, AlertTriangle, ExternalLink,
  ThumbsUp, Image, FileText, Trash2, Edit2, Eye, Star, Loader2,
  ChevronRight, Filter, RefreshCw, Award, Sparkles, Zap, ArrowRight,
  Trophy, TrendingUp, PartyPopper, Upload, X, Pause, Play, Target,
  DollarSign, Briefcase, ArrowRightCircle, Phone, GripVertical
} from 'lucide-react'
import { supabase, seedSampleClients, ensureValidSession } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, formatRelativeDate, getInitials } from '../lib/utils'
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
        ])

        const [ticketsRes, boardsRes, teamAssignmentsRes, winsRes] = await Promise.race([additionalDataPromise, timeout])

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
    .sort((a, b) => {
      // Pinned clients first
      const aPinned = pinnedClients.includes(a.id)
      const bPinned = pinnedClients.includes(b.id)
      if (aPinned && !bPinned) return -1
      if (!aPinned && bPinned) return 1
      return a.name.localeCompare(b.name)
    })

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

  // Handle pipeline drag and drop
  const handlePipelineDragEnd = async (result) => {
    if (!result.destination) return
    
    const { draggableId, source, destination } = result
    if (source.droppableId === destination.droppableId) return
    
    const newStage = destination.droppableId
    const clientId = draggableId
    
    // Optimistic update
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
        variant: 'success' 
      })
    } catch (error) {
      console.error('Error updating pipeline:', error)
      toast({ title: 'Failed to update pipeline', variant: 'destructive' })
      fetchData() // Revert on error
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
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-slate-900 dark:text-white">Client Management</h1>
            </div>
            <p className="text-sm sm:text-lg text-slate-500 dark:text-white/50">
              Manage client relationships, requests, and portfolios
            </p>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
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
              className="bg-gradient-to-r from-brand-orange to-brand-coral flex-1 sm:flex-none"
              onClick={() => setClientDialogOpen(true)}
            >
              <Plus className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Add Client</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={containerVariants} className="grid gap-4 grid-cols-2 md:grid-cols-5 mb-8">
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-white/50">Active Clients</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {activeClients.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

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
                    ${prospectClients.reduce((sum, c) => sum + (Number(c.estimated_budget) || 0), 0).toLocaleString()}
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
                <div className="p-2 rounded-xl bg-yellow-500/10">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-white/50">Client Wins 🎉</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {clientWins.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={cn("bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm", pendingRequests.length > 0 && "border-brand-orange/30 bg-brand-orange/5")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Bell className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-white/50">Pending Requests</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {pendingRequests.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
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
          <TabsTrigger value="pipeline" className="gap-2">
            <Target className="h-4 w-4" />
            Sales Pipeline
            {prospectClients.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-purple-500 text-white">
                {prospectClients.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-slate-900 dark:text-white">Client Directory</CardTitle>
                  <CardDescription className="text-slate-500 dark:text-white/50">All clients with portal access</CardDescription>
                </div>
                <div className="flex gap-3 items-center">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 dark:text-white/50" />
                    <Input
                      placeholder="Search clients... (⌘K)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-40">
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
                  {(statusFilter !== 'all' || searchQuery) && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setStatusFilter('all')
                        setSearchQuery('')
                      }}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Clear Filters
                    </Button>
                  )}
                </div>
              ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredClients.map((client) => {
                  // Count unique team members assigned to this client
                  const clientTeamCount = clientUsers.filter(u => u.client_id === client.id).length
                  // Count tickets/tasks for this client (exclude closed ones for active count)
                  const clientTicketCount = requests.filter(r => r.client_id === client.id && r.status !== 'closed').length
                  // Count boards/projects for this client
                  const clientProjectCount = projects.filter(p => p.client_id === client.id).length
                  const monthlyRevenue = (client.monthly_hours || 0) * 175
                  
                  return (
                    <Link
                      key={client.id}
                      to={`/clients/${client.slug || client.id}`}
                      className="block"
                    >
                    <motion.div
                      variants={itemVariants}
                      whileHover={{ y: -2 }}
                      className={cn(
                        "p-4 rounded-xl border hover:shadow-lg hover:border-brand-orange/30 transition-all bg-white dark:bg-[#0d1d35] group relative",
                        isPinned(client.id) && "ring-2 ring-yellow-400/50 border-yellow-400/30",
                        client.is_active === false && "opacity-75 border-dashed"
                      )}
                    >
                      {/* Action buttons - top right */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        {/* Pin button */}
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            togglePinClient(client.id)
                          }}
                          className={cn(
                            "p-1.5 rounded-lg transition-all",
                            isPinned(client.id) 
                              ? "bg-yellow-500 text-white" 
                              : "bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 opacity-0 group-hover:opacity-100 hover:bg-yellow-500 hover:text-white"
                          )}
                          title={isPinned(client.id) ? "Unpin client" : "Pin client"}
                        >
                          <Star className={cn("h-4 w-4", isPinned(client.id) && "fill-current")} />
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-3">
                        {client.logo_url ? (
                          <img
                            src={client.logo_url}
                            alt={client.name}
                            className="h-12 w-12 rounded-xl object-contain bg-white border"
                          />
                        ) : (
                          <div
                            className="h-12 w-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                            style={{ backgroundColor: client.color || '#F7931E' }}
                          >
                            {client.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">{client.name}</h3>
                            {client.ticket_prefix && (
                              <Badge variant="outline" className="text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0 font-mono">
                                {client.ticket_prefix}
                              </Badge>
                            )}
                            {client.is_active === false && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-[10px] px-1.5 py-0">
                                <Pause className="h-2.5 w-2.5 mr-0.5" />
                                {client.deactivated_at 
                                  ? `Inactive ${formatDate(client.deactivated_at)}`
                                  : 'Inactive'
                                }
                              </Badge>
                            )}
                          </div>
                          {client.account_services && client.account_services.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {client.account_services.slice(0, 2).map((service, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50">
                                  {service}
                                </span>
                              ))}
                              {client.account_services.length > 2 && (
                                <span className="text-[10px] text-slate-500 dark:text-white/50">
                                  +{client.account_services.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Monthly Stats */}
                      <div className="p-3 rounded-lg bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 mb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-slate-500 dark:text-white/50">Monthly</p>
                            <p className="font-bold text-green-600">${monthlyRevenue.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-slate-500 dark:text-white/50">Hours</p>
                            <p className="font-bold">{client.monthly_hours || 0}h</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                          <p className="font-semibold">{clientTeamCount}</p>
                          <p className="text-[10px] text-slate-500 dark:text-white/50">Team</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                          <p className="font-semibold">{clientTicketCount}</p>
                          <p className="text-[10px] text-slate-500 dark:text-white/50">Tasks</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                          <p className="font-semibold">{clientProjectCount}</p>
                          <p className="text-[10px] text-slate-500 dark:text-white/50">Boards</p>
                        </div>
                      </div>
                      
                      {/* Contact & View Link */}
                      <div className="flex items-center justify-between mt-3">
                        {client.contact_email ? (
                          <p className="text-xs text-slate-500 dark:text-white/50 truncate flex-1">
                            📧 {client.contact_email}
                          </p>
                        ) : (
                          <div />
                        )}
                        <span className="text-xs text-brand-orange font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          View Dashboard <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </motion.div>
                    </Link>
                  )
                })}
              </div>
              )}
              
              {/* Summary Footer */}
              <div className="mt-6 p-4 rounded-xl bg-slate-100 dark:bg-slate-800/50 border">
                <div className="flex flex-wrap gap-6 justify-center text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{activeClients.length}</p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Active</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-500">{inactiveClients.length}</p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Paused</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-brand-orange">
                      ${activeClients.reduce((sum, c) => sum + ((c.monthly_hours || 0) * 175), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Monthly Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {activeClients.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)}h
                    </p>
                    <p className="text-sm text-slate-500 dark:text-white/50">Total Hours/Month</p>
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

        {/* Sales Pipeline Tab */}
        <TabsContent value="pipeline">
          <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
                    <Target className="h-5 w-5 text-purple-500" />
                    Sales Pipeline
                  </CardTitle>
                  <CardDescription className="text-slate-500 dark:text-white/50">Track prospects through your sales process</CardDescription>
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
                    {/* Pipeline Columns */}
                    {[
                      { id: 'lead', title: 'Lead', color: 'bg-gray-400', icon: Target },
                      { id: 'kickoff', title: 'Kickoff', color: 'bg-blue-500', icon: Phone },
                      { id: 'proposal', title: 'Proposal', color: 'bg-purple-500', icon: FileText },
                      { id: 'contract', title: 'Contract', color: 'bg-orange-500', icon: Briefcase },
                      { id: 'won', title: 'Won', color: 'bg-green-500', icon: CheckCircle },
                      { id: 'lost', title: 'Lost', color: 'bg-red-500', icon: X },
                    ].map(stage => {
                      const stageClients = prospectClients.filter(c => c.pipeline_stage === stage.id)
                      return (
                        <div key={stage.id} className="flex flex-col min-w-[220px] w-[220px] flex-shrink-0">
                          {/* Column Header */}
                          <div className="flex items-center justify-between mb-3 px-1">
                            <div className="flex items-center gap-2">
                              <div className={cn("w-2 h-2 rounded-full", stage.color)} />
                              <h3 className="font-semibold text-sm">{stage.title}</h3>
                              <Badge variant="secondary" className="text-xs">
                                {stageClients.length}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Column Content - Droppable */}
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
                                          
                                          {/* Mobile: Stage dropdown (visible on small screens) */}
                                          <div className="mt-2 md:hidden">
                                            <Select 
                                              value={client.pipeline_stage || 'lead'}
                                              onValueChange={(newStage) => {
                                                // Update optimistically
                                                setClients(prev => prev.map(c => 
                                                  c.id === client.id ? { ...c, pipeline_stage: newStage } : c
                                                ))
                                                // Save to database
                                                supabase
                                                  .from('clients')
                                                  .update({ pipeline_stage: newStage })
                                                  .eq('id', client.id)
                                                  .then(({ error }) => {
                                                    if (error) {
                                                      toast({ title: 'Failed to update', variant: 'destructive' })
                                                      fetchData()
                                                    } else {
                                                      toast({ 
                                                        title: 'Stage updated', 
                                                        description: `Moved to ${newStage}`,
                                                        variant: 'success' 
                                                      })
                                                    }
                                                  })
                                              }}
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
              
              {/* Pipeline Summary */}
              {prospectClients.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-purple-500" />
                      <span className="text-sm">
                        <strong>{prospectClients.length}</strong> prospects in pipeline
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>${prospectClients.reduce((sum, c) => sum + (Number(c.estimated_budget) || 0), 0).toLocaleString()}</strong> potential value
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-sm">
                        <strong>{prospectClients.filter(c => c.pipeline_stage === 'won').length}</strong> won
                      </span>
                    </div>
                  </div>
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
