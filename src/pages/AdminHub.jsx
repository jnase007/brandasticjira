import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Target, DollarSign, CheckCircle, Shield, Upload, Activity,
  TrendingUp, Users, Building2, Clock, BarChart3, Sparkles,
  ArrowRight, Zap, Calendar, FileText, Settings, Crown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20 } }
}

// Admin dashboard cards
const ADMIN_SECTIONS = [
  {
    title: 'Mission & Vision',
    description: 'Company strategic plan, goals, and revenue roadmap',
    icon: Target,
    path: '/mission',
    color: 'from-purple-500 to-purple-700',
    badge: 'Strategic',
  },
  {
    title: 'Financials',
    description: 'Revenue projections, team costs, and tax planning',
    icon: DollarSign,
    path: '/financials',
    color: 'from-green-500 to-emerald-600',
    badge: 'Analytics',
  },
  {
    title: 'Working / Not Working',
    description: 'Monthly retrospective on successes and challenges',
    icon: CheckCircle,
    path: '/working',
    color: 'from-amber-500 to-orange-600',
    badge: 'Team',
  },
  {
    title: 'Admin Panel',
    description: 'User management and system configuration',
    icon: Shield,
    path: '/admin',
    color: 'from-red-500 to-rose-600',
    badge: 'System',
  },
  {
    title: 'JIRA Import',
    description: 'Import projects and tasks from JIRA',
    icon: Upload,
    path: '/import',
    color: 'from-blue-500 to-cyan-600',
    badge: 'Tools',
  },
  {
    title: 'Diagnostics',
    description: 'System health checks and debugging tools',
    icon: Activity,
    path: '/diagnostics',
    color: 'from-pink-500 to-rose-600',
    badge: 'Debug',
  },
]

export default function AdminHub() {
  const { profile } = useAuth()
  const [stats, setStats] = useState({
    clients: 0,
    teamMembers: 0,
    activeProjects: 0,
    monthlyRevenue: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [clientsRes, teamRes] = await Promise.all([
        supabase.from('clients').select('id, monthly_hours, is_active'),
        supabase.from('profiles').select('id').eq('is_active', true),
      ])

      const activeClients = (clientsRes.data || []).filter(c => c.is_active !== false)
      const monthlyRevenue = activeClients.reduce((sum, c) => sum + ((c.monthly_hours || 0) * 175), 0)

      setStats({
        clients: activeClients.length,
        teamMembers: teamRes.data?.length || 0,
        activeProjects: activeClients.length * 2, // rough estimate
        monthlyRevenue,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
    setLoading(false)
  }

  const formatCurrency = (value) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
    return `$${value}`
  }

  return (
    <div className="min-h-screen">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-orange/20 via-transparent to-purple-500/20" />
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-brand-orange/10 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-border mb-6">
              <Crown className="h-4 w-4 text-brand-orange" />
              <span className="text-sm text-foreground/70">Admin Dashboard</span>
            </div>
            <h1 className="text-5xl font-bold mb-4">
              Welcome back, <span className="text-brand-orange">{profile?.full_name?.split(' ')[0] || 'Admin'}</span>
            </h1>
            <p className="text-xl text-foreground/50 max-w-2xl mx-auto">
              Your command center for strategic planning, financial oversight, and team management
            </p>
          </motion.div>

          {/* Quick Stats */}
          <motion.div 
            className="grid grid-cols-4 gap-6 mt-12"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {[
              { label: 'Active Clients', value: stats.clients, icon: Building2, color: 'text-cyan-400' },
              { label: 'Team Members', value: stats.teamMembers, icon: Users, color: 'text-purple-400' },
              { label: 'Monthly Revenue', value: formatCurrency(stats.monthlyRevenue), icon: TrendingUp, color: 'text-green-400' },
              { label: 'This Month', value: new Date().toLocaleDateString('en-US', { month: 'long' }), icon: Calendar, color: 'text-amber-400' },
            ].map((stat, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="p-6 rounded-2xl bg-card border backdrop-blur-sm"
              >
                <div className="flex items-center gap-3 mb-3">
                  <stat.icon className={cn("h-5 w-5", stat.color)} />
                  <span className="text-foreground/50 text-sm">{stat.label}</span>
                </div>
                <p className={cn("text-3xl font-bold", stat.color)}>{stat.value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Admin Sections Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Sparkles className="h-6 w-6 text-brand-orange" />
          <h2 className="text-2xl font-bold">Admin Tools</h2>
        </div>

        <motion.div 
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {ADMIN_SECTIONS.map((section, idx) => (
            <motion.div key={section.path} variants={itemVariants}>
              <Link to={section.path}>
                <Card className="group overflow-hidden hover:border-brand-orange/30 transition-all duration-300 h-full">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl bg-gradient-to-br flex items-center justify-center",
                        "shadow-lg group-hover:scale-110 transition-transform duration-300",
                        section.color
                      )}>
                        <section.icon className="h-7 w-7 text-foreground" />
                      </div>
                      <Badge className="bg-white/10 text-foreground/60 border-border">
                        {section.badge}
                      </Badge>
                    </div>
                    
                    <h3 className="text-xl font-semibold text-foreground mb-2 group-hover:text-brand-orange transition-colors">
                      {section.title}
                    </h3>
                    <p className="text-foreground/50 text-sm leading-relaxed mb-4">
                      {section.description}
                    </p>
                    
                    <div className="flex items-center text-brand-orange text-sm font-medium group-hover:translate-x-2 transition-transform">
                      Open <ArrowRight className="h-4 w-4 ml-1" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        {/* Quick Actions */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-r from-brand-orange/10 to-purple-500/10 border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground mb-1">Quick Actions</h3>
              <p className="text-foreground/50 text-sm">Keyboard shortcuts for faster navigation</p>
            </div>
            <div className="flex items-center gap-4">
              {[
                { key: 'G M', label: 'Mission' },
                { key: 'G F', label: 'Financials' },
                { key: 'G W', label: 'Working/Not' },
              ].map((shortcut, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {shortcut.key.split(' ').map((k, i) => (
                      <kbd key={i} className="px-2 py-1 text-xs font-mono bg-white/10 border border-border rounded">
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span className="text-foreground/50 text-sm">{shortcut.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
