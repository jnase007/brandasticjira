import { useState, useEffect } from 'react'
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
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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

const TEAM_ROLES = [
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
  const { profile } = useAuth()
  const { toast } = useToast()
  
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data
  const [clients, setClients] = useState([])
  const [teamAssignments, setTeamAssignments] = useState([])
  const [adSpend, setAdSpend] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  
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

  // Fetch all data
  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const [clientsRes, assignmentsRes, adSpendRes, teamRes] = await Promise.all([
        supabase.from('clients').select('*').eq('is_active', true).order('name'),
        supabase.from('client_team_assignments').select('*'),
        supabase.from('ad_spend').select('*').order('month'),
        supabase.from('profiles').select('*').in('role', ['team', 'admin']).order('full_name'),
      ])

      setClients(clientsRes.data || [])
      setTeamAssignments(assignmentsRes.data || [])
      setAdSpend(adSpendRes.data || [])
      setTeamMembers(teamRes.data || [])
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

  useEffect(() => {
    fetchData()
  }, [])

  // Get assignment for a client/role
  const getAssignment = (clientId, role) => {
    const assignment = teamAssignments.find(
      a => a.client_id === clientId && a.role === role
    )
    return assignment?.user_name || ''
  }

  // Update team assignment
  const updateAssignment = async (clientId, role, userName) => {
    try {
      const existing = teamAssignments.find(
        a => a.client_id === clientId && a.role === role
      )

      if (existing) {
        await supabase
          .from('client_team_assignments')
          .update({ user_name: userName })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('client_team_assignments')
          .insert({ client_id: clientId, role, user_name: userName })
      }

      // Refresh assignments
      const { data } = await supabase.from('client_team_assignments').select('*')
      setTeamAssignments(data || [])
      
      toast({ title: 'Updated', variant: 'success' })
    } catch (error) {
      toast({ title: 'Error updating', variant: 'destructive' })
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
        await supabase
          .from('ad_spend')
          .update({ [field]: numValue })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('ad_spend')
          .insert({ 
            client_id: clientId, 
            platform, 
            year: selectedYear,
            month,
            [field]: numValue 
          })
      }

      // Refresh
      const { data } = await supabase.from('ad_spend').select('*').order('month')
      setAdSpend(data || [])
      
      toast({ title: 'Updated', variant: 'success' })
    } catch (error) {
      toast({ title: 'Error updating', variant: 'destructive' })
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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-brand-teal/10">
                <Users className="h-6 w-6 text-brand-teal" />
              </div>
              <h1 className="text-4xl font-display font-bold">Team Hub</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Client overview, team assignments & ad spend budgets
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
                    <AnimatedCounter value={clients.length} />
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
                    <AnimatedCounter value={teamMembers.length} />
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
      <Tabs defaultValue="roster" className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="roster" className="gap-2">
              <Users className="h-4 w-4" />
              Client Roster
            </TabsTrigger>
            <TabsTrigger value="adspend" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Ad Spend Budgets
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
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
                        {TEAM_ROLES.map(role => (
                          <th key={role.key} className="text-center py-3 px-4 font-medium min-w-[130px]">
                            {role.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={4 + TEAM_ROLES.length} className="text-center py-12 text-muted-foreground">
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
                            <td className="py-3 px-4 text-center text-sm">
                              {client.renewal_date ? formatDate(client.renewal_date) : '-'}
                            </td>
                            <td className="py-3 px-4 text-center font-medium">
                              {client.monthly_hours || '-'}
                            </td>
                            {TEAM_ROLES.map(role => {
                              const cellKey = `${client.id}-${role.key}`
                              const value = getAssignment(client.id, role.key)
                              const isEditing = editingCell === cellKey

                              return (
                                <td key={role.key} className="py-2 px-2">
                                  {isEditing ? (
                                    <div className="flex items-center gap-1">
                                      <Input
                                        autoFocus
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        className="h-8 text-sm"
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            updateAssignment(client.id, role.key, editValue)
                                          } else if (e.key === 'Escape') {
                                            setEditingCell(null)
                                          }
                                        }}
                                      />
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => updateAssignment(client.id, role.key, editValue)}
                                      >
                                        <Check className="h-3 w-3 text-green-500" />
                                      </Button>
                                      <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={() => setEditingCell(null)}
                                      >
                                        <X className="h-3 w-3 text-red-500" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setEditingCell(cellKey)
                                        setEditValue(value)
                                      }}
                                      className={cn(
                                        "w-full py-1 px-2 rounded text-sm text-center transition-colors",
                                        "hover:bg-brand-orange/10 cursor-pointer",
                                        value ? "text-foreground" : "text-muted-foreground/50 italic"
                                      )}
                                    >
                                      {value || '-'}
                                    </button>
                                  )}
                                </td>
                              )
                            })}
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
                  await supabase.from('ad_spend').insert({
                    client_id: newSpend.client_id,
                    platform: newSpend.platform,
                    year: newSpend.year,
                    month: newSpend.month,
                    budget: parseFloat(newSpend.budget) || 0,
                    actuals: 0,
                  })
                  toast({ title: 'Budget added', variant: 'success' })
                  setAddSpendDialogOpen(false)
                  fetchData(true)
                } catch (error) {
                  toast({ title: 'Error adding budget', variant: 'destructive' })
                }
              }}
            >
              Add Budget
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
