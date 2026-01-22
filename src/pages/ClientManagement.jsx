import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Users, Plus, Search, Bell, MessageSquare, Calendar,
  Send, Mail, Copy, CheckCircle, Clock, AlertTriangle, ExternalLink,
  ThumbsUp, Image, FileText, Trash2, Edit2, Eye, Star, Loader2,
  ChevronRight, Filter, RefreshCw, Award, Sparkles, Zap,
} from 'lucide-react'
import { supabase, seedSampleClients } from '../lib/supabase'
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
  const { user, profile, isAdmin } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data
  const [clients, setClients] = useState([])
  const [requests, setRequests] = useState([])
  const [projects, setProjects] = useState([])
  const [clientUsers, setClientUsers] = useState([])
  
  // Dialogs
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [projectDialogOpen, setProjectDialogOpen] = useState(false)
  
  // Invite form
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteClient, setInviteClient] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteSending, setInviteSending] = useState(false)
  
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
  const [projectFeatured, setProjectFeatured] = useState(false)
  const [projectSaving, setProjectSaving] = useState(false)

  // Fetch data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch clients first - this is the main table we need
      const clientsRes = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .order('name')
      
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
      }
      
      setClients(clientsRes.data || [])

      // Try to fetch other data, but don't fail if tables don't exist
      try {
        const [requestsRes, projectsRes, usersRes] = await Promise.all([
          supabase
            .from('client_requests')
            .select('*, client:clients(name, color), creator:profiles!client_requests_created_by_fkey(full_name)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase
            .from('client_projects')
            .select('*, client:clients(name, color)')
            .order('created_at', { ascending: false }),
          supabase
            .from('profiles')
            .select('*, client:clients(name)')
            .eq('role', 'client'),
        ])

        setRequests(requestsRes.data || [])
        setProjects(projectsRes.data || [])
        setClientUsers(usersRes.data || [])
      } catch (err) {
        console.log('Optional tables not ready:', err)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Generate client invite link
  const handleInvite = async () => {
    if (!inviteEmail || !inviteClient) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' })
      return
    }

    setInviteSending(true)
    
    try {
      // Generate signup URL with client info
      const signupUrl = `${window.location.origin}/login?invite=client&email=${encodeURIComponent(inviteEmail)}&client=${inviteClient}`
      setInviteLink(signupUrl)
      
      // Log this invite for email sending
      await supabase.from('email_notifications').insert({
        recipient_email: inviteEmail,
        recipient_name: inviteName,
        subject: `You've been invited to Brandastic's Client Portal`,
        body: `Welcome! Click here to access your client portal: ${signupUrl}`,
        type: 'welcome',
        status: 'pending',
      })
      
      toast({
        title: '✉️ Client invite ready!',
        description: 'Copy the link and send it to your client.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Invite error:', error)
      toast({ title: 'Error generating invite', variant: 'destructive' })
    } finally {
      setInviteSending(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({ title: 'Link copied!' })
  }

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

      toast({ title: 'Project added to portfolio!', variant: 'success' })
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
    setProjectFeatured(false)
  }

  // Filter
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const pendingRequests = requests.filter(r => r.status === 'pending')

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

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral">
                <Building2 className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-4xl font-display font-bold">Client Management</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Manage client relationships, requests, and portfolios
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setInviteDialogOpen(true)}>
              <Mail className="h-4 w-4 mr-2" />
              Invite Client
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
                    <AnimatedCounter value={clients.length} />
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
                    <AnimatedCounter value={pendingRequests.length} />
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
                <div className="p-2 rounded-xl bg-purple-500/10">
                  <Award className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio Projects</p>
                  <p className="text-2xl font-bold">
                    <AnimatedCounter value={projects.length} />
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
                    <AnimatedCounter value={clientUsers.length} />
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* No Clients Banner - Shows prominently at top */}
      {clients.length === 0 && (
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
      <Tabs defaultValue="requests" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="requests" className="gap-2">
            <Bell className="h-4 w-4" />
            Requests
            {pendingRequests.length > 0 && (
              <Badge className="ml-1 h-5 px-1.5 bg-brand-orange text-white">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="portfolio" className="gap-2">
            <Star className="h-4 w-4" />
            Portfolio
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
        </TabsList>

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

        {/* Portfolio Tab */}
        <TabsContent value="portfolio">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Client Portfolio</CardTitle>
                  <CardDescription>Showcase completed work for clients</CardDescription>
                </div>
                <Button onClick={() => setProjectDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Project
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No portfolio projects yet</p>
                  <Button variant="outline" className="mt-4" onClick={() => setProjectDialogOpen(true)}>
                    Add your first project
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {projects.map((project) => (
                    <div
                      key={project.id}
                      className="p-4 rounded-xl border hover:shadow-md transition-all group"
                    >
                      {project.image_url && (
                        <div className="aspect-video rounded-lg bg-muted overflow-hidden mb-3">
                          <img
                            src={project.image_url}
                            alt={project.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        </div>
                      )}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold">{project.title}</h3>
                          <p className="text-sm text-muted-foreground">{project.client?.name}</p>
                        </div>
                        {project.is_featured && (
                          <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      {project.category && (
                        <Badge variant="outline" className="mb-2">{project.category}</Badge>
                      )}
                      <div className="flex items-center gap-2 mt-3">
                        <Badge variant={project.is_visible_to_client ? 'default' : 'secondary'}>
                          {project.is_visible_to_client ? 'Visible' : 'Hidden'}
                        </Badge>
                        {project.url && (
                          <Button variant="ghost" size="sm" asChild>
                            <a href={project.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
                      placeholder="Search clients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Button onClick={() => setInviteDialogOpen(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredClients.map((client) => {
                  const clientUserCount = clientUsers.filter(u => u.client_id === client.id).length
                  const clientRequestCount = requests.filter(r => r.client_id === client.id).length
                  const clientProjectCount = projects.filter(p => p.client_id === client.id).length
                  const monthlyRevenue = (client.monthly_hours || 0) * 175
                  
                  return (
                    <motion.div
                      key={client.id}
                      variants={itemVariants}
                      whileHover={{ y: -2 }}
                      className="p-4 rounded-xl border hover:shadow-lg hover:border-brand-orange/30 transition-all bg-card"
                    >
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
                          <p className="font-semibold">{clientUserCount}</p>
                          <p className="text-[10px] text-muted-foreground">Users</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <p className="font-semibold">{clientRequestCount}</p>
                          <p className="text-[10px] text-muted-foreground">Requests</p>
                        </div>
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <p className="font-semibold">{clientProjectCount}</p>
                          <p className="text-[10px] text-muted-foreground">Projects</p>
                        </div>
                      </div>
                      
                      {/* Contact */}
                      {client.contact_email && (
                        <p className="text-xs text-muted-foreground mt-3 truncate">
                          📧 {client.contact_email}
                        </p>
                      )}
                    </motion.div>
                  )
                })}
              </div>
              
              {/* Summary Footer */}
              <div className="mt-6 p-4 rounded-xl bg-muted/50 border">
                <div className="flex flex-wrap gap-6 justify-center text-center">
                  <div>
                    <p className="text-2xl font-bold text-brand-orange">{clients.length}</p>
                    <p className="text-sm text-muted-foreground">Active Clients</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      ${clients.reduce((sum, c) => sum + ((c.monthly_hours || 0) * 175), 0).toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {clients.reduce((sum, c) => sum + (c.monthly_hours || 0), 0)}h
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
      </Tabs>

      {/* Invite Client Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open)
        if (!open) {
          setInviteEmail('')
          setInviteName('')
          setInviteClient('')
          setInviteLink('')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-brand-orange" />
              Invite Client to Portal
            </DialogTitle>
            <DialogDescription>
              Send an invite link for client portal access
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Client</Label>
              <Select value={inviteClient} onValueChange={setInviteClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Contact Email</Label>
              <Input
                type="email"
                placeholder="client@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Contact Name (optional)</Label>
              <Input
                placeholder="John Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>

            {inviteLink && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl bg-green-500/10 border border-green-500/30 space-y-3"
              >
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Invite Link Ready!</span>
                </div>
                <div className="flex gap-2">
                  <Input value={inviteLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="icon" onClick={copyInviteLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviteSending || !inviteEmail || !inviteClient}>
              {inviteSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Generate Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                    {clients.map(client => (
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

      {/* Add Project Dialog */}
      <Dialog open={projectDialogOpen} onOpenChange={(open) => {
        setProjectDialogOpen(open)
        if (!open) resetProjectForm()
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-purple-500" />
              Add Portfolio Project
            </DialogTitle>
            <DialogDescription>
              Showcase completed work for a client
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={projectClient} onValueChange={setProjectClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Project Title *</Label>
              <Input
                placeholder="e.g., Website Redesign"
                value={projectTitle}
                onChange={(e) => setProjectTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Input
                placeholder="e.g., Web Design, Branding, SEO"
                value={projectCategory}
                onChange={(e) => setProjectCategory(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Brief description of the project..."
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                placeholder="https://..."
                value={projectImageUrl}
                onChange={(e) => setProjectImageUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Live URL</Label>
              <Input
                placeholder="https://example.com"
                value={projectUrl}
                onChange={(e) => setProjectUrl(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="featured"
                checked={projectFeatured}
                onChange={(e) => setProjectFeatured(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="featured" className="text-sm cursor-pointer flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Mark as featured project
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateProject} disabled={projectSaving || !projectClient || !projectTitle}>
              {projectSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
