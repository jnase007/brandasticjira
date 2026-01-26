import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  DollarSign,
  Calendar,
  Clock,
  Building2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Check,
  X,
  Search,
  Download,
  RefreshCw,
  Filter,
  User,
  Cake,
  Mail,
  Sparkles,
  Briefcase,
  ArrowRight,
  PiggyBank,
  Percent,
  Save,
  Heart,
  MessageCircle,
  Send,
  Loader2,
  PartyPopper,
} from 'lucide-react'
import { Textarea } from '../components/ui/textarea'
import { supabase, ensureValidSession } from '../lib/supabase'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
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
import { Label } from '../components/ui/label'
import { Skeleton } from '../components/ui/skeleton'
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

const PLATFORMS = [
  { value: 'facebook', label: 'Facebook', color: '#1877F2' },
  { value: 'google', label: 'Google', color: '#4285F4' },
  { value: 'google_ppc', label: 'Google PPC Ads', color: '#34A853' },
  { value: 'meta', label: 'Meta (Facebook/Instagram)', color: '#E1306C' },
  { value: 'tiktok', label: 'TikTok', color: '#000000' },
  { value: 'twitter', label: 'X (Twitter)', color: '#1DA1F2' },
  { value: 'spotify', label: 'Spotify', color: '#1DB954' },
  { value: 'programmatic', label: 'Programmatic', color: '#6366F1' },
  { value: 'linkedin', label: 'LinkedIn', color: '#0A66C2' },
  { value: 'other', label: 'Other', color: '#6B7280' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DEFAULT_TEAM_ROLES = [
  { key: 'marketing_manager', label: 'Marketing Manager' },
  { key: 'account_specialist', label: 'Account Specialist' },
  { key: 'marketing_coordinator', label: 'Marketing Coordinator' },
  { key: 'paid_media', label: 'Paid Media' },
  { key: 'seo', label: 'SEO' },
  { key: 'design', label: 'Design' },
]

function formatCurrency(value) {
  if (!value && value !== 0) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getBudgetStatus(actuals, budget) {
  if (!budget || budget === 0) return 'neutral'
  const percent = (actuals / budget) * 100
  if (percent > 100) return 'over'
  if (percent >= 90) return 'warning'
  return 'good'
}

export default function TeamHub() {
  const { user, profile, isAdmin, isActualAdmin, loading: authLoading } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data
  const [clients, setClients] = useState([])
  const [teamAssignments, setTeamAssignments] = useState([])
  const [adSpend, setAdSpend] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [profitability, setProfitability] = useState([])
  
  // Year selection for ad spend
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  
  // Edit states
  const [editingCell, setEditingCell] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [addSpendDialogOpen, setAddSpendDialogOpen] = useState(false)
  const [newSpend, setNewSpend] = useState({
    client_id: '',
    platform: 'facebook',
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    budget: '',
  })
  
  // Employee rate editing
  const [editingRate, setEditingRate] = useState(null)
  const [rateValue, setRateValue] = useState('')
  const [savingRate, setSavingRate] = useState(false)
  
  // Shoutouts
  const [shoutouts, setShoutouts] = useState([])
  const [shoutoutDialogOpen, setShoutoutDialogOpen] = useState(false)
  const [shoutoutTo, setShoutoutTo] = useState('')
  const [shoutoutMessage, setShoutoutMessage] = useState('')
  const [shoutoutCategory, setShoutoutCategory] = useState('appreciation')
  const [sendingShoutout, setSendingShoutout] = useState(false)
  
  // Custom team roles - stored in localStorage
  const [teamRoles, setTeamRoles] = useState(() => {
    try {
      const saved = localStorage.getItem('team_roster_roles')
      return saved ? JSON.parse(saved) : DEFAULT_TEAM_ROLES
    } catch (e) {
      console.warn('Invalid team roles data, resetting to defaults...')
      return DEFAULT_TEAM_ROLES
    }
  })
  const [manageRolesOpen, setManageRolesOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState('')
  
  // Renewal date editing
  const [editingRenewalDate, setEditingRenewalDate] = useState(null)
  const [renewalDateValue, setRenewalDateValue] = useState('')
  
  // Overhead settings - stored in localStorage for now, could be in DB
  const [monthlyOverhead, setMonthlyOverhead] = useState(() => {
    const saved = localStorage.getItem('company_monthly_overhead')
    return saved ? parseFloat(saved) : 37000
  })
  const [targetBillableHours, setTargetBillableHours] = useState(() => {
    const saved = localStorage.getItem('company_target_billable_hours')
    return saved ? parseFloat(saved) : 745 // Total monthly hours from all clients
  })
  const [editingOverhead, setEditingOverhead] = useState(false)
  
  // Calculate overhead per hour
  const overheadPerHour = targetBillableHours > 0 ? monthlyOverhead / targetBillableHours : 0
  
  // Save overhead settings
  const saveOverheadSettings = (overhead, hours) => {
    localStorage.setItem('company_monthly_overhead', String(overhead))
    localStorage.setItem('company_target_billable_hours', String(hours))
    setMonthlyOverhead(overhead)
    setTargetBillableHours(hours)
    setEditingOverhead(false)
    toast({
      title: '✅ Overhead settings saved',
      description: `$${overhead.toLocaleString()}/month ÷ ${hours}hrs = $${(overhead/hours).toFixed(2)}/hr overhead`,
      variant: 'success',
    })
  }
  
  // Add a new role
  const addRole = () => {
    if (!newRoleName.trim()) return
    const key = newRoleName.trim().toLowerCase().replace(/\s+/g, '_')
    if (teamRoles.find(r => r.key === key)) {
      toast({ title: 'Role already exists', variant: 'destructive' })
      return
    }
    const newRoles = [...teamRoles, { key, label: newRoleName.trim() }]
    setTeamRoles(newRoles)
    localStorage.setItem('team_roster_roles', JSON.stringify(newRoles))
    setNewRoleName('')
    toast({ title: '✅ Role added', description: `"${newRoleName.trim()}" added to roster`, variant: 'success' })
  }
  
  // Remove a role
  const removeRole = (roleKey) => {
    const newRoles = teamRoles.filter(r => r.key !== roleKey)
    setTeamRoles(newRoles)
    localStorage.setItem('team_roster_roles', JSON.stringify(newRoles))
    toast({ title: 'Role removed', variant: 'success' })
  }
  
  // Update client renewal date
  const updateRenewalDate = async (clientId, newDate) => {
    try {
      const { error } = await supabase
        .from('clients')
        .update({ renewal_date: newDate || null })
        .eq('id', clientId)
      
      if (error) throw error
      
      // Update local state
      setClients(prev => prev.map(c => 
        c.id === clientId ? { ...c, renewal_date: newDate || null } : c
      ))
      
      toast({ 
        title: '✅ Renewal date updated', 
        description: newDate ? `Set to ${formatDate(newDate)}` : 'Date cleared',
        variant: 'success' 
      })
    } catch (error) {
      console.error('Error updating renewal date:', error)
      toast({ title: 'Error updating date', description: error.message, variant: 'destructive' })
    }
    setEditingRenewalDate(null)
    setRenewalDateValue('')
  }
  
  // Send a shoutout
  const handleSendShoutout = async () => {
    if (!shoutoutTo || !shoutoutMessage.trim()) {
      toast({
        title: 'Missing info',
        description: 'Please select a team member and write a message',
        variant: 'destructive',
      })
      return
    }
    
    setSendingShoutout(true)
    try {
      const { error } = await supabase
        .from('team_shoutouts')
        .insert({
          from_user_id: profile.id,
          to_user_id: shoutoutTo,
          message: shoutoutMessage.trim(),
          category: shoutoutCategory,
          is_public: true,
        })
      
      if (error) throw error
      
      const recipientName = teamMembers.find(m => m.id === shoutoutTo)?.full_name || 'them'
      toast({
        title: '🎉 Shoutout sent!',
        description: `${recipientName} will love this!`,
        variant: 'success',
      })
      
      setShoutoutDialogOpen(false)
      setShoutoutTo('')
      setShoutoutMessage('')
      setShoutoutCategory('appreciation')
      fetchData(true)
    } catch (error) {
      console.error('Error sending shoutout:', error)
      toast({
        title: 'Error',
        description: 'Failed to send shoutout. Try again!',
        variant: 'destructive',
      })
    } finally {
      setSendingShoutout(false)
    }
  }
  
  // Get shoutouts for a specific user
  const getShoutoutsForUser = (userId) => {
    return shoutouts.filter(s => s.to_user_id === userId)
  }
  
  // Get my received shoutouts
  const myShoutouts = shoutouts.filter(s => s.to_user_id === profile?.id)

  // Fetch all data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Validate session before fetching
      const sessionValid = await ensureValidSession()
      if (!sessionValid) {
        console.warn('[TeamHub] Session invalid, cannot fetch data')
        setLoading(false)
        setRefreshing(false)
        return
      }
      
      const [clientsRes, assignmentsRes, adSpendRes, teamRes] = await Promise.all([
        supabase.from('clients').select('*').neq('is_active', false).order('name'),
        supabase.from('client_team_assignments').select('*'),
        supabase.from('ad_spend').select('*').order('month'),
        supabase.from('profiles').select('*').in('role', ['team', 'admin']).order('full_name'),
      ])

      setClients(clientsRes.data || [])
      setAdSpend(adSpendRes.data || [])
      setTeamMembers(teamRes.data || [])
      
      // Enrich assignments with user data
      const enrichedAssignments = (assignmentsRes.data || []).map(a => ({
        ...a,
        user: (teamRes.data || []).find(m => m.id === a.user_id) || null
      }))
      setTeamAssignments(enrichedAssignments)
      
      // Try to fetch profitability view (may not exist yet)
      try {
        const { data: profitData } = await supabase
          .from('employee_profitability')
          .select('*')
        setProfitability(profitData || [])
      } catch (err) {
        // View may not exist yet
        console.log('Profitability view not ready:', err)
      }
      
      // Fetch shoutouts
      try {
        const { data: shoutoutData } = await supabase
          .from('team_shoutouts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        setShoutouts(shoutoutData || [])
      } catch (err) {
        // Table may not exist yet
        console.log('Shoutouts table not ready:', err)
      }
    } catch (error) {
      console.error('Error fetching team hub data:', error)
      toast({
        title: 'Error',
        description: 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }
  
  // Update employee hourly rate
  const updateEmployeeRate = async (memberId, newRate) => {
    setSavingRate(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ cost_rate: parseFloat(newRate) || 0 })
        .eq('id', memberId)
      
      if (error) throw error
      
      // Update local state
      setTeamMembers(prev => 
        prev.map(m => m.id === memberId ? { ...m, cost_rate: parseFloat(newRate) } : m)
      )
      
      toast({
        title: '✅ Rate updated',
        description: `Hourly rate set to $${newRate}/hr`,
        variant: 'success',
      })
      
      setEditingRate(null)
      setRateValue('')
    } catch (error) {
      console.error('Error updating rate:', error)
      toast({
        title: 'Error updating rate',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSavingRate(false)
    }
  }

  // Wait for auth to be ready before fetching data
  useEffect(() => {
    if (authLoading) {
      console.log('[TeamHub] Auth still loading, waiting...')
      return
    }
    
    if (!user) {
      console.log('[TeamHub] No user after auth loaded')
      setLoading(false)
      return
    }
    
    console.log('[TeamHub] Auth ready, fetching data...')
    fetchData()
  }, [authLoading, user?.id])

  // Get assignment for a client/role
  const getAssignment = (clientId, role) => {
    const assignment = teamAssignments.find(
      a => a.client_id === clientId && a.role === role
    )
    // Return user info if we have it, otherwise return empty
    if (assignment?.user) {
      return assignment.user.full_name || ''
    }
    return ''
  }
  
  // Get assignment user ID for a client/role (for select value)
  const getAssignmentUserId = (clientId, role) => {
    const assignment = teamAssignments.find(
      a => a.client_id === clientId && a.role === role
    )
    return assignment?.user_id || ''
  }

  // Update team assignment
  const updateAssignment = async (clientId, role, userId) => {
    try {
      // If userId is empty/null, delete the assignment
      if (!userId || userId === 'none') {
        // Delete any existing assignment for this client/role
        const { error: deleteError } = await supabase
          .from('client_team_assignments')
          .delete()
          .eq('client_id', clientId)
          .eq('role', role)

        if (deleteError) {
          console.error('Delete error:', deleteError)
        }
        
        // Refresh - fetch without join, then enrich
        const { data: assignmentsData } = await supabase
          .from('client_team_assignments')
          .select('*')
        
        const enrichedData = (assignmentsData || []).map(a => ({
          ...a,
          user: teamMembers.find(m => m.id === a.user_id) || null
        }))
        setTeamAssignments(enrichedData)
        toast({ title: 'Assignment removed', variant: 'success' })
        setEditingCell(null)
        return
      }

      // Use upsert approach: delete existing then insert new
      // This avoids the unique constraint issue
      console.log('[TeamHub] Assigning:', { clientId, role, userId })
      
      // First, delete any existing assignment for this client+role
      const { error: deleteError } = await supabase
          .from('client_team_assignments')
        .delete()
        .eq('client_id', clientId)
        .eq('role', role)
      
      if (deleteError) {
        console.warn('[TeamHub] Delete warning (non-fatal):', deleteError)
      }

      // Then insert the new assignment (without join to avoid schema cache issue)
      const { error: insertError } = await supabase
        .from('client_team_assignments')
        .insert({ 
          client_id: clientId, 
          role: role, 
          user_id: userId 
        })
      
      if (insertError) {
        console.error('[TeamHub] Insert error:', insertError)
        throw insertError
      }
      
      console.log('[TeamHub] Inserted assignment successfully')

      // Find the team member name for the toast
      const member = teamMembers.find(m => m.id === userId)

      // Refresh all assignments - fetch without join first, then enrich with user data
      const { data: assignmentsData, error: fetchError } = await supabase
        .from('client_team_assignments')
        .select('*')
      
      if (fetchError) {
        console.error('[TeamHub] Fetch error:', fetchError)
      }
      
      // Enrich with user data from teamMembers state
      const enrichedData = (assignmentsData || []).map(a => ({
        ...a,
        user: teamMembers.find(m => m.id === a.user_id) || null
      }))
      
      console.log('[TeamHub] Refreshed assignments:', enrichedData?.length, 'records')
      setTeamAssignments(enrichedData)
      
      toast({ 
        title: '✅ Team member assigned', 
        description: `${member?.full_name || 'Team member'} is now the ${role.replace(/_/g, ' ')}`,
        variant: 'success' 
      })
    } catch (error) {
      console.error('[TeamHub] Assignment error:', error)
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' })
    }
    setEditingCell(null)
  }

  // Get ad spend for client/platform/month
  const getAdSpendValue = (clientId, platform, month, field) => {
    const record = adSpend.find(
      a => a.client_id === clientId && a.platform === platform && 
           a.year === selectedYear && a.month === month
    )
    return record?.[field] || 0
  }

  // Update ad spend
  const updateAdSpend = async (clientId, platform, month, field, value) => {
    try {
      const existing = adSpend.find(
        a => a.client_id === clientId && a.platform === platform && 
             a.year === selectedYear && a.month === month
      )

      const numValue = parseFloat(value) || 0

      if (existing) {
        const { error } = await supabase
          .from('ad_spend')
          .update({ [field]: numValue })
          .eq('id', existing.id)
        
        if (error) {
          console.error('[TeamHub] Error updating ad spend:', error)
          toast({ title: 'Error updating', description: error.message, variant: 'destructive' })
          setEditingCell(null)
          return
        }
      } else {
        const { error } = await supabase
          .from('ad_spend')
          .insert({ 
            client_id: clientId, 
            platform, 
            year: selectedYear,
            month,
            [field]: numValue 
          })
        
        if (error) {
          console.error('[TeamHub] Error inserting ad spend:', error)
          toast({ title: 'Error adding', description: error.message, variant: 'destructive' })
          setEditingCell(null)
          return
        }
      }

      // Refresh
      const { data, error: fetchError } = await supabase.from('ad_spend').select('*').order('month')
      if (fetchError) {
        console.error('[TeamHub] Error fetching ad spend:', fetchError)
      }
      setAdSpend(data || [])
      
      toast({ title: '✅ Updated', variant: 'success' })
    } catch (error) {
      console.error('[TeamHub] Exception updating ad spend:', error)
      toast({ title: 'Error updating', description: error.message, variant: 'destructive' })
    }
    setEditingCell(null)
  }

  // Get unique client/platform combinations for ad spend
  const getAdSpendRows = () => {
    const rows = []
    const yearSpend = adSpend.filter(a => a.year === selectedYear)
    
    // Group by client
    clients.forEach(client => {
      const clientSpend = yearSpend.filter(a => a.client_id === client.id)
      const platforms = [...new Set(clientSpend.map(s => s.platform))]
      
      if (platforms.length === 0) {
        // No spend data yet, show placeholder
        rows.push({ client, platform: null, isPlaceholder: true })
      } else {
        platforms.forEach(platform => {
          rows.push({ client, platform, isPlaceholder: false })
        })
      }
    })
    
    return rows
  }

  // Filter clients
  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate totals
  const totalBudget = adSpend
    .filter(a => a.year === selectedYear)
    .reduce((sum, a) => sum + (a.budget || 0), 0)
  const totalActuals = adSpend
    .filter(a => a.year === selectedYear)
    .reduce((sum, a) => sum + (a.actuals || 0), 0)

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">
        <div className="mb-8">
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
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
      className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-brand-teal/10">
                <Users className="h-6 w-6 text-brand-teal" />
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold">Team Hub</h1>
            </div>
            <p className="text-sm sm:text-lg text-muted-foreground">
              Client overview, team assignments & ad spend budgets
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 sm:mr-2", refreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 md:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-brand-orange/10 to-brand-coral/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Clients</p>
                  <p className="text-3xl font-bold mt-1">
                    {clients.length}
                  </p>
                </div>
                <Building2 className="h-8 w-8 text-brand-orange/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-brand-blue/10 to-cyan-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="text-3xl font-bold mt-1">
                    {teamMembers.length}
                  </p>
                </div>
                <Users className="h-8 w-8 text-brand-blue/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedYear} Budget</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(totalBudget)}
                  </p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-brand-purple/10 to-purple-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{selectedYear} Actuals</p>
                  <p className="text-3xl font-bold mt-1">
                    {formatCurrency(totalActuals)}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-brand-purple/50" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Tabs */}
      <Tabs defaultValue="team" className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <TabsList className="bg-muted/50 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="team" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Team Members</span>
              <span className="sm:hidden">Team</span>
            </TabsTrigger>
            <TabsTrigger value="shoutouts" className="gap-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="hidden sm:inline">Shoutouts</span>
              <span className="sm:hidden">🎉</span>
              {myShoutouts.length > 0 && (
                <Badge className="ml-1 h-5 px-1.5 bg-pink-500 text-white text-xs">
                  {myShoutouts.length}
                </Badge>
              )}
            </TabsTrigger>
            {isActualAdmin && (
              <TabsTrigger value="rates" className="gap-2">
                <PiggyBank className="h-4 w-4" />
                <span className="hidden sm:inline">Rates & Profitability</span>
                <span className="sm:hidden">Rates</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="roster" className="gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Client Roster</span>
              <span className="sm:hidden">Roster</span>
            </TabsTrigger>
            <TabsTrigger value="adspend" className="gap-2">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Ad Spend Budgets</span>
              <span className="sm:hidden">Ad Spend</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Team Members Tab */}
        <TabsContent value="team">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-orange" />
                  Team Members
                </CardTitle>
                <p className="text-muted-foreground">
                  Your Brandastic team - click on anyone to see their full profile
                </p>
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No team members found</p>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {teamMembers
                      .filter(m => m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || !searchQuery)
                      .map((member) => {
                        // Calculate years at company
                        const yearsAtCompany = member.work_start_date 
                          ? Math.floor((new Date() - new Date(member.work_start_date)) / (365.25 * 24 * 60 * 60 * 1000))
                          : null
                        
                        // Format birthday
                        const birthdayDisplay = member.birthday && member.show_birthday
                          ? new Date(member.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : null

                        // Check if birthday is upcoming (within 7 days)
                        const isBirthdaySoon = member.birthday && member.show_birthday && (() => {
                          const today = new Date()
                          const bday = new Date(member.birthday + 'T00:00:00')
                          bday.setFullYear(today.getFullYear())
                          const diff = bday - today
                          return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000
                        })()

                        return (
                          <Link
                            key={member.id}
                            to={`/team/${member.id}`}
                            className="block group"
                          >
                            <motion.div
                              variants={itemVariants}
                              whileHover={{ y: -2 }}
                              className="p-4 rounded-xl border hover:shadow-lg hover:border-brand-orange/30 transition-all bg-card"
                            >
                              {/* Header with Avatar */}
                              <div className="flex items-center gap-3 mb-3">
                                <Avatar className="h-14 w-14 border-2 border-background shadow" title={member.full_name}>
                                  <AvatarImage src={member.avatar_url} alt={member.full_name} />
                                  <AvatarFallback className="bg-brand-orange text-white text-lg">
                                    {member.full_name?.[0] || '?'}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-semibold truncate group-hover:text-brand-orange transition-colors">
                                    {member.full_name || 'Team Member'}
                                  </h3>
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {member.role || 'Team'}
                                  </Badge>
                                </div>
                                {isBirthdaySoon && (
                                  <div className="p-1.5 rounded-full bg-pink-500/10 animate-pulse">
                                    <Cake className="h-4 w-4 text-pink-500" />
                                  </div>
                                )}
                              </div>

                              {/* Tagline */}
                              {member.tagline && (
                                <p className="text-sm text-muted-foreground mb-3 line-clamp-2 italic">
                                  "{member.tagline}"
                                </p>
                              )}

                              {/* Quick Info */}
                              <div className="space-y-1.5 text-sm">
                                {member.email && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span className="truncate">{member.email}</span>
                                  </div>
                                )}
                                {yearsAtCompany !== null && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Briefcase className="h-3.5 w-3.5" />
                                    <span>
                                      {yearsAtCompany === 0 ? 'New this year' : `${yearsAtCompany}+ years`}
                                    </span>
                                  </div>
                                )}
                                {birthdayDisplay && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Cake className="h-3.5 w-3.5 text-pink-500" />
                                    <span>{birthdayDisplay}</span>
                                  </div>
                                )}
                              </div>

                              {/* View Profile Link */}
                              <div className="mt-3 pt-3 border-t flex items-center justify-end">
                                <span className="text-xs text-brand-orange font-medium flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  View Profile <ArrowRight className="h-3 w-3" />
                                </span>
                              </div>
                            </motion.div>
                          </Link>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Shoutouts Tab */}
        <TabsContent value="shoutouts">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Heart className="h-5 w-5 text-pink-500" />
                      Team Shoutouts 💝
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Appreciate your teammates! Give shoutouts for great work.
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShoutoutDialogOpen(true)}
                    className="bg-pink-500 hover:bg-pink-600"
                  >
                    <Heart className="h-4 w-4 mr-2" />
                    Give a Shoutout
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {shoutouts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Heart className="h-12 w-12 mx-auto mb-4 opacity-30 text-pink-400" />
                    <p className="text-lg font-medium mb-1">No shoutouts yet</p>
                    <p className="text-sm mb-4">Be the first to appreciate a teammate!</p>
                    <Button 
                      className="bg-pink-500 hover:bg-pink-600"
                      onClick={() => setShoutoutDialogOpen(true)}
                    >
                      <PartyPopper className="h-4 w-4 mr-2" />
                      Send First Shoutout
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {shoutouts.map((shoutout) => {
                      const fromUser = teamMembers.find(m => m.id === shoutout.from_user_id)
                      const toUser = teamMembers.find(m => m.id === shoutout.to_user_id)
                      const isForMe = shoutout.to_user_id === profile?.id
                      
                      return (
                        <motion.div
                          key={shoutout.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "p-4 rounded-xl border-2 transition-all",
                            isForMe 
                              ? "border-pink-300 bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/20 dark:to-purple-900/20"
                              : "border-muted bg-card hover:border-pink-200"
                          )}
                        >
                          <div className="flex items-start gap-4">
                            <Avatar className="h-12 w-12 border-2 border-pink-200">
                              <AvatarImage src={fromUser?.avatar_url} />
                              <AvatarFallback className="bg-pink-100 text-pink-600">
                                {fromUser?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{fromUser?.full_name || 'Someone'}</span>
                                <span className="text-muted-foreground">→</span>
                                <span className="font-semibold text-pink-600">{toUser?.full_name || 'Someone'}</span>
                                {isForMe && (
                                  <Badge className="bg-pink-500 text-white text-xs">That's you! 🎉</Badge>
                                )}
                              </div>
                              <p className="text-sm mb-2">{shoutout.message}</p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-xs">
                                  {shoutout.category === 'appreciation' && '💖 Appreciation'}
                                  {shoutout.category === 'teamwork' && '🤝 Teamwork'}
                                  {shoutout.category === 'above_beyond' && '🚀 Above & Beyond'}
                                  {shoutout.category === 'creativity' && '🎨 Creativity'}
                                  {shoutout.category === 'problem_solving' && '🧠 Problem Solving'}
                                  {shoutout.category === 'client_success' && '🏆 Client Success'}
                                  {!['appreciation', 'teamwork', 'above_beyond', 'creativity', 'problem_solving', 'client_success'].includes(shoutout.category) && '✨ Kudos'}
                                </Badge>
                                <span>
                                  {shoutout.created_at ? new Date(shoutout.created_at).toLocaleDateString() : 'Recently'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Rates & Profitability Tab (Admin Only) */}
        {isActualAdmin && (
          <TabsContent value="rates">
            <motion.div variants={itemVariants} className="space-y-6">
              {/* Overhead Settings Card */}
              <Card className="border-brand-orange/30 bg-gradient-to-r from-brand-orange/5 to-transparent">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-brand-orange" />
                        Company Overhead Settings
                      </CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Overhead is distributed across billable hours to calculate true project costs
                      </p>
                    </div>
                    {!editingOverhead && (
                      <Button variant="outline" size="sm" onClick={() => setEditingOverhead(true)}>
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {editingOverhead ? (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Monthly Overhead</Label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            defaultValue={monthlyOverhead}
                            id="overhead-input"
                            className="pl-7"
                            placeholder="37000"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">Rent, utilities, software, insurance, etc.</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Target Billable Hours/Month</Label>
                        <Input
                          type="number"
                          defaultValue={targetBillableHours}
                          id="hours-input"
                          placeholder="745"
                        />
                        <p className="text-xs text-muted-foreground">Total hours across all clients</p>
                      </div>
                      <div className="flex items-end gap-2">
                        <Button
                          onClick={() => {
                            const overhead = parseFloat(document.getElementById('overhead-input').value) || 37000
                            const hours = parseFloat(document.getElementById('hours-input').value) || 745
                            saveOverheadSettings(overhead, hours)
                          }}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                        <Button variant="outline" onClick={() => setEditingOverhead(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-6 md:grid-cols-4">
                      <div className="text-center p-4 rounded-xl bg-background border">
                        <p className="text-2xl font-bold text-brand-orange">${monthlyOverhead.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Monthly Overhead</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-background border">
                        <p className="text-2xl font-bold text-brand-blue">{targetBillableHours}hrs</p>
                        <p className="text-xs text-muted-foreground mt-1">Target Billable Hours</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-background border">
                        <p className="text-2xl font-bold text-brand-purple">${overheadPerHour.toFixed(2)}/hr</p>
                        <p className="text-xs text-muted-foreground mt-1">Overhead Per Hour</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-background border">
                        <p className="text-2xl font-bold text-green-500">
                          ${(175 - overheadPerHour - (teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / (teamMembers.length || 1))).toFixed(0)}/hr
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Avg Net Profit/Hr</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg. Labor Cost</p>
                        <p className="text-3xl font-bold mt-1">
                          ${teamMembers.length > 0 
                            ? Math.round(teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length)
                            : 0}/hr
                        </p>
                      </div>
                      <User className="h-8 w-8 text-blue-500/50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Fully Loaded Cost</p>
                        <p className="text-3xl font-bold mt-1">
                          ${teamMembers.length > 0 
                            ? Math.round((teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length) + overheadPerHour)
                            : 0}/hr
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Labor + Overhead</p>
                      </div>
                      <Building2 className="h-8 w-8 text-purple-500/50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-brand-orange/10 to-brand-coral/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Client Billing Rate</p>
                        <p className="text-3xl font-bold mt-1">$175/hr</p>
                      </div>
                      <TrendingUp className="h-8 w-8 text-brand-orange/50" />
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5">
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">True Net Margin</p>
                        <p className="text-3xl font-bold mt-1">
                          {teamMembers.length > 0 
                            ? Math.round((1 - ((teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length) + overheadPerHour) / 175) * 100)
                            : 0}%
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">After overhead</p>
                      </div>
                      <Percent className="h-8 w-8 text-green-500/50" />
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Employee Rates Table */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-green-500" />
                    Employee Hourly Rates
                  </CardTitle>
                  <p className="text-muted-foreground">
                    Set the labor cost for each team member. Overhead (${overheadPerHour.toFixed(2)}/hr) is added automatically.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border overflow-hidden overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left py-3 px-4 font-medium">Employee</th>
                          <th className="text-left py-3 px-4 font-medium">Job Title</th>
                          <th className="text-center py-3 px-4 font-medium">
                            <div>Labor Cost</div>
                            <div className="text-xs font-normal text-muted-foreground">Direct</div>
                          </th>
                          <th className="text-center py-3 px-4 font-medium">
                            <div>+ Overhead</div>
                            <div className="text-xs font-normal text-muted-foreground">${overheadPerHour.toFixed(2)}/hr</div>
                          </th>
                          <th className="text-center py-3 px-4 font-medium bg-brand-purple/10">
                            <div>Fully Loaded</div>
                            <div className="text-xs font-normal text-muted-foreground">True Cost</div>
                          </th>
                          <th className="text-center py-3 px-4 font-medium">
                            <div>Gross Margin</div>
                            <div className="text-xs font-normal text-muted-foreground">Labor only</div>
                          </th>
                          <th className="text-center py-3 px-4 font-medium bg-green-500/10">
                            <div>Net Margin</div>
                            <div className="text-xs font-normal text-muted-foreground">With overhead</div>
                          </th>
                          <th className="text-right py-3 px-4 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-12 text-muted-foreground">
                              No team members found
                            </td>
                          </tr>
                        ) : (
                          teamMembers.map((member) => {
                            const laborCost = member.cost_rate || 50
                            const fullyLoadedCost = laborCost + overheadPerHour
                            const billingRate = 175
                            const grossMargin = Math.round((1 - laborCost / billingRate) * 100)
                            const netMargin = Math.round((1 - fullyLoadedCost / billingRate) * 100)
                            const profitPerHour = billingRate - fullyLoadedCost
                            const isEditing = editingRate === member.id
                            
                            return (
                              <tr key={member.id} className="border-t hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9">
                                      <AvatarImage src={member.avatar_url} />
                                      <AvatarFallback className="bg-brand-orange text-white">
                                        {member.full_name?.[0] || '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div>
                                      <p className="font-medium">{member.full_name || 'Team Member'}</p>
                                      <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {member.job_title || member.department || '-'}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <span className="text-muted-foreground text-sm">$</span>
                                      <Input
                                        type="number"
                                        value={rateValue}
                                        onChange={(e) => setRateValue(e.target.value)}
                                        className="w-16 h-8 text-center text-sm"
                                        autoFocus
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateEmployeeRate(member.id, rateValue)
                                          } else if (e.key === 'Escape') {
                                            setEditingRate(null)
                                            setRateValue('')
                                          }
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="font-medium">${laborCost}</span>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center text-muted-foreground">
                                  +${overheadPerHour.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 text-center bg-brand-purple/5">
                                  <span className="font-bold text-brand-purple">${fullyLoadedCost.toFixed(2)}</span>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span className="text-muted-foreground">{grossMargin}%</span>
                                </td>
                                <td className="py-3 px-4 text-center bg-green-500/5">
                                  <Badge 
                                    variant={netMargin >= 50 ? 'default' : netMargin >= 30 ? 'secondary' : 'destructive'}
                                    className={cn(
                                      netMargin >= 50 && 'bg-green-500 text-white',
                                      netMargin >= 30 && netMargin < 50 && 'bg-yellow-500 text-white'
                                    )}
                                  >
                                    {netMargin}%
                                  </Badge>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    ${profitPerHour.toFixed(0)}/hr profit
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingRate(null)
                                          setRateValue('')
                                        }}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="sm"
                                        onClick={() => updateEmployeeRate(member.id, rateValue)}
                                        disabled={savingRate}
                                      >
                                        {savingRate ? (
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Save className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditingRate(member.id)
                                        setRateValue(String(laborCost))
                                      }}
                                    >
                                      <Edit2 className="h-4 w-4 mr-1" />
                                      Edit
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                      {/* Totals Row */}
                      {teamMembers.length > 0 && (
                        <tfoot className="bg-muted/30 font-medium">
                          <tr className="border-t-2">
                            <td colSpan={2} className="py-3 px-4">
                              <strong>Team Average</strong>
                            </td>
                            <td className="py-3 px-4 text-center">
                              ${Math.round(teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              +${overheadPerHour.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center bg-brand-purple/5">
                              <strong className="text-brand-purple">
                                ${((teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length) + overheadPerHour).toFixed(2)}
                              </strong>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {Math.round((1 - (teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length) / 175) * 100)}%
                            </td>
                            <td className="py-3 px-4 text-center bg-green-500/5">
                              <strong className="text-green-600">
                                {Math.round((1 - ((teamMembers.reduce((sum, m) => sum + (m.cost_rate || 50), 0) / teamMembers.length) + overheadPerHour) / 175) * 100)}%
                              </strong>
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                  
                  {/* Info Box */}
                  <div className="mt-4 p-4 rounded-xl bg-muted/50 border">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-brand-orange" />
                      How Profitability is Calculated
                    </h4>
                    <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <p className="font-medium text-foreground mb-1">Per Hour Breakdown:</p>
                        <ul className="space-y-1">
                          <li>• <strong>Revenue:</strong> $175/hr (client billing)</li>
                          <li>• <strong>Labor Cost:</strong> Employee's hourly cost</li>
                          <li>• <strong>Overhead:</strong> ${overheadPerHour.toFixed(2)}/hr (${monthlyOverhead.toLocaleString()} ÷ {targetBillableHours}hrs)</li>
                          <li>• <strong>Fully Loaded:</strong> Labor + Overhead</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-medium text-foreground mb-1">Margin Calculations:</p>
                        <ul className="space-y-1">
                          <li>• <strong>Gross Margin:</strong> ($175 - Labor) ÷ $175</li>
                          <li>• <strong>Net Margin:</strong> ($175 - Fully Loaded) ÷ $175</li>
                          <li>• <strong>Profit/Hr:</strong> $175 - Fully Loaded Cost</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        )}

        {/* Client Roster Tab */}
        <TabsContent value="roster">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">Client Roster & Team Assignments</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Click any cell to edit. Changes save automatically.
                </p>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-brand-teal text-white">
                      <tr>
                        <th className="text-left py-3 px-4 font-medium sticky left-0 bg-brand-teal z-10 min-w-[180px]">
                          Client
                        </th>
                        <th className="text-left py-3 px-4 font-medium min-w-[200px]">
                          Account Services
                        </th>
                        <th className="text-center py-3 px-4 font-medium min-w-[110px]">
                          Renewal Date
                        </th>
                        <th className="text-center py-3 px-4 font-medium min-w-[80px]">
                          Monthly Hours
                        </th>
                        {teamRoles.map(role => (
                          <th key={role.key} className="text-center py-3 px-4 font-medium min-w-[130px]">
                            {role.label}
                          </th>
                        ))}
                        <th className="text-center py-3 px-4 font-medium min-w-[100px]">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setManageRolesOpen(true)}
                            className="text-white hover:bg-white/20"
                          >
                            <Edit2 className="h-3 w-3 mr-1" />
                            Roles
                          </Button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={5 + teamRoles.length} className="text-center py-12 text-muted-foreground">
                            No clients found
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((client, index) => (
                          <motion.tr
                            key={client.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={cn(
                              "border-b hover:bg-muted/30 transition-colors",
                              index % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                            )}
                          >
                            <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: client.color || '#F7931E' }}
                                />
                                <span className="font-medium">{client.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {client.account_services?.join(', ') || '-'}
                            </td>
                            <td className="py-2 px-2">
                              {editingRenewalDate === client.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="date"
                                    value={renewalDateValue}
                                    onChange={(e) => setRenewalDateValue(e.target.value)}
                                    className="h-8 text-sm w-[130px]"
                                  />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => updateRenewalDate(client.id, renewalDateValue)}
                                  >
                                    <Check className="h-3 w-3 text-green-500" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => {
                                      setEditingRenewalDate(null)
                                      setRenewalDateValue('')
                                    }}
                                  >
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingRenewalDate(client.id)
                                    setRenewalDateValue(client.renewal_date || '')
                                  }}
                                  className={cn(
                                    "w-full py-2 px-2 rounded-lg text-sm text-center transition-all cursor-pointer",
                                    "border-2 border-dashed hover:shadow-sm",
                                    client.renewal_date 
                                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 hover:border-blue-400 text-foreground" 
                                      : "bg-muted/30 border-muted-foreground/20 hover:border-brand-orange/50 hover:bg-brand-orange/5 text-muted-foreground"
                                  )}
                                  title={client.renewal_date ? `Edit renewal date: ${formatDate(client.renewal_date)}` : "Click to add renewal date"}
                                >
                                  {client.renewal_date ? (
                                    <span className="flex items-center justify-center gap-1">
                                      <Calendar className="h-3 w-3" />
                                      {formatDate(client.renewal_date)}
                                    </span>
                                  ) : (
                                    <span className="flex items-center justify-center gap-1">
                                      <Plus className="h-3 w-3" />
                                      Add
                                    </span>
                                  )}
                                </button>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">
                              {client.monthly_hours || '-'}
                            </td>
                            {teamRoles.map(role => {
                              const cellKey = `${client.id}-${role.key}`
                              const displayValue = getAssignment(client.id, role.key)
                              const currentUserId = getAssignmentUserId(client.id, role.key)
                              const isEditing = editingCell === cellKey

                              {
                              // Find the assigned user to show their avatar
                              const assignedUser = teamAssignments.find(
                                a => a.client_id === client.id && a.role === role.key
                              )?.user

                              return (
                                <td key={role.key} className="py-2 px-2">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <Select
                                        defaultValue={currentUserId || 'none'}
                                        onValueChange={(value) => {
                                          updateAssignment(client.id, role.key, value)
                                        }}
                                      >
                                        <SelectTrigger className="h-9 text-sm min-w-[150px] bg-white border-2 border-brand-orange">
                                          <SelectValue placeholder="Select person..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="none">
                                            <span className="text-muted-foreground italic">— Remove —</span>
                                          </SelectItem>
                                          {teamMembers.map(member => (
                                            <SelectItem key={member.id} value={member.id}>
                                              <div className="flex items-center gap-2">
                                                <Avatar className="h-5 w-5">
                                                  <AvatarImage src={member.avatar_url} />
                                                  <AvatarFallback className="text-[10px] bg-brand-orange/20">
                                                    {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                                  </AvatarFallback>
                                                </Avatar>
                                                <span>{member.full_name}</span>
                                              </div>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        onClick={() => setEditingCell(null)}
                                        className="h-8 w-8"
                                      >
                                        <X className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingCell(cellKey)
                                      }}
                                      className={cn(
                                        "w-full py-2 px-3 rounded-lg text-sm text-center transition-all cursor-pointer",
                                        "border-2 border-dashed hover:shadow-sm",
                                        displayValue 
                                          ? "bg-brand-teal/10 border-brand-teal/30 hover:border-brand-teal/50 text-foreground font-medium" 
                                          : "bg-muted/30 border-muted-foreground/20 hover:border-brand-orange/50 hover:bg-brand-orange/5 text-muted-foreground"
                                      )}
                                      title={displayValue ? `Click to change ${role.label}: ${displayValue}` : `Click to assign ${role.label}`}
                                    >
                                      {displayValue ? (
                                        <div className="flex items-center justify-center gap-2">
                                          {assignedUser?.avatar_url && (
                                            <Avatar className="h-5 w-5">
                                              <AvatarImage src={assignedUser.avatar_url} />
                                              <AvatarFallback className="text-[10px]">
                                                {displayValue?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                                              </AvatarFallback>
                                            </Avatar>
                                          )}
                                          <span>{displayValue}</span>
                                        </div>
                                      ) : (
                                        <span className="flex items-center justify-center gap-1">
                                          <Plus className="h-3 w-3" />
                                          Assign
                                        </span>
                                      )}
                                    </button>
                                  )}
                                </td>
                              )
                            }
                            })}
                            {/* Empty cell for Manage Roles column */}
                            <td className="py-2 px-2"></td>
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

        {/* Ad Spend Tab */}
        <TabsContent value="adspend">
          <motion.div variants={itemVariants} className="space-y-4">
            {/* Year Selector */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(y => y - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-2xl font-bold w-20 text-center">{selectedYear}</span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSelectedYear(y => y + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => setAddSpendDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Platform Budget
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-brand-teal text-white">
                        <th className="text-left py-3 px-4 font-medium sticky left-0 bg-brand-teal z-10 min-w-[150px]">
                          Client
                        </th>
                        <th className="text-left py-3 px-4 font-medium min-w-[150px]">
                          Platform
                        </th>
                        {MONTHS.map((month, i) => (
                          <th key={month} colSpan={2} className="text-center py-2 px-1 font-medium border-l border-white/20">
                            <div className="text-xs">{month.slice(0, 3)}</div>
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-brand-teal/80 text-white text-xs">
                        <th className="sticky left-0 bg-brand-teal/80 z-10"></th>
                        <th></th>
                        {MONTHS.map((month) => (
                          <>
                            <th key={`${month}-a`} className="py-1 px-1 font-normal border-l border-white/20">Actuals</th>
                            <th key={`${month}-b`} className="py-1 px-1 font-normal">Budget</th>
                          </>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.map((client, clientIndex) => {
                        const clientSpend = adSpend.filter(
                          a => a.client_id === client.id && a.year === selectedYear
                        )
                        const platforms = [...new Set(clientSpend.map(s => s.platform))]
                        
                        if (platforms.length === 0) {
                          return (
                            <tr
                              key={client.id}
                              className={cn(
                                "border-b",
                                clientIndex % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                              )}
                            >
                              <td className="py-3 px-4 sticky left-0 bg-inherit z-10">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: client.color || '#F7931E' }}
                                  />
                                  <span className="font-medium">{client.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-muted-foreground text-sm italic" colSpan={1 + MONTHS.length * 2}>
                                No ad spend data
                              </td>
                            </tr>
                          )
                        }

                        return platforms.map((platform, platformIndex) => (
                          <tr
                            key={`${client.id}-${platform}`}
                            className={cn(
                              "border-b hover:bg-muted/30",
                              clientIndex % 2 === 0 ? "bg-white dark:bg-background" : "bg-muted/10"
                            )}
                          >
                            {platformIndex === 0 ? (
                              <td
                                className="py-2 px-4 sticky left-0 bg-inherit z-10"
                                rowSpan={platforms.length}
                              >
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: client.color || '#F7931E' }}
                                  />
                                  <span className="font-medium">{client.name}</span>
                                </div>
                              </td>
                            ) : null}
                            <td className="py-2 px-4 text-sm">
                              <Badge variant="outline" className="font-normal">
                                {PLATFORMS.find(p => p.value === platform)?.label || platform}
                              </Badge>
                            </td>
                            {MONTHS.map((_, monthIndex) => {
                              const month = monthIndex + 1
                              const actuals = getAdSpendValue(client.id, platform, month, 'actuals')
                              const budget = getAdSpendValue(client.id, platform, month, 'budget')
                              const status = getBudgetStatus(actuals, budget)
                              
                              const actualsKey = `${client.id}-${platform}-${month}-actuals`
                              const budgetKey = `${client.id}-${platform}-${month}-budget`

                              return (
                                <>
                                  {/* Actuals */}
                                  <td key={actualsKey} className="py-1 px-1 border-l border-muted">
                                    {editingCell === actualsKey ? (
                                      <Input
                                        autoFocus
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="h-7 text-xs w-20"
                                        onBlur={() => {
                                          updateAdSpend(client.id, platform, month, 'actuals', editValue)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateAdSpend(client.id, platform, month, 'actuals', editValue)
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null)
                                          }
                                        }}
                                      />
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setEditingCell(actualsKey)
                                          setEditValue(actuals || '')
                                        }}
                                        className={cn(
                                          "w-full py-1 px-1 text-xs text-right rounded transition-colors hover:bg-muted",
                                          status === 'over' && "text-red-600 font-medium",
                                          status === 'warning' && "text-amber-600",
                                          !actuals && "text-muted-foreground/40"
                                        )}
                                      >
                                        {actuals ? formatCurrency(actuals) : '-'}
                                      </button>
                                    )}
                                  </td>
                                  {/* Budget */}
                                  <td key={budgetKey} className="py-1 px-1">
                                    {editingCell === budgetKey ? (
                                      <Input
                                        autoFocus
                                        type="number"
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="h-7 text-xs w-20"
                                        onBlur={() => {
                                          updateAdSpend(client.id, platform, month, 'budget', editValue)
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateAdSpend(client.id, platform, month, 'budget', editValue)
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null)
                                          }
                                        }}
                                      />
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setEditingCell(budgetKey)
                                          setEditValue(budget || '')
                                        }}
                                        className={cn(
                                          "w-full py-1 px-1 text-xs text-right rounded transition-colors hover:bg-muted",
                                          !budget && "text-muted-foreground/40"
                                        )}
                                      >
                                        {budget ? formatCurrency(budget) : '-'}
                                      </button>
                                    )}
                                  </td>
                                </>
                              )
                            })}
                          </tr>
                        ))
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>

      {/* Give Shoutout Dialog */}
      <Dialog open={shoutoutDialogOpen} onOpenChange={setShoutoutDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-500" />
              Give a Shoutout 💝
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Who are you appreciating? *</Label>
              <Select value={shoutoutTo} onValueChange={setShoutoutTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a teammate" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers
                    .filter(m => m.id !== profile?.id) // Can't shoutout yourself
                    .map(member => (
                      <SelectItem key={member.id} value={member.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="text-xs">
                              {member.full_name?.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          {member.full_name}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={shoutoutCategory} onValueChange={setShoutoutCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="appreciation">💖 General Appreciation</SelectItem>
                  <SelectItem value="teamwork">🤝 Great Teamwork</SelectItem>
                  <SelectItem value="above_beyond">🚀 Above & Beyond</SelectItem>
                  <SelectItem value="creativity">🎨 Creative Thinking</SelectItem>
                  <SelectItem value="problem_solving">🧠 Problem Solving</SelectItem>
                  <SelectItem value="client_success">🏆 Client Success</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Your message *</Label>
              <Textarea
                placeholder="What do you appreciate about this person? Be specific!"
                value={shoutoutMessage}
                onChange={(e) => setShoutoutMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Tip: Specific praise is more meaningful than generic compliments!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShoutoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSendShoutout}
              disabled={sendingShoutout || !shoutoutTo || !shoutoutMessage.trim()}
              className="bg-pink-500 hover:bg-pink-600"
            >
              {sendingShoutout ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Shoutout
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Platform Budget Dialog */}
      <Dialog open={addSpendDialogOpen} onOpenChange={setAddSpendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Platform Budget</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select
                value={newSpend.client_id}
                onValueChange={(v) => setNewSpend(s => ({ ...s, client_id: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Platform</Label>
              <Select
                value={newSpend.platform}
                onValueChange={(v) => setNewSpend(s => ({ ...s, platform: v }))}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Year</Label>
                <Input
                  type="number"
                  value={newSpend.year}
                  onChange={(e) => setNewSpend(s => ({ ...s, year: parseInt(e.target.value) }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Starting Month</Label>
                <Select
                  value={newSpend.month.toString()}
                  onValueChange={(v) => setNewSpend(s => ({ ...s, month: parseInt(v) }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Monthly Budget</Label>
              <Input
                type="number"
                placeholder="$0"
                value={newSpend.budget}
                onChange={(e) => setNewSpend(s => ({ ...s, budget: e.target.value }))}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSpendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!newSpend.client_id) {
                  toast({ title: 'Select a client', variant: 'destructive' })
                  return
                }
                try {
                  const { data, error } = await supabase.from('ad_spend').insert({
                    client_id: newSpend.client_id,
                    platform: newSpend.platform,
                    year: newSpend.year,
                    month: newSpend.month,
                    budget: parseFloat(newSpend.budget) || 0,
                    actuals: 0,
                  }).select()
                  
                  if (error) {
                    console.error('[TeamHub] Error adding budget:', error)
                    toast({ 
                      title: 'Error adding budget', 
                      description: error.message || 'Check if the ad_spend table exists',
                      variant: 'destructive' 
                    })
                    return
                  }
                  
                  console.log('[TeamHub] Budget added successfully:', data)
                  toast({ title: '✅ Budget added', variant: 'success' })
                  setAddSpendDialogOpen(false)
                  setNewSpend({
                    client_id: '',
                    platform: 'facebook',
                    year: new Date().getFullYear(),
                    month: new Date().getMonth() + 1,
                    budget: '',
                  })
                  fetchData(true)
                } catch (error) {
                  console.error('[TeamHub] Exception adding budget:', error)
                  toast({ title: 'Error adding budget', description: error.message, variant: 'destructive' })
                }
              }}
            >
              Add Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Manage Roles Dialog */}
      <Dialog open={manageRolesOpen} onOpenChange={setManageRolesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-brand-orange" />
              Manage Role Columns
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Add new role */}
            <div className="flex gap-2">
              <Input
                placeholder="New role name (e.g., 'Content Writer')"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addRole()}
              />
              <Button onClick={addRole} disabled={!newRoleName.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Existing roles */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Current Roles</Label>
              {teamRoles.map(role => (
                <div 
                  key={role.key} 
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <span className="font-medium">{role.label}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRole(role.key)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {teamRoles.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No roles defined. Add some above!
                </p>
              )}
            </div>
            
            {/* Reset to default */}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setTeamRoles(DEFAULT_TEAM_ROLES)
                localStorage.setItem('team_roster_roles', JSON.stringify(DEFAULT_TEAM_ROLES))
                toast({ title: 'Roles reset to default', variant: 'success' })
              }}
            >
              Reset to Default Roles
            </Button>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setManageRolesOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
