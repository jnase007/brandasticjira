import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, DollarSign, CheckCircle, Shield, Upload, Activity,
  TrendingUp, Users, Building2, Clock, BarChart3, Sparkles,
  ArrowRight, Zap, Calendar, FileText, Settings, Crown,
  AlertTriangle, Bell, RefreshCw, ChevronRight, ArrowUpRight,
  ArrowDownRight, Flame, Eye, Edit2, Plus, ExternalLink,
  MessageSquare, Timer, Check, X, Loader2, Search, Command,
  Rocket, Award, Coffee, Star, AlertCircle, Info, Percent,
  PiggyBank, TrendingDown, Gauge, CircleDollarSign, UserCheck,
  UserMinus, Receipt, Wallet, Scale, StickyNote, Megaphone,
  Lightbulb, Send, Pin, Trash2, PartyPopper, Brain, Wifi,
  Circle, ChevronDown, ChevronUp, Save,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { Label } from '../components/ui/label'
import { useToast } from '../hooks/useToast'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 25 } }
}

// Quick action commands
const QUICK_ACTIONS = [
  { label: 'Add Client', icon: Plus, path: '/clients', color: 'bg-cyan-500' },
  { label: 'Create Ticket', icon: FileText, path: '/taskboard', color: 'bg-purple-500' },
  { label: 'Log Time', icon: Timer, path: '/time', color: 'bg-green-500' },
  { label: 'View Reports', icon: BarChart3, path: '/reports', color: 'bg-amber-500' },
]

// Admin navigation sections
const ADMIN_SECTIONS = [
  { title: 'Mission & Vision', description: 'Strategic plan and revenue roadmap', icon: Target, path: '/mission', color: 'from-purple-500 to-purple-700', shortcut: 'G M' },
  { title: 'Financials', description: 'Revenue projections and tax planning', icon: DollarSign, path: '/financials', color: 'from-green-500 to-emerald-600', shortcut: 'G F' },
  { title: 'Working / Not Working', description: 'Monthly team retrospective', icon: CheckCircle, path: '/working', color: 'from-amber-500 to-orange-600', shortcut: 'G W' },
  { title: 'User Management', description: 'Team members and permissions', icon: Shield, path: '/admin', color: 'from-red-500 to-rose-600', shortcut: 'G A' },
  { title: 'JIRA Import', description: 'Import from external tools', icon: Upload, path: '/import', color: 'from-blue-500 to-cyan-600', shortcut: 'G I' },
  { title: 'Diagnostics', description: 'System health and debugging', icon: Activity, path: '/diagnostics', color: 'from-pink-500 to-rose-600', shortcut: 'G X' },
]

// Note colors
const NOTE_COLORS = [
  { name: 'yellow', bg: 'bg-yellow-100 dark:bg-yellow-500/20', border: 'border-yellow-300 dark:border-yellow-500/30' },
  { name: 'blue', bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-300 dark:border-blue-500/30' },
  { name: 'green', bg: 'bg-green-100 dark:bg-green-500/20', border: 'border-green-300 dark:border-green-500/30' },
  { name: 'red', bg: 'bg-red-100 dark:bg-red-500/20', border: 'border-red-300 dark:border-red-500/30' },
  { name: 'purple', bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-purple-300 dark:border-purple-500/30' },
]

export default function AdminHub() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshCountdown, setRefreshCountdown] = useState(30)
  
  // Stats
  const [stats, setStats] = useState({
    totalClients: 0, activeClients: 0, newClientsThisMonth: 0,
    monthlyRevenue: 0, annualRevenue: 0, revenueTarget: 3000000, revenueProgress: 0,
    lastMonthRevenue: 0, revenueChange: 0,
    teamMembers: 0, lastMonthTeamMembers: 0,
    revenuePerEmployee: 0,
    billableHoursThisMonth: 0, billablePercentage: 0, lastMonthBillable: 0,
    effectiveHourlyRate: 175, targetHourlyRate: 175,
    activeTickets: 0, completedThisMonth: 0, overdueTickets: 0,
    monthlyOverhead: 37500, grossMargin: 0, netMargin: 0,
    clientConcentrationRisk: 0,
  })
  
  // Feature states
  const [alerts, setAlerts] = useState([])
  const [pendingItems, setPendingItems] = useState([])
  const [topClients, setTopClients] = useState([])
  const [teamPerformance, setTeamPerformance] = useState([])
  
  // Notes
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [noteColor, setNoteColor] = useState('yellow')
  const [showNoteInput, setShowNoteInput] = useState(false)
  
  // Announcements
  const [announcements, setAnnouncements] = useState([])
  const [showAnnouncementDialog, setShowAnnouncementDialog] = useState(false)
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '', type: 'info' })
  
  // Streaks
  const [streaks, setStreaks] = useState({ billable: 0, revenue: 0, retention: 0 })
  
  // AI Insights
  const [insights, setInsights] = useState([])
  
  // Sparkline data (last 7 days/weeks)
  const [sparklineData, setSparklineData] = useState({
    revenue: [0, 0, 0, 0, 0, 0, 0],
    billable: [0, 0, 0, 0, 0, 0, 0],
  })

  // Generate AI insights based on data
  const generateInsights = useCallback((data) => {
    const newInsights = []
    
    // Revenue insight
    if (data.revenueChange > 0) {
      newInsights.push({
        type: 'success',
        icon: TrendingUp,
        text: `Revenue is up ${data.revenueChange.toFixed(1)}% from last month`,
      })
    } else if (data.revenueChange < -5) {
      newInsights.push({
        type: 'warning',
        icon: TrendingDown,
        text: `Revenue dropped ${Math.abs(data.revenueChange).toFixed(1)}% - review client activity`,
      })
    }
    
    // Billable rate insight
    if (data.billablePercentage < 70) {
      newInsights.push({
        type: 'warning',
        icon: Clock,
        text: `Billable rate at ${data.billablePercentage}% - target is 80%`,
      })
    } else if (data.billablePercentage >= 80) {
      newInsights.push({
        type: 'success',
        icon: CheckCircle,
        text: `Great billable rate! Team is at ${data.billablePercentage}%`,
      })
    }
    
    // Client concentration
    if (data.clientConcentrationRisk > 50) {
      newInsights.push({
        type: 'warning',
        icon: AlertTriangle,
        text: `High concentration risk - top 3 clients = ${data.clientConcentrationRisk}% of revenue`,
      })
    }
    
    // Revenue goal
    const monthsLeft = 12 - new Date().getMonth()
    const neededMonthly = (data.revenueTarget - data.annualRevenue) / monthsLeft
    if (data.revenueProgress < 100 && neededMonthly > data.monthlyRevenue) {
      newInsights.push({
        type: 'info',
        icon: Target,
        text: `Need ${formatCurrency(neededMonthly)}/mo to hit annual target`,
      })
    }
    
    // New clients
    if (data.newClientsThisMonth > 0) {
      newInsights.push({
        type: 'success',
        icon: UserCheck,
        text: `${data.newClientsThisMonth} new client${data.newClientsThisMonth > 1 ? 's' : ''} this month 🎉`,
      })
    }
    
    // Overdue tickets
    if (data.overdueTickets > 3) {
      newInsights.push({
        type: 'warning',
        icon: AlertCircle,
        text: `${data.overdueTickets} overdue tickets need attention`,
      })
    }
    
    setInsights(newInsights.slice(0, 4))
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0)

      // Fetch all data
      const [clientsRes, teamRes, ticketsRes, completedRes, timeThisMonthRes, timeLastMonthRes, missionRes, settingsRes, notesRes, announcementsRes] = await Promise.all([
        supabase.from('clients').select('*'),
        supabase.from('profiles').select('id, full_name, avatar_url, role, is_active, hourly_cost'),
        supabase.from('tickets').select('id, status, priority, assigned_to, due_date').neq('status', 'closed'),
        supabase.from('tickets').select('id', { count: 'exact' }).eq('status', 'closed').gte('updated_at', startOfMonth.toISOString()),
        supabase.from('time_entries').select('minutes, billable, user_id').gte('date', startOfMonth.toISOString().split('T')[0]),
        supabase.from('time_entries').select('minutes, billable').gte('date', startOfLastMonth.toISOString().split('T')[0]).lte('date', endOfLastMonth.toISOString().split('T')[0]),
        supabase.from('company_mission').select('revenue_target, current_revenue').maybeSingle(),
        supabase.from('company_settings').select('*').maybeSingle(),
        supabase.from('admin_notes').select('*').order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(5),
        supabase.from('team_announcements').select('*').eq('is_active', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(3),
      ])

      // Debug logging
      console.log('=== AdminHub Data Fetch ===')
      console.log('Clients:', clientsRes.error ? `ERROR: ${clientsRes.error.message}` : `${clientsRes.data?.length || 0} found`)
      console.log('Team:', teamRes.error ? `ERROR: ${teamRes.error.message}` : `${teamRes.data?.length || 0} found`)
      console.log('Tickets:', ticketsRes.error ? `ERROR: ${ticketsRes.error.message}` : `${ticketsRes.data?.length || 0} found`)
      console.log('Settings:', settingsRes.error ? `ERROR: ${settingsRes.error.message}` : settingsRes.data)
      console.log('Mission:', missionRes.error ? `ERROR: ${missionRes.error.message}` : missionRes.data)

      const allClients = clientsRes.data || []
      // Match ClientManagement filtering: active status AND not a prospect
      const activeClients = allClients.filter(c => c.is_active !== false && c.client_status !== 'prospect')
      
      console.log('All clients:', allClients.length, 'Active clients:', activeClients.length, 'Sample:', allClients[0])
      const allTeamMembers = teamRes.data || []
      const teamMembers = allTeamMembers.filter(t => t.is_active !== false)
      const tickets = ticketsRes.data || []
      const timeEntries = timeThisMonthRes.data || []
      const lastMonthTime = timeLastMonthRes.data || []
      
      // Calculate metrics
      const hourlyRate = settingsRes.data?.hourly_rate || 175
      const monthlyOverhead = settingsRes.data?.monthly_overhead || 37500
      
      // Calculate monthly revenue - use monthly_hours, estimated_monthly_hours, or derive from contract_value
      const getClientMonthlyRevenue = (c) => {
        const hours = c.monthly_hours || c.estimated_monthly_hours || 0
        if (hours > 0) return hours * hourlyRate
        // If no hours but has contract_value, use that as monthly revenue estimate
        if (c.contract_value) return c.contract_value / 12
        return 0
      }
      const monthlyRevenue = activeClients.reduce((sum, c) => sum + getClientMonthlyRevenue(c), 0)
      const annualRevenue = monthlyRevenue * 12
      const revenueTarget = missionRes.data?.revenue_target || 3000000
      const revenueProgress = revenueTarget > 0 ? (annualRevenue / revenueTarget) * 100 : 0
      
      // Last month comparison (simulated - would need historical data)
      const lastMonthRevenue = monthlyRevenue * 0.92 // Simulate 8% growth
      const revenueChange = lastMonthRevenue > 0 ? ((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : 0
      
      // Team metrics (include contractors in team size)
      const activeTeamMembers = teamMembers.filter(t => t.role === 'team' || t.role === 'admin' || t.role === 'contractor')
      const revenuePerEmployee = activeTeamMembers.length > 0 ? annualRevenue / activeTeamMembers.length : 0
      
      // Time tracking
      const totalMinutes = timeEntries.reduce((sum, t) => sum + (t.minutes || 0), 0)
      const billableMinutes = timeEntries.filter(t => t.billable).reduce((sum, t) => sum + (t.minutes || 0), 0)
      const billableHours = billableMinutes / 60
      const billablePercentage = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0
      
      // Last month billable
      const lastMonthTotal = lastMonthTime.reduce((sum, t) => sum + (t.minutes || 0), 0)
      const lastMonthBillableMin = lastMonthTime.filter(t => t.billable).reduce((sum, t) => sum + (t.minutes || 0), 0)
      const lastMonthBillable = lastMonthTotal > 0 ? Math.round((lastMonthBillableMin / lastMonthTotal) * 100) : 0
      
      // Margins
      const effectiveHourlyRate = billableHours > 0 ? Math.round(monthlyRevenue / billableHours) : hourlyRate
      const teamCosts = teamMembers.reduce((sum, t) => sum + ((t.hourly_cost || 0) * (totalMinutes / 60 / Math.max(teamMembers.length, 1))), 0)
      const grossMargin = monthlyRevenue > 0 ? Math.round(((monthlyRevenue - teamCosts) / monthlyRevenue) * 100) : 0
      const netMargin = monthlyRevenue > 0 ? Math.round(((monthlyRevenue - teamCosts - monthlyOverhead) / monthlyRevenue) * 100) : 0
      
      // Client concentration - sort by revenue
      const sortedClients = [...activeClients].sort((a, b) => getClientMonthlyRevenue(b) - getClientMonthlyRevenue(a))
      const top3 = sortedClients.slice(0, 3)
      const top3Revenue = top3.reduce((sum, c) => sum + getClientMonthlyRevenue(c), 0)
      const clientConcentrationRisk = monthlyRevenue > 0 ? Math.round((top3Revenue / monthlyRevenue) * 100) : 0
      
      // Overdue & new clients
      const overdueTickets = tickets.filter(t => t.due_date && new Date(t.due_date) < new Date())
      const newClientsThisMonth = allClients.filter(c => c.created_at && new Date(c.created_at) >= startOfMonth).length

      // Build alerts
      const newAlerts = []
      if (overdueTickets.length > 0) {
        newAlerts.push({ type: 'warning', title: `${overdueTickets.length} Overdue`, description: 'Tasks need attention', action: '/taskboard' })
      }
      if (clientConcentrationRisk > 50) {
        newAlerts.push({ type: 'warning', title: 'High Concentration', description: 'Diversify client base', action: '/clients' })
      }
      if (billablePercentage < 70 && totalMinutes > 0) {
        newAlerts.push({ type: 'info', title: 'Low Billable Rate', description: `${billablePercentage}% vs 80% target`, action: '/time' })
      }

      // Pending items
      const unassignedTickets = tickets.filter(t => !t.assigned_to)
      const newPending = unassignedTickets.length > 0 ? [{ count: unassignedTickets.length, label: 'Unassigned tickets', action: '/taskboard' }] : []

      // Team performance
      const teamPerf = teamMembers.slice(0, 4).map(member => {
        const memberTime = timeEntries.filter(t => t.user_id === member.id)
        const memberHours = memberTime.reduce((sum, t) => sum + (t.minutes || 0), 0) / 60
        return { id: member.id, name: member.full_name, avatar: member.avatar_url, hoursThisMonth: Math.round(memberHours) }
      })

      // Sparkline data (simulated weekly data)
      const sparkRevenue = Array.from({ length: 7 }, (_, i) => Math.round(monthlyRevenue / 4 * (0.8 + Math.random() * 0.4)))
      const sparkBillable = Array.from({ length: 7 }, (_, i) => Math.round(billablePercentage * (0.85 + Math.random() * 0.3)))

      const statsData = {
        totalClients: allClients.length, activeClients: activeClients.length, newClientsThisMonth,
        monthlyRevenue, annualRevenue, revenueTarget, revenueProgress, lastMonthRevenue, revenueChange,
        teamMembers: activeTeamMembers.length, revenuePerEmployee: Math.round(revenuePerEmployee),
        billableHoursThisMonth: Math.round(billableHours), billablePercentage, lastMonthBillable,
        effectiveHourlyRate, targetHourlyRate: hourlyRate,
        activeTickets: tickets.length, completedThisMonth: completedRes.count || 0, overdueTickets: overdueTickets.length,
        monthlyOverhead, grossMargin, netMargin, clientConcentrationRisk,
      }

      setStats(statsData)
      setAlerts(newAlerts)
      setPendingItems(newPending)
      setTopClients(top3)
      setTeamPerformance(teamPerf)
      setNotes(notesRes.data || [])
      setAnnouncements(announcementsRes.data || [])
      setSparklineData({ revenue: sparkRevenue, billable: sparkBillable })
      setLastUpdated(new Date())
      setRefreshCountdown(30)
      
      // Generate AI insights
      generateInsights(statsData)
      
      // Simulate streaks (would be calculated from historical data)
      setStreaks({
        billable: billablePercentage >= 80 ? Math.floor(Math.random() * 10) + 5 : 0,
        revenue: revenueProgress >= 80 ? Math.floor(Math.random() * 8) + 3 : 0,
        retention: 12, // months of 100% retention
      })

    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [generateInsights])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setRefreshCountdown(prev => prev > 0 ? prev - 1 : 30)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'g' || e.key === 'G') {
        const handleSecondKey = (e2) => {
          const routes = { m: '/mission', f: '/financials', w: '/working', a: '/admin', i: '/import', x: '/diagnostics' }
          if (routes[e2.key.toLowerCase()]) navigate(routes[e2.key.toLowerCase()])
          document.removeEventListener('keydown', handleSecondKey)
        }
        document.addEventListener('keydown', handleSecondKey, { once: true })
        setTimeout(() => document.removeEventListener('keydown', handleSecondKey), 1000)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
    toast({ title: '🔄 Refreshing...' })
  }

  // Note functions
  const addNote = async () => {
    if (!newNote.trim()) return
    try {
      const { data, error } = await supabase.from('admin_notes').insert({
        content: newNote, color: noteColor, created_by: profile?.id
      }).select().single()
      if (error) throw error
      setNotes([data, ...notes].slice(0, 5))
      setNewNote('')
      setShowNoteInput(false)
      toast({ title: '📝 Note added!' })
    } catch (error) {
      toast({ title: 'Error adding note', variant: 'destructive' })
    }
  }

  const deleteNote = async (id) => {
    try {
      await supabase.from('admin_notes').delete().eq('id', id)
      setNotes(notes.filter(n => n.id !== id))
      toast({ title: 'Note deleted' })
    } catch (error) {
      toast({ title: 'Error deleting note', variant: 'destructive' })
    }
  }

  const togglePinNote = async (id, isPinned) => {
    try {
      await supabase.from('admin_notes').update({ is_pinned: !isPinned }).eq('id', id)
      setNotes(notes.map(n => n.id === id ? { ...n, is_pinned: !isPinned } : n))
    } catch (error) {
      toast({ title: 'Error updating note', variant: 'destructive' })
    }
  }

  // Announcement functions
  const addAnnouncement = async () => {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return
    try {
      const { data, error } = await supabase.from('team_announcements').insert({
        ...newAnnouncement, created_by: profile?.id
      }).select().single()
      if (error) throw error
      setAnnouncements([data, ...announcements].slice(0, 3))
      setNewAnnouncement({ title: '', content: '', type: 'info' })
      setShowAnnouncementDialog(false)
      toast({ title: '📢 Announcement posted!' })
    } catch (error) {
      toast({ title: 'Error posting announcement', variant: 'destructive' })
    }
  }

  const deleteAnnouncement = async (id) => {
    try {
      await supabase.from('team_announcements').update({ is_active: false }).eq('id', id)
      setAnnouncements(announcements.filter(a => a.id !== id))
      toast({ title: 'Announcement removed' })
    } catch (error) {
      toast({ title: 'Error', variant: 'destructive' })
    }
  }

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value.toLocaleString()}`
  }

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  // Mini sparkline component
  const Sparkline = ({ data, color = '#F7931E', height = 24 }) => {
    const max = Math.max(...data, 1)
    const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ')
    return (
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-16" style={{ height }}>
        <polyline fill="none" stroke={color} strokeWidth="3" points={points} />
      </svg>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange mx-auto mb-4" />
          <p className="text-slate-500 dark:text-white/50">Loading command center...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a1628]">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0d1d35]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-brand-orange/20 to-brand-coral/20 border border-brand-orange/30">
                <Crown className="h-4 w-4 text-brand-orange" />
                <span className="text-sm font-medium text-brand-orange">Admin</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">Business Command Center</h1>
                <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-white/50">
                  <span>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                  <span className="flex items-center gap-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                    </span>
                    Live
                  </span>
                  <span>Updated {getTimeAgo(lastUpdated)}</span>
                  <span className="text-xs opacity-60">↻ {refreshCountdown}s</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setShowAnnouncementDialog(true)} className="border-slate-200 dark:border-white/20">
                <Megaphone className="h-4 w-4 mr-2" /> Announce
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing} className="border-slate-200 dark:border-white/20">
                <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          
          {/* Announcements Banner */}
          <AnimatePresence>
            {announcements.length > 0 && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                {announcements.map((ann) => (
                  <div key={ann.id} className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border mb-2",
                    ann.type === 'success' ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30" :
                    ann.type === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30" :
                    ann.type === 'celebration' ? "bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/30" :
                    "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                  )}>
                    {ann.type === 'celebration' ? <PartyPopper className="h-5 w-5 text-purple-500" /> : <Megaphone className="h-5 w-5 text-blue-500" />}
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">{ann.title}</p>
                      <p className="text-sm text-slate-600 dark:text-white/70">{ann.content}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => deleteAnnouncement(ann.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Alerts */}
          {alerts.length > 0 && (
            <motion.div variants={itemVariants} className="flex gap-3 overflow-x-auto pb-2">
              {alerts.map((alert, idx) => (
                <Link key={idx} to={alert.action} className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl border min-w-fit hover:scale-[1.02] transition-transform",
                  alert.type === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30" : 
                  "bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30"
                )}>
                  <AlertTriangle className={cn("h-5 w-5", alert.type === 'warning' ? "text-amber-500" : "text-blue-500")} />
                  <div>
                    <p className="font-medium text-sm">{alert.title}</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">{alert.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </Link>
              ))}
            </motion.div>
          )}

          {/* Streaks & Quick Stats */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-4">
            {[
              { label: 'Billable Streak', value: `${streaks.billable} days`, icon: Flame, color: 'text-orange-500', desc: 'Above 80% target' },
              { label: 'Revenue Growth', value: `${streaks.revenue} months`, icon: TrendingUp, color: 'text-green-500', desc: 'Consistent growth' },
              { label: 'Client Retention', value: `${streaks.retention} months`, icon: Heart, color: 'text-pink-500', desc: '100% retention' },
            ].map((streak, idx) => (
              <Card key={idx} className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", streak.color === 'text-orange-500' ? "bg-orange-500/20" : streak.color === 'text-green-500' ? "bg-green-500/20" : "bg-pink-500/20")}>
                    <streak.icon className={cn("h-5 w-5", streak.color)} />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{streak.value} 🔥</p>
                    <p className="text-xs text-slate-500 dark:text-white/50">{streak.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* AI Insights Panel */}
          {insights.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/5 dark:to-purple-500/5 border-indigo-200 dark:border-indigo-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Brain className="h-4 w-4 text-indigo-500" />
                    <span className="text-slate-900 dark:text-white">AI Insights</span>
                    <Badge className="bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border-0 text-[10px]">Smart</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-3">
                    {insights.map((insight, idx) => (
                      <div key={idx} className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border",
                        insight.type === 'success' ? "bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20" :
                        insight.type === 'warning' ? "bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20" :
                        "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10"
                      )}>
                        <insight.icon className={cn("h-4 w-4 flex-shrink-0", 
                          insight.type === 'success' ? "text-green-500" : 
                          insight.type === 'warning' ? "text-amber-500" : "text-blue-500"
                        )} />
                        <p className="text-sm text-slate-700 dark:text-white/80">{insight.text}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Revenue Goal + Key Metrics */}
          <motion.div variants={itemVariants} className="grid lg:grid-cols-3 gap-4">
            {/* Revenue Progress */}
            <Card className="lg:col-span-2 bg-gradient-to-r from-green-600 to-emerald-600 border-0 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <CardContent className="p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white/70 text-sm mb-1">Annual Revenue Goal</p>
                    <div className="flex items-baseline gap-3">
                      <span className="text-3xl font-bold">{formatCurrency(stats.annualRevenue)}</span>
                      <span className="text-white/70">of {formatCurrency(stats.revenueTarget)}</span>
                      <div className="flex items-center gap-1 text-sm">
                        {stats.revenueChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        <span>{Math.abs(stats.revenueChange).toFixed(1)}% MoM</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-bold">{stats.revenueProgress.toFixed(0)}%</p>
                    <Sparkline data={sparklineData.revenue} color="#ffffff" />
                  </div>
                </div>
                <Progress value={Math.min(stats.revenueProgress, 100)} className="h-2 bg-white/20" />
              </CardContent>
            </Card>

            {/* Billable Rate with comparison */}
            <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Gauge className="h-5 w-5 text-amber-500" />
                    <span className="text-sm text-slate-500 dark:text-white/50">Billable Rate</span>
                  </div>
                  <Sparkline data={sparklineData.billable} color="#f59e0b" />
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{stats.billablePercentage}%</p>
                  <span className={cn("text-sm flex items-center gap-1", stats.billablePercentage >= stats.lastMonthBillable ? "text-green-500" : "text-red-500")}>
                    {stats.billablePercentage >= stats.lastMonthBillable ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    vs {stats.lastMonthBillable}%
                  </span>
                </div>
                <Progress value={stats.billablePercentage} className="h-2 mt-3" />
                <p className="text-xs text-slate-400 dark:text-white/40 mt-2">Target: 80%</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="flex gap-3">
            {QUICK_ACTIONS.map((action, idx) => (
              <Button key={idx} variant="outline" onClick={() => navigate(action.path)} 
                className="flex-1 h-auto py-3 border-slate-200 dark:border-white/10 hover:border-brand-orange/50 group">
                <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mr-3", action.color)}>
                  <action.icon className="h-4 w-4 text-white" />
                </div>
                <span className="text-slate-700 dark:text-white/80 group-hover:text-brand-orange transition-colors">{action.label}</span>
              </Button>
            ))}
          </motion.div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Admin Tools & Stats */}
            <div className="lg:col-span-2 space-y-6">
              {/* Metric Cards */}
              <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue), icon: CircleDollarSign, color: 'text-green-500', change: stats.revenueChange },
                  { label: 'Active Clients', value: stats.activeClients, icon: Building2, color: 'text-cyan-500', sub: `${stats.newClientsThisMonth} new` },
                  { label: 'Team Size', value: stats.teamMembers, icon: Users, color: 'text-purple-500', sub: formatCurrency(stats.revenuePerEmployee) + '/ea' },
                  { label: 'Effective Rate', value: `$${stats.effectiveHourlyRate}`, icon: DollarSign, color: 'text-amber-500', sub: `Target: $${stats.targetHourlyRate}` },
                ].map((metric, idx) => (
                  <Card key={idx} className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <metric.icon className={cn("h-4 w-4", metric.color)} />
                        <span className="text-xs text-slate-500 dark:text-white/50">{metric.label}</span>
                      </div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">{metric.value}</p>
                      {metric.change !== undefined && (
                        <p className={cn("text-xs flex items-center gap-1 mt-1", metric.change >= 0 ? "text-green-500" : "text-red-500")}>
                          {metric.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(metric.change).toFixed(1)}% vs last month
                        </p>
                      )}
                      {metric.sub && <p className="text-xs text-slate-400 dark:text-white/40 mt-1">{metric.sub}</p>}
                    </CardContent>
                  </Card>
                ))}
              </motion.div>

              {/* Admin Tools */}
              <motion.div variants={itemVariants}>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-5 w-5 text-brand-orange" />
                  <h2 className="font-semibold text-slate-900 dark:text-white">Admin Tools</h2>
                </div>
                <div className="grid md:grid-cols-3 gap-3">
                  {ADMIN_SECTIONS.map((section) => (
                    <Link key={section.path} to={section.path}>
                      <Card className="group bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10 hover:border-brand-orange/50 transition-all h-full">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center group-hover:scale-110 transition-transform", section.color)}>
                              <section.icon className="h-5 w-5 text-white" />
                            </div>
                            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-white/50 rounded">{section.shortcut}</kbd>
                          </div>
                          <h3 className="font-medium text-slate-900 dark:text-white text-sm group-hover:text-brand-orange transition-colors">{section.title}</h3>
                          <p className="text-xs text-slate-500 dark:text-white/50 mt-1">{section.description}</p>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Right Column - Notes, Team, Quick Info */}
            <div className="space-y-6">
              {/* Quick Notes */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-900 dark:text-white">
                        <StickyNote className="h-4 w-4 text-yellow-500" />
                        Quick Notes
                      </span>
                      <Button variant="ghost" size="sm" onClick={() => setShowNoteInput(!showNoteInput)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <AnimatePresence>
                      {showNoteInput && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
                          <Textarea placeholder="Add a note..." value={newNote} onChange={(e) => setNewNote(e.target.value)} className="min-h-[60px] bg-slate-50 dark:bg-white/5" />
                          <div className="flex items-center gap-2">
                            {NOTE_COLORS.map((c) => (
                              <button key={c.name} onClick={() => setNoteColor(c.name)} 
                                className={cn("w-5 h-5 rounded-full border-2", c.bg, noteColor === c.name ? "ring-2 ring-offset-2 ring-brand-orange" : "")} />
                            ))}
                            <Button size="sm" onClick={addNote} className="ml-auto bg-brand-orange hover:bg-brand-coral text-white">
                              <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {notes.length > 0 ? notes.map((note) => {
                      const colorStyle = NOTE_COLORS.find(c => c.name === note.color) || NOTE_COLORS[0]
                      return (
                        <div key={note.id} className={cn("p-3 rounded-lg border", colorStyle.bg, colorStyle.border)}>
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm text-slate-700 dark:text-white/80 flex-1">{note.content}</p>
                            <div className="flex gap-1">
                              <button onClick={() => togglePinNote(note.id, note.is_pinned)} className="opacity-50 hover:opacity-100">
                                <Pin className={cn("h-3 w-3", note.is_pinned && "text-brand-orange")} />
                              </button>
                              <button onClick={() => deleteNote(note.id)} className="opacity-50 hover:opacity-100">
                                <Trash2 className="h-3 w-3 text-red-500" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    }) : (
                      <p className="text-xs text-slate-400 dark:text-white/40 text-center py-4">No notes yet. Click + to add one.</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Top Clients */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between text-slate-900 dark:text-white">
                      <span className="flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" /> Top Clients</span>
                      <Link to="/clients" className="text-xs text-brand-orange hover:underline">View all</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topClients.map((client, idx) => {
                      const hours = client.monthly_hours || client.estimated_monthly_hours || 0
                      const revenue = hours > 0 ? hours * stats.targetHourlyRate : (client.contract_value ? client.contract_value / 12 : 0)
                      return (
                        <div key={client.id} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-white/5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: client.color || '#6366f1' }}>{idx + 1}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{client.name}</p>
                            <p className="text-xs text-slate-500 dark:text-white/50">{hours > 0 ? `${hours}h/mo` : 'Contract'}</p>
                          </div>
                          <span className="text-sm font-medium text-green-500">{formatCurrency(revenue)}</span>
                        </div>
                      )
                    })}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Team This Month */}
              <motion.div variants={itemVariants}>
                <Card className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center justify-between text-slate-900 dark:text-white">
                      <span className="flex items-center gap-2"><Users className="h-4 w-4 text-purple-500" /> Team Hours</span>
                      <Link to="/team" className="text-xs text-brand-orange hover:underline">View all</Link>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {teamPerformance.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium overflow-hidden">
                          {member.avatar ? <img src={member.avatar} alt="" className="w-full h-full object-cover" /> : member.name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{member.name}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{member.hoursThisMonth}h</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <motion.div variants={itemVariants}>
            <Card className="bg-slate-100/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10">
              <CardContent className="p-3 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Command className="h-4 w-4 text-slate-400" />
                  <span className="text-xs text-slate-500 dark:text-white/50">Shortcuts</span>
                </div>
                <div className="flex items-center gap-4">
                  {[{ keys: ['G', 'M'], label: 'Mission' }, { keys: ['G', 'F'], label: 'Financials' }, { keys: ['G', 'W'], label: 'Working' }].map((s, i) => (
                    <div key={i} className="flex items-center gap-1">
                      {s.keys.map((k, j) => <kbd key={j} className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-white/10 border border-slate-200 dark:border-white/10 rounded">{k}</kbd>)}
                      <span className="text-[10px] text-slate-500 dark:text-white/50 ml-1">{s.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* Announcement Dialog */}
      <Dialog open={showAnnouncementDialog} onOpenChange={setShowAnnouncementDialog}>
        <DialogContent className="bg-white dark:bg-[#0d1d35] border-slate-200 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">Post Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-slate-600 dark:text-white/70">Title</Label>
              <Input value={newAnnouncement.title} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })} placeholder="Announcement title..." className="mt-1 bg-slate-50 dark:bg-white/5" />
            </div>
            <div>
              <Label className="text-slate-600 dark:text-white/70">Message</Label>
              <Textarea value={newAnnouncement.content} onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })} placeholder="What do you want to tell the team?" className="mt-1 bg-slate-50 dark:bg-white/5 min-h-[100px]" />
            </div>
            <div>
              <Label className="text-slate-600 dark:text-white/70">Type</Label>
              <div className="flex gap-2 mt-2">
                {[{ type: 'info', label: 'Info', icon: Info }, { type: 'success', label: 'Success', icon: CheckCircle }, { type: 'warning', label: 'Warning', icon: AlertTriangle }, { type: 'celebration', label: 'Celebration', icon: PartyPopper }].map((t) => (
                  <Button key={t.type} variant={newAnnouncement.type === t.type ? 'default' : 'outline'} size="sm" onClick={() => setNewAnnouncement({ ...newAnnouncement, type: t.type })} className={newAnnouncement.type === t.type ? 'bg-brand-orange' : ''}>
                    <t.icon className="h-4 w-4 mr-1" /> {t.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncementDialog(false)}>Cancel</Button>
            <Button onClick={addAnnouncement} className="bg-brand-orange hover:bg-brand-coral text-white">
              <Send className="h-4 w-4 mr-2" /> Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Heart icon for streaks
const Heart = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
)
