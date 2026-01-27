import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Plus, Search, Bell, MessageSquare, Calendar,
  Send, Mail, Copy, CheckCircle, Clock, AlertTriangle, ExternalLink,
  ThumbsUp, Image, FileText, Trash2, Edit2, Eye, Star, Loader2,
  ChevronRight, Filter, RefreshCw, Award, Sparkles, Zap, ArrowRight,
  Trophy, TrendingUp, PartyPopper, Upload, X
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
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
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
      <div className="mt-6 p-4 rounded-xl bg-muted/50 max-w-lg mx-auto">
        <p className="text-sm text-muted-foreground">
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
  
  // Data
  const [clients, setClients] = useState([])
  const [requests, setRequests] = useState([])
  const [projects, setProjects] = useState([])
  const [clientUsers, setClientUsers] = useState([])
  
  // Pinned/favorite clients (stored in database for persistence)
  const [pinnedClients, setPinnedClients] = useState([])
  const [favoritesLoading, setFavoritesLoading] = useState(false)
  
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
      // Fetch clients first - this is the main table we need
      const clientsPromise = supabase
        .from('clients')
        .select('*')
        .order('name')
      
      console.log('[ClientManagement] Fetching clients...')
      const clientsRes = await Promise.race([clientsPromise, timeout])
      console.log('[ClientManagement] Clients response:', clientsRes.data?.length || 0, 'clients')
      
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
        ])

        const [ticketsRes, boardsRes, teamAssignmentsRes] = await Promise.race([additionalDataPromise, timeout])

        setRequests(ticketsRes.data || []) // Use tickets as "Requests"
        setProjects(boardsRes.data || []) // Use boards as "Projects"
        setClientUsers(teamAssignmentsRes.data || []) // Use team assignments as "Users"
      } catch (err) {
        console.log('Optional tables not ready:', err)
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

  // Filter
  const activeClients = clients.filter((c) => c.is_active !== false)

  const filteredClients = activeClients
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
          <p className="text-muted-foreground mb-6 max-w-md">
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
              <h1 className="text-2xl sm:text-4xl font-display font-bold">Client Management</h1>
            </div>
            <p className="text-sm sm:text-lg text-muted-foreground">
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
      <motion.div variants={containerVariants} className="grid gap-4 md:grid-cols-4 mb-8">
        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Building2 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Clients</p>
                  <p className="text-2xl font-bold">
                    {activeClients.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className={cn(pendingRequests.length > 0 && "border-brand-orange/30 bg-brand-orange/5")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10">
                  <Bell className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Requests</p>
                  <p className="text-2xl font-bold text-orange-500">
                    {pendingRequests.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-yellow-500/10">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client Wins 🎉</p>
                  <p className="text-2xl font-bold">
                    {projects.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-500/10">
                  <Users className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Client Users</p>
                  <p className="text-2xl font-bold">
                    {clientUsers.length}
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
              <p className="text-muted-foreground mb-1">
                Get started by importing all 22 Brandastic clients with their monthly hours, billing rates, and project data.
              </p>
              <p className="text-sm text-muted-foreground">
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
        <TabsList className="bg-muted/50">
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Directory</CardTitle>
                  <CardDescription>All clients with portal access</CardDescription>
                </div>
                <div className="flex gap-3">
                  <div className="relative w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search clients... (⌘K)"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  {/* Client invite button removed - using shareable link for now */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeClients.length === 0 ? (
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredClients.map((client) => {
                  // Count unique team members assigned to this client
                  const clientTeamCount = clientUsers.filter(u => u.client_id === client.id).length
                  // Count tickets/tasks for this client
                  const clientTicketCount = requests.filter(r => r.client_id === client.id).length
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
                        "p-4 rounded-xl border hover:shadow-lg hover:border-brand-orange/30 transition-all bg-card group relative",
                        isPinned(client.id) && "ring-2 ring-yellow-400/50 border-yellow-400/30"
                      )}
                    >
                      {/* Pin button */}
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          togglePinClient(client.id)
                        }}
                        className={cn(
                          "absolute top-2 right-2 p-1.5 rounded-lg transition-all z-10",
                          isPinned(client.id) 
                            ? "bg-yellow-500 text-white" 
                            : "bg-muted/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-yellow-500 hover:text-white"
                        )}
                        title={isPinned(client.id) ? "Unpin client" : "Pin client"}
                      >
                        <Star className={cn("h-4 w-4", isPinned(client.id) && "fill-current")} />
                      </button>
                      
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
                          <h3 className="font-semibold truncate">{client.name}</h3>
                          {client.account_services && client.account_services.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {client.account_services.slice(0, 2).map((service, i) => (
                                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                  {service}
                                </span>
                              ))}
                              {client.account_services.length > 2 && (
                                <span className="text-[10px] text-muted-foreground">
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
                            <p className="text-xs text-muted-foreground">Monthly</p>
                            <p className="font-bold text-green-600">${monthlyRevenue.toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Hours</p>
                            <p className="font-bold">{client.monthly_hours || 0}h</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <p className="font-semibold">{clientTeamCount}</p>
                          <p className="text-[10px] text-muted-foreground">Team</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <p className="font-semibold">{clientTicketCount}</p>
                          <p className="text-[10px] text-muted-foreground">Tasks</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <p className="font-semibold">{clientProjectCount}</p>
                          <p className="text-[10px] text-muted-foreground">Boards</p>
                        </div>
                      </div>
                      
                      {/* Contact & View Link */}
                      <div className="flex items-center justify-between mt-3">
                        {client.contact_email ? (
                          <p className="text-xs text-muted-foreground truncate flex-1">
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
              
              {/* Summary Footer */}
              <div className="mt-6 p-4 rounded-xl bg-muted/50 border">
                <div className="flex flex-wrap gap-6 justify-center text-center">
                  <div>
                    <p className="text-2xl font-bold text-brand-orange">{activeClients.length}</p>
                    <p className="text-sm text-muted-foreground">Active Clients</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      ${activeClients.reduce((sum, c) => sum + ((c.monthly_hours || 0) * 175), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {activeClients.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)}h
                    </p>
                    <p className="text-sm text-muted-foreground">Total Hours/Month</p>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Requests</CardTitle>
                  <CardDescription>Track approvals, assets, and feedback from clients</CardDescription>
                </div>
                <Button onClick={() => setRequestDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Request
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
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
                          "flex items-center justify-between p-4 rounded-xl border hover:bg-muted/50 transition-colors",
                          request.status === 'pending' && "border-brand-orange/30 bg-brand-orange/5"
                        )}
                      >
                        <div className="flex items-center gap-4">
                          <div className={cn("p-2 rounded-lg bg-muted/50", typeConfig.color)}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{request.title}</p>
                              <Badge variant="outline">{request.client?.name}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {typeConfig.label} • {formatRelativeDate(new Date(request.created_at))}
                              {request.due_date && ` • Due ${formatDate(request.due_date)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              request.priority === 'urgent' && "border-red-500 text-red-500",
                              request.priority === 'high' && "border-orange-500 text-orange-500"
                            )}
                          >
                            {request.priority}
                          </Badge>
                          <Badge
                            variant={request.status === 'pending' ? 'default' : 'secondary'}
                            className={request.status === 'pending' ? 'bg-brand-orange' : ''}
                          >
                            {request.status}
                          </Badge>
                        </div>
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
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    🏆 Client Wins
                  </CardTitle>
                  <CardDescription>Celebrate team achievements and client successes</CardDescription>
                </div>
                <Button onClick={() => setProjectDialogOpen(true)} className="bg-yellow-500 hover:bg-yellow-600">
                  <Trophy className="h-4 w-4 mr-2" />
                  Share a Win
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
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
                  {projects.map((project) => (
                    <motion.div
                      key={project.id}
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
                            <h3 className="font-bold text-lg">{project.title}</h3>
                            <p className="text-sm text-muted-foreground">{project.client?.name}</p>
                          </div>
                        </div>
                        {project.is_featured && (
                          <Badge className="bg-yellow-500 text-white">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Featured
                          </Badge>
                        )}
                      </div>
                      
                      {project.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{project.description}</p>
                      )}
                      
                      {project.category && (
                        <Badge variant="outline" className="mb-3 bg-white/50 dark:bg-white/10">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          {project.category}
                        </Badge>
                      )}
                      
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-yellow-200 dark:border-yellow-800/30">
                        <span className="text-xs text-muted-foreground">
                          {project.created_at ? formatRelativeDate(new Date(project.created_at)) : 'Recently'}
                        </span>
                        {project.url && (
                          <Button variant="ghost" size="sm" asChild className="text-yellow-600 hover:text-yellow-700">
                            <a href={project.url} target="_blank" rel="noopener noreferrer">
                              View Details
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={requestPriority} onValueChange={setRequestPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={p.color}>{p.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={requestDueDate}
                  onChange={(e) => setRequestDueDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
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
                      <p className="text-sm text-muted-foreground">Uploading...</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="p-3 rounded-full bg-muted/50">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Drag & drop or click to upload</p>
                        <p className="text-xs text-muted-foreground">PNG, JPG, GIF, or PDF (max 10MB)</p>
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
    </motion.div>
  )
}
