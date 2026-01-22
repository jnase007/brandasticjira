import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Building2,
  Kanban,
  Clock,
  TrendingUp,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
  AlertTriangle,
  Upload,
  FileJson,
  FileSpreadsheet,
  Loader2,
  Send,
  Copy,
  Eye,
  Zap,
} from 'lucide-react'
import { supabase, seedSampleClients, deleteSampleClients } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import ClientDialog from '../components/ClientDialog'
import { UpcomingCelebrations } from '../components/Celebrations'
import { useToast } from '../hooks/useToast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import AnimatedCounter from '../components/AnimatedCounter'
import { DonutChart, BarChart } from '../components/Charts'

// JIRA Import Helpers
const STATUS_MAP = {
  'done': 'done', 'closed': 'done', 'resolved': 'done', 'complete': 'done', 'completed': 'done',
  'in progress': 'inprogress', 'in development': 'inprogress', 'in review': 'inprogress', 'testing': 'inprogress',
  'to do': 'todo', 'todo': 'todo', 'open': 'todo', 'new': 'todo', 'backlog': 'todo',
}

const PRIORITY_MAP = {
  'highest': 'urgent', 'blocker': 'urgent', 'critical': 'urgent',
  'high': 'high', 'medium': 'medium', 'normal': 'medium',
  'low': 'low', 'lowest': 'low', 'trivial': 'low',
}

function mapStatus(jiraStatus) {
  const status = jiraStatus?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (status.includes(key)) return value
  }
  return 'todo'
}

function mapPriority(jiraPriority) {
  const priority = jiraPriority?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(PRIORITY_MAP)) {
    if (priority.includes(key)) return value
  }
  return 'medium'
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Admin() {
  const { profile, isAdmin, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Dialog states
  const [clientDialogOpen, setClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingClient, setDeletingClient] = useState(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  
  // Invite form states
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('team')
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  
  // JIRA Import states
  const [importFile, setImportFile] = useState(null)
  const [importData, setImportData] = useState(null)
  const [importClient, setImportClient] = useState('')
  const [importBoard, setImportBoard] = useState('')
  const [newBoardName, setNewBoardName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [boards, setBoards] = useState([])
  
  // Sample data seeding
  const [seeding, setSeeding] = useState(false)
  
  // Data states
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalBoards: 0,
    totalTickets: 0,
    activeUsers: 0,
    hoursThisMonth: 0,
  })

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch users/profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch boards
      const { data: boardsData } = await supabase
        .from('boards')
        .select('*, client:clients(name)')
        .eq('is_archived', false)
        .order('created_at', { ascending: false })

      // Fetch board count
      const { count: boardCount } = await supabase
        .from('boards')
        .select('*', { count: 'exact', head: true })

      // Fetch ticket count
      const { count: ticketCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })

      setUsers(profilesData || [])
      setClients(clientsData || [])
      setBoards(boardsData || [])
      setStats({
        totalUsers: profilesData?.length || 0,
        totalClients: clientsData?.length || 0,
        totalBoards: boardCount || 0,
        totalTickets: ticketCount || 0,
        activeUsers: profilesData?.filter(u => u.role !== 'client').length || 0,
        hoursThisMonth: clientsData?.reduce((sum, c) => sum + (c.monthly_hours || 0), 0) || 0,
      })
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Generate invite link
  const handleInvite = async () => {
    if (!inviteEmail) {
      toast({ title: 'Please enter an email address', variant: 'destructive' })
      return
    }

    setInviteSending(true)
    
    try {
      // For now, we create a magic link URL that the user can share
      // In production, you'd use supabase.auth.admin.inviteUserByEmail()
      const signupUrl = `${window.location.origin}/login?invite=true&email=${encodeURIComponent(inviteEmail)}&role=${inviteRole}`
      setInviteLink(signupUrl)
      
      toast({
        title: '✉️ Invite link generated!',
        description: 'Copy the link and send it to your team member.',
        variant: 'success',
      })
    } catch (error) {
      console.error('Invite error:', error)
      toast({
        title: 'Error',
        description: 'Failed to generate invite link.',
        variant: 'destructive',
      })
    } finally {
      setInviteSending(false)
    }
  }

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({ title: 'Link copied to clipboard!' })
  }

  // Handle file upload for JIRA import
  const handleFileUpload = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFile(file)
    const reader = new FileReader()

    reader.onload = (e) => {
      const content = e.target?.result
      try {
        let parsed
        
        if (file.name.endsWith('.json')) {
          parsed = JSON.parse(content)
          // Handle JIRA JSON export format
          if (parsed.issues) {
            parsed = parsed.issues.map(issue => ({
              key: issue.key,
              summary: issue.fields?.summary,
              description: issue.fields?.description,
              status: issue.fields?.status?.name,
              priority: issue.fields?.priority?.name,
              labels: issue.fields?.labels || [],
              timeEstimate: issue.fields?.timeoriginalestimate,
            }))
          }
        } else {
          // Parse CSV
          const lines = content.split('\n').filter(l => l.trim())
          const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''))
          parsed = lines.slice(1).map(line => {
            const values = parseCSVLine(line)
            const obj = {}
            headers.forEach((h, i) => {
              obj[h] = values[i] || ''
            })
            return obj
          })
        }

        setImportData(parsed)
        toast({
          title: `📊 ${parsed.length} issues found`,
          description: `Ready to import from ${file.name}`,
        })
      } catch (error) {
        console.error('Parse error:', error)
        toast({
          title: 'Error parsing file',
          description: 'Please check the file format.',
          variant: 'destructive',
        })
      }
    }

    if (file.name.endsWith('.json')) {
      reader.readAsText(file)
    } else {
      reader.readAsText(file)
    }
  }, [toast])

  // Run import
  const handleImport = async () => {
    if (!importData || importData.length === 0) return
    if (!importClient) {
      toast({ title: 'Please select a client', variant: 'destructive' })
      return
    }

    setImporting(true)
    setImportProgress(0)

    try {
      // Get or create board
      let boardId = importBoard
      
      if (!boardId && newBoardName) {
        const { data: newBoard, error } = await supabase
          .from('boards')
          .insert({
            name: newBoardName,
            client_id: importClient,
            created_by: user.id,
          })
          .select()
          .single()
        
        if (error) throw error
        boardId = newBoard.id
      }

      if (!boardId) {
        toast({ title: 'Please select or create a board', variant: 'destructive' })
        setImporting(false)
        return
      }

      // Import tickets
      const total = importData.length
      let imported = 0
      let errors = 0

      for (const issue of importData) {
        try {
          const ticketData = {
            title: issue.summary || issue.title || issue.Summary || 'Untitled',
            description: issue.description || issue.Description || '',
            status: mapStatus(issue.status || issue.Status || 'todo'),
            priority: mapPriority(issue.priority || issue.Priority || 'medium'),
            board_id: boardId,
            client_id: importClient,
            created_by: user.id,
            tags: issue.labels || [],
          }

          const { error } = await supabase.from('tickets').insert(ticketData)
          if (error) throw error
          imported++
        } catch (err) {
          console.error('Ticket import error:', err)
          errors++
        }
        
        setImportProgress(Math.round(((imported + errors) / total) * 100))
      }

      toast({
        title: '🎉 Import complete!',
        description: `Imported ${imported} tickets${errors > 0 ? `, ${errors} failed` : ''}`,
        variant: 'success',
      })

      // Reset
      setImportFile(null)
      setImportData(null)
      setNewBoardName('')
      fetchData(true)
    } catch (error) {
      console.error('Import error:', error)
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // Handle opening edit dialog
  const handleEditClient = (client) => {
    setEditingClient(client)
    setClientDialogOpen(true)
  }

  // Handle opening add dialog
  const handleAddClient = () => {
    setEditingClient(null)
    setClientDialogOpen(true)
  }

  // Handle delete client
  const handleDeleteClient = async () => {
    if (!deletingClient) return
    
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: false })
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
    }
  }

  // Filter users
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Role distribution for chart
  const roleDistribution = [
    { label: 'Team', value: users.filter(u => u.role === 'team').length },
    { label: 'Admin', value: users.filter(u => u.role === 'admin').length },
    { label: 'Client', value: users.filter(u => u.role === 'client').length },
  ]

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-brand-purple/10">
                <Shield className="h-6 w-6 text-brand-purple" />
              </div>
              <h1 className="text-4xl font-display font-bold">Admin Dashboard</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Manage users, clients, and system settings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setSeeding(true)
                try {
                  const results = await seedSampleClients()
                  toast({
                    title: '🌱 Sample data added!',
                    description: `Created ${results.clients.length} clients, ${results.boards.length} boards, ${results.tickets.length} tickets`,
                    variant: 'success',
                  })
                  fetchData(true)
                } catch (error) {
                  toast({
                    title: 'Error seeding data',
                    description: error.message,
                    variant: 'destructive',
                  })
                } finally {
                  setSeeding(false)
                }
              }}
              disabled={seeding}
            >
              {seeding ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 mr-2" />
              )}
              Add Sample Clients
            </Button>
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
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-purple transition-colors">
                    <AnimatedCounter value={stats.totalUsers} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.activeUsers} team members
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-7 w-7 text-brand-purple" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-orange transition-colors">
                    <AnimatedCounter value={stats.totalClients} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active accounts
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-7 w-7 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-blue transition-colors">
                    <AnimatedCounter value={stats.totalBoards} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active projects
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Kanban className="h-7 w-7 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-green-500 transition-colors">
                    <AnimatedCounter value={stats.totalTickets} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All time
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-7 w-7 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Import
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">User Management</CardTitle>
                    <CardDescription>Manage all registered users</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium">User</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Joined</th>
                        <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <motion.tr
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-t hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={user.avatar_url} />
                                  <AvatarFallback className="bg-brand-orange/10 text-brand-orange">
                                    {getInitials(user.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.full_name || 'No name'}</p>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  user.role === 'admin' ? 'default' :
                                  user.role === 'team' ? 'secondary' : 'outline'
                                }
                                className={cn(
                                  user.role === 'admin' && "bg-brand-purple text-white"
                                )}
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Active</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {formatDate(user.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Client Management</CardTitle>
                    <CardDescription>Manage all client accounts</CardDescription>
                  </div>
                  <Button size="sm" onClick={handleAddClient}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clients.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No clients yet
                    </div>
                  ) : (
                    clients.map((client, index) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-5 rounded-2xl border bg-card hover:shadow-md hover:border-brand-orange/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            {client.logo_url ? (
                              <img
                                src={client.logo_url}
                                alt={client.name}
                                className="w-12 h-12 rounded-xl object-contain bg-white border shadow-lg"
                              />
                            ) : (
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                                style={{ backgroundColor: client.color || '#F7931E' }}
                              >
                                {client.name?.charAt(0) || 'C'}
                              </div>
                            )}
                            <div>
                              <h3 className="font-semibold group-hover:text-brand-orange transition-colors">
                                {client.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {client.monthly_hours}h/month
                              </p>
                            </div>
                          </div>
                          <Badge variant={client.is_active ? 'default' : 'secondary'}>
                            {client.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            <Mail className="h-3 w-3 inline mr-1" />
                            {client.contact_email || 'No email'}
                          </span>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon-sm"
                              onClick={() => handleEditClient(client)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon-sm"
                              onClick={() => {
                                setDeletingClient(client)
                                setDeleteDialogOpen(true)
                              }}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  JIRA Import
                </CardTitle>
                <CardDescription>
                  Import tickets from JIRA CSV or JSON exports
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* File Upload */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-8 text-center transition-all",
                    importFile 
                      ? "border-green-500 bg-green-500/5" 
                      : "border-muted-foreground/25 hover:border-brand-orange/50 hover:bg-muted/50"
                  )}
                >
                  {importFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-3">
                        {importFile.name.endsWith('.json') ? (
                          <FileJson className="h-10 w-10 text-green-500" />
                        ) : (
                          <FileSpreadsheet className="h-10 w-10 text-green-500" />
                        )}
                        <div className="text-left">
                          <p className="font-medium">{importFile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {importData?.length || 0} issues found
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setImportFile(null)
                          setImportData(null)
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block">
                      <input
                        type="file"
                        accept=".csv,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium mb-1">Drop your JIRA export here</p>
                      <p className="text-sm text-muted-foreground">
                        Supports CSV and JSON formats
                      </p>
                    </label>
                  )}
                </div>

                {/* Import Settings */}
                {importData && importData.length > 0 && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Select Client</Label>
                      <Select value={importClient} onValueChange={setImportClient}>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a client" />
                        </SelectTrigger>
                        <SelectContent>
                          {clients.filter(c => c.is_active).map(client => (
                            <SelectItem key={client.id} value={client.id}>
                              {client.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Select or Create Board</Label>
                      <Select 
                        value={importBoard} 
                        onValueChange={(v) => {
                          setImportBoard(v)
                          if (v !== 'new') setNewBoardName('')
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a board" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">+ Create New Board</SelectItem>
                          {boards
                            .filter(b => b.client_id === importClient)
                            .map(board => (
                              <SelectItem key={board.id} value={board.id}>
                                {board.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {importBoard === 'new' && (
                      <div className="space-y-2 md:col-span-2">
                        <Label>New Board Name</Label>
                        <Input
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          placeholder="e.g., Q1 2024 Tasks"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Preview */}
                {importData && importData.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="font-medium flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Preview (first 5 issues)
                    </h3>
                    <div className="rounded-xl border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-3">Title</th>
                            <th className="text-left p-3">Status</th>
                            <th className="text-left p-3">Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importData.slice(0, 5).map((issue, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-3 truncate max-w-xs">
                                {issue.summary || issue.title || issue.Summary || 'No title'}
                              </td>
                              <td className="p-3">
                                <Badge variant="outline">
                                  {mapStatus(issue.status || issue.Status)}
                                </Badge>
                              </td>
                              <td className="p-3">
                                <Badge variant="secondary">
                                  {mapPriority(issue.priority || issue.Priority)}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import Button */}
                {importData && importData.length > 0 && (
                  <div className="flex items-center justify-between pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Ready to import <strong>{importData.length}</strong> tickets
                    </p>
                    <Button 
                      onClick={handleImport}
                      disabled={importing || !importClient || (!importBoard && !newBoardName)}
                      className="gap-2"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importing... {importProgress}%
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4" />
                          Start Import
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {importing && (
                  <Progress value={importProgress} className="h-2" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <DonutChart
                  value={stats.activeUsers}
                  total={stats.totalUsers}
                  size={180}
                  strokeWidth={20}
                  label="Team Members"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Hours by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={clients.slice(0, 6).map(c => ({
                    label: c.name?.substring(0, 8) || 'Client',
                    value: c.monthly_hours || 0
                  }))}
                  height={180}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-orange">
                      <AnimatedCounter value={stats.hoursThisMonth} />h
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Total Monthly Hours</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-blue">
                      <AnimatedCounter value={stats.totalBoards} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Boards</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-purple">
                      <AnimatedCounter value={users.filter(u => u.role === 'admin').length} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Admins</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-green-500">
                      <AnimatedCounter value={clients.filter(c => c.is_active).length} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Clients</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Celebrations - Admin View */}
            <UpcomingCelebrations showAll />
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Client Dialog */}
      <ClientDialog
        open={clientDialogOpen}
        onOpenChange={setClientDialogOpen}
        client={editingClient}
        onSuccess={() => {
          fetchData(true)
          setEditingClient(null)
        }}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Deactivate Client
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate <strong>{deletingClient?.name}</strong>? 
              This will hide the client from active lists but preserve all data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteClient}>
              Deactivate Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite Team Member Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
        setInviteDialogOpen(open)
        if (!open) {
          setInviteEmail('')
          setInviteName('')
          setInviteRole('team')
          setInviteLink('')
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-orange" />
              Invite Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invite to join your Brandastic PM workspace
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email Address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@brandastic.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invite-name">Name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="John Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Member
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Admin
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {inviteRole === 'admin' 
                  ? 'Admins can manage users, clients, and all settings'
                  : 'Team members can view all clients and manage tasks'
                }
              </p>
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
                  <Input 
                    value={inviteLink} 
                    readOnly 
                    className="text-xs font-mono"
                  />
                  <Button 
                    variant="outline" 
                    size="icon"
                    onClick={copyInviteLink}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with your team member to let them sign up
                </p>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleInvite}
              disabled={inviteSending || !inviteEmail}
              className="gap-2"
            >
              {inviteSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : inviteLink ? (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Link Generated
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Generate Invite Link
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
