import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  DollarSign, Users, TrendingUp, TrendingDown, Calendar,
  Building2, Calculator, PieChart, BarChart3, ArrowUpRight,
  ArrowDownRight, Settings, Download, RefreshCw, Eye, EyeOff,
  ChevronDown, AlertCircle, CheckCircle, Percent, Briefcase,
  Clock, Target, Wallet, CreditCard, Receipt, Coins, Save, Edit2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20 } }
}

// Months
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Default company settings
const DEFAULT_SETTINGS = {
  hourlyRate: 175,
  overheadPercentage: 30,
  targetRPE: 264344, // Revenue Per Employee target
  ficaRate: 0.0765, // 7.65%
  futaRate: 0.006, // 0.6%
  sutaRate: 0.034, // 3.4% CA
  workersCompRate: 0.01, // 1%
  healthInsurancePerEmployee: 500, // monthly
  ptoAccrualRate: 0.0385, // ~2 weeks per year
  monthlyOverhead: 37500,
}

export default function Financials() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [clients, setClients] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  const [timeEntries, setTimeEntries] = useState([])
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [showCosts, setShowCosts] = useState(true)
  const [editingOverhead, setEditingOverhead] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    fetchData()
    fetchSettings()
  }, [selectedYear])

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .single()
      
      if (data) {
        setSettings(s => ({
          ...s,
          monthlyOverhead: data.monthly_overhead ?? s.monthlyOverhead,
          hourlyRate: data.hourly_rate ?? s.hourlyRate,
          targetRPE: data.target_rpe ?? s.targetRPE,
        }))
      }
    } catch (error) {
      // Table might not exist yet, use defaults
      console.log('Using default settings')
    }
  }

  const saveSettings = async () => {
    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('company_settings')
        .upsert({
          id: 1,
          monthly_overhead: settings.monthlyOverhead,
          hourly_rate: settings.hourlyRate,
          target_rpe: settings.targetRPE,
          updated_at: new Date().toISOString(),
          updated_by: profile?.id
        })
      
      if (error) throw error
      
      toast({ title: '✅ Settings saved!', variant: 'success' })
      setEditingOverhead(false)
    } catch (error) {
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' })
    }
    setSavingSettings(false)
  }

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('name')

      // Fetch team members with cost rates
      const { data: teamData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name')

      // Fetch time entries for the year
      const startOfYear = `${selectedYear}-01-01`
      const endOfYear = `${selectedYear}-12-31`
      const { data: timeData } = await supabase
        .from('time_entries')
        .select('*, client:clients(name, monthly_hours), user:profiles(full_name, cost_rate)')
        .gte('date', startOfYear)
        .lte('date', endOfYear)

      setClients(clientsData || [])
      setTeamMembers(teamData || [])
      setTimeEntries(timeData || [])
    } catch (error) {
      console.error('Error fetching financial data:', error)
    }
    setLoading(false)
  }

  // Calculate financials
  const financials = useMemo(() => {
    const hourlyRate = settings.hourlyRate
    const activeClients = clients.filter(c => c.is_active !== false)
    const numEmployees = teamMembers.length || 1

    // Monthly revenue from retainers
    const monthlyRetainerRevenue = activeClients.reduce((sum, c) => sum + ((c.monthly_hours || 0) * hourlyRate), 0)
    
    // Calculate a-la-carte revenue (from tickets with billing_type = 'alacarte')
    const alaCarteRevenue = 5000 // placeholder - would come from tickets
    
    // Total monthly revenue
    const totalMonthlyRevenue = monthlyRetainerRevenue + alaCarteRevenue
    
    // Annual projections
    const annualRevenue = totalMonthlyRevenue * 12
    
    // Team costs calculation
    const teamCosts = teamMembers.map(member => {
      const hourlyRate = member.cost_rate || 50
      const annualGross = hourlyRate * 2080 // 40hrs * 52 weeks
      const monthlyGross = annualGross / 12
      
      // Burden calculations
      const fica = annualGross * settings.ficaRate
      const futa = Math.min(annualGross, 7000) * settings.futaRate
      const suta = Math.min(annualGross, 7000) * settings.sutaRate
      const workersComp = annualGross * settings.workersCompRate
      const healthInsurance = settings.healthInsurancePerEmployee * 12
      const ptoValue = annualGross * settings.ptoAccrualRate
      
      const totalBurden = fica + futa + suta + workersComp + healthInsurance + ptoValue
      const burdenRate = totalBurden / annualGross
      const fullyLoadedCost = annualGross + totalBurden
      
      return {
        ...member,
        hourlyRate,
        annualGross,
        monthlyGross,
        fica,
        futa,
        suta,
        workersComp,
        healthInsurance,
        ptoValue,
        totalBurden,
        burdenRate,
        fullyLoadedCost,
        monthlyFullyLoaded: fullyLoadedCost / 12,
      }
    })
    
    const totalAnnualPayroll = teamCosts.reduce((sum, t) => sum + t.annualGross, 0)
    const totalAnnualBurden = teamCosts.reduce((sum, t) => sum + t.totalBurden, 0)
    const totalAnnualFullyLoaded = teamCosts.reduce((sum, t) => sum + t.fullyLoadedCost, 0)
    const totalMonthlyPayroll = totalAnnualPayroll / 12
    
    // Overhead
    const monthlyOverhead = settings.monthlyOverhead
    const annualOverhead = monthlyOverhead * 12 + totalAnnualFullyLoaded
    
    // Profit
    const annualProfit = annualRevenue - annualOverhead
    const monthlyProfit = annualProfit / 12
    const profitMargin = annualRevenue > 0 ? (annualProfit / annualRevenue) * 100 : 0
    
    // Revenue Per Employee
    const revenuePerEmployee = annualRevenue / numEmployees
    const rpeProgress = (revenuePerEmployee / settings.targetRPE) * 100
    
    // Month-by-month breakdown
    const monthlyBreakdown = MONTHS.map((month, idx) => {
      const monthRevenue = totalMonthlyRevenue
      const monthCosts = totalMonthlyPayroll + monthlyOverhead
      const monthProfit = monthRevenue - monthCosts
      
      return {
        month,
        revenue: monthRevenue,
        payroll: totalMonthlyPayroll,
        overhead: monthlyOverhead,
        totalCosts: monthCosts,
        profit: monthProfit,
        cumulative: (idx + 1) * monthProfit,
      }
    })
    
    // California employment taxes calculation
    const caEmployerTaxes = {
      grossPay: totalAnnualPayroll,
      fica: totalAnnualPayroll * settings.ficaRate,
      futa: Math.min(totalAnnualPayroll, 7000 * numEmployees) * settings.futaRate,
      suta: Math.min(totalAnnualPayroll, 7000 * numEmployees) * settings.sutaRate,
      etl: totalAnnualPayroll * 0.001, // Employment Training Tax
      sdi: totalAnnualPayroll * 0.011, // State Disability Insurance
    }
    caEmployerTaxes.total = caEmployerTaxes.fica + caEmployerTaxes.futa + caEmployerTaxes.suta + 
                           caEmployerTaxes.etl + caEmployerTaxes.sdi

    return {
      activeClients: activeClients.length,
      numEmployees,
      hourlyRate,
      monthlyRetainerRevenue,
      alaCarteRevenue,
      totalMonthlyRevenue,
      annualRevenue,
      totalAnnualPayroll,
      totalAnnualBurden,
      totalAnnualFullyLoaded,
      totalMonthlyPayroll,
      monthlyOverhead,
      annualOverhead,
      annualProfit,
      monthlyProfit,
      profitMargin,
      revenuePerEmployee,
      rpeProgress,
      monthlyBreakdown,
      teamCosts,
      caEmployerTaxes,
    }
  }, [clients, teamMembers, settings])

  const formatCurrency = (value, compact = false) => {
    if (compact) {
      if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`
      if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`
    }
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value)
  }

  // Chart max value for scaling
  const chartMax = Math.max(...financials.monthlyBreakdown.map(m => Math.max(m.revenue, m.totalCosts))) * 1.2

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border bg-white/80 dark:bg-card/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-foreground" />
                </div>
                {selectedYear} Financial Projections
              </h1>
              <p className="text-slate-500 dark:text-foreground/50 text-sm mt-1">Revenue forecasts & operating costs for financial and tax planning</p>
            </div>
            <div className="flex items-center gap-3">
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-24 bg-slate-100 dark:bg-white/5 border-slate-300 dark:border-white/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                size="sm" 
                className="border-slate-300 dark:border-white/20"
                onClick={() => setShowCosts(!showCosts)}
              >
                {showCosts ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {showCosts ? 'Hide' : 'Show'} Costs
              </Button>
              <Button onClick={fetchData} variant="outline" size="sm" className="border-slate-300 dark:border-white/20">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Quick Stats Bar */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-foreground/50 text-xs">Revenue Per Employee</span>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-foreground mt-1">{formatCurrency(financials.revenuePerEmployee, true)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-foreground/50 text-xs">Total Revenue</span>
                <DollarSign className="h-4 w-4 text-brand-orange" />
              </div>
              <p className="text-xl font-bold text-brand-orange mt-1">{formatCurrency(financials.annualRevenue, true)}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-foreground/50 text-xs">Month</span>
                <Calendar className="h-4 w-4 text-cyan-500" />
              </div>
              <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="mt-1 h-8 bg-transparent border-0 p-0 text-xl font-bold text-slate-900 dark:text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-foreground/50 text-xs">Payroll vs Revenue</span>
                <Wallet className="h-4 w-4 text-purple-500" />
              </div>
              <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">{formatCurrency(financials.totalMonthlyPayroll)}</p>
            </div>
          </div>
        </div>
      </div>

      <motion.div 
        className="max-w-7xl mx-auto px-6 py-8 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Revenue Per Employee Section */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 dark:text-foreground">Revenue Per Employee (RPE)</CardTitle>
                  <p className="text-slate-500 dark:text-foreground/40 text-sm">Track efficiency and scalability metrics</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30">
                  <p className="text-cyan-600/70 dark:text-cyan-400/60 text-xs mb-1">CURRENT RPE</p>
                  <p className="text-cyan-600 dark:text-cyan-400 text-3xl font-bold">{formatCurrency(financials.revenuePerEmployee, true)}</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30">
                  <p className="text-purple-600/70 dark:text-purple-400/60 text-xs mb-1">RPE TARGET</p>
                  <p className="text-purple-600 dark:text-purple-400 text-3xl font-bold">{formatCurrency(settings.targetRPE, true)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1">+/- ANNUAL</p>
                  <p className={cn("text-3xl font-bold", financials.revenuePerEmployee >= settings.targetRPE ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                    {financials.revenuePerEmployee >= settings.targetRPE ? '+' : ''}{formatCurrency(financials.revenuePerEmployee - settings.targetRPE, true)}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1"># EMPLOYEES</p>
                  <p className="text-slate-900 dark:text-foreground text-3xl font-bold">{financials.numEmployees}</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-500 dark:text-foreground/50">Progress to target</span>
                  <span className="text-slate-700 dark:text-foreground/70">{financials.rpeProgress.toFixed(1)}%</span>
                </div>
                <div className="h-3 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    className={cn("h-full rounded-full", financials.rpeProgress >= 100 ? "bg-green-500" : "bg-cyan-500")}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(financials.rpeProgress, 100)}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Annual Trend Cards */}
        <motion.div variants={itemVariants}>
          <Card className="bg-gradient-to-br from-brand-orange/10 to-brand-orange/5 dark:from-brand-orange/20 dark:to-transparent border-brand-orange/30 shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-orange/30 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-brand-orange" />
                </div>
                <CardTitle className="text-slate-900 dark:text-foreground">{selectedYear} Annual Trend</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-6">
                <div className="p-6 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-sm mb-2">Projected Annual Revenue</p>
                  <p className="text-4xl font-bold text-green-500 dark:text-green-400">{formatCurrency(financials.annualRevenue, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/40 text-xs mt-1">at ${settings.hourlyRate}/hr avg</p>
                </div>
                <div className="p-6 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-sm mb-2">Projected Profit</p>
                  <p className={cn("text-4xl font-bold", financials.annualProfit >= 0 ? "text-brand-orange" : "text-red-500 dark:text-red-400")}>
                    {formatCurrency(financials.annualProfit, true)}
                  </p>
                  <p className="text-slate-400 dark:text-foreground/40 text-xs mt-1">at {financials.profitMargin.toFixed(1)}% margin</p>
                </div>
                <div className="p-6 rounded-xl bg-white dark:bg-card border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-sm mb-2">Projected Overhead</p>
                  <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{formatCurrency(financials.annualOverhead, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/40 text-xs mt-1">payroll + operating costs</p>
                </div>
              </div>
              
              {/* Mini chart */}
              <div className="mt-6 h-20 flex items-end gap-1">
                {financials.monthlyBreakdown.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex gap-0.5 h-16">
                      <div 
                        className="flex-1 bg-green-500/70 dark:bg-green-500/60 rounded-t"
                        style={{ height: `${(m.revenue / chartMax) * 100}%` }}
                      />
                      <div 
                        className="flex-1 bg-purple-500/70 dark:bg-purple-500/60 rounded-t"
                        style={{ height: `${(m.totalCosts / chartMax) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-foreground/40">{m.month}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-6 mt-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500/70 dark:bg-green-500/60 rounded" />
                  <span className="text-slate-500 dark:text-foreground/50">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-purple-500/70 dark:bg-purple-500/60 rounded" />
                  <span className="text-slate-500 dark:text-foreground/50">Costs</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Monthly Overview */}
        <motion.div variants={itemVariants} className="grid grid-cols-3 gap-6">
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-red-500 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-foreground/50 text-sm">Monthly Overhead</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{formatCurrency(settings.monthlyOverhead)}</p>
                </div>
              </div>
              <p className="text-slate-400 dark:text-foreground/40 text-xs">Rent, utilities, software, insurance</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <Briefcase className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-foreground/50 text-sm">Base Monthly Invoices</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{formatCurrency(financials.monthlyRetainerRevenue)}</p>
                </div>
              </div>
              <p className="text-slate-400 dark:text-foreground/40 text-xs">From {financials.activeClients} active retainer clients</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Coins className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-slate-500 dark:text-foreground/50 text-sm">A La Carte Revenue</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-foreground">{formatCurrency(financials.alaCarteRevenue)}</p>
                </div>
              </div>
              <p className="text-slate-400 dark:text-foreground/40 text-xs">One-time projects outside retainers</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* California Employer Taxes */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                    <Calculator className="h-5 w-5 text-yellow-500 dark:text-yellow-400" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-foreground">California Employer Taxes</CardTitle>
                    <p className="text-slate-500 dark:text-foreground/40 text-sm">Estimated employer-side tax obligations</p>
                  </div>
                </div>
                <Badge className="bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30">CA</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 gap-4">
                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30">
                  <p className="text-yellow-600/70 dark:text-yellow-400/60 text-xs mb-1">GROSS PAY</p>
                  <p className="text-yellow-600 dark:text-yellow-400 text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.grossPay, true)}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1">FICA</p>
                  <p className="text-slate-900 dark:text-foreground text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.fica, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/30 text-[10px]">{(settings.ficaRate * 100).toFixed(2)}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1">FUTA</p>
                  <p className="text-slate-900 dark:text-foreground text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.futa, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/30 text-[10px]">{(settings.futaRate * 100).toFixed(2)}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1">CA SUTA</p>
                  <p className="text-slate-900 dark:text-foreground text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.suta, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/30 text-[10px]">{(settings.sutaRate * 100).toFixed(2)}%</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border">
                  <p className="text-slate-500 dark:text-foreground/50 text-xs mb-1">ETT + SDI</p>
                  <p className="text-slate-900 dark:text-foreground text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.etl + financials.caEmployerTaxes.sdi, true)}</p>
                  <p className="text-slate-400 dark:text-foreground/30 text-[10px]">1.2%</p>
                </div>
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5 border border-red-500/30">
                  <p className="text-red-500/70 dark:text-red-400/60 text-xs mb-1">TOTAL TAXES</p>
                  <p className="text-red-500 dark:text-red-400 text-xl font-bold">{formatCurrency(financials.caEmployerTaxes.total, true)}</p>
                </div>
              </div>
              <p className="text-slate-400 dark:text-foreground/40 text-xs mt-4 text-center">
                ⚠️ Estimates based on current payroll. Consult CPA for actual tax calculations. ETT = Employment Training Tax, SDI = State Disability Insurance
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Clients Table */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-orange/20 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-brand-orange" />
                  </div>
                  <CardTitle className="text-slate-900 dark:text-foreground">Clients</CardTitle>
                </div>
                <Button variant="outline" size="sm" className="border-slate-300 dark:border-white/20">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border bg-slate-50 dark:bg-white/5">
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Name</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Monthly Retainer</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Scope Hours</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Start Date</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Status</th>
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.slice(0, 15).map((client) => {
                      const monthlyRevenue = (client.monthly_hours || 0) * settings.hourlyRate
                      return (
                        <tr key={client.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {client.logo_url ? (
                                <img src={client.logo_url} alt={client.name} className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <div 
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-foreground font-bold text-xs"
                                  style={{ backgroundColor: client.color || '#F7931E' }}
                                >
                                  {client.name?.charAt(0)}
                                </div>
                              )}
                              <span className="text-slate-900 dark:text-foreground font-medium">{client.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-900 dark:text-foreground">{formatCurrency(monthlyRevenue)}</td>
                          <td className="py-3 px-4 text-slate-600 dark:text-foreground/70">{client.monthly_hours || 0}h/month</td>
                          <td className="py-3 px-4 text-slate-500 dark:text-foreground/50">
                            {client.created_at ? new Date(client.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={cn(
                              "text-xs",
                              client.is_active === false 
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                : "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30"
                            )}>
                              {client.is_active === false ? 'Paused' : 'Active'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm" className="text-slate-400 dark:text-foreground/50 hover:text-slate-900 dark:hover:text-foreground">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-foreground">Total Active Revenue</td>
                      <td className="py-3 px-4 font-bold text-green-600 dark:text-green-400" colSpan={5}>
                        {formatCurrency(financials.monthlyRetainerRevenue)}/month
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Revenue & Costs Projection Chart */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <BarChart3 className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
                  </div>
                  <div>
                    <CardTitle className="text-slate-900 dark:text-foreground">Revenue & Costs Projection (12 Months)</CardTitle>
                    <p className="text-slate-500 dark:text-foreground/40 text-sm">Estimated gross revenue versus total operating costs</p>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 relative">
                {/* Y-axis */}
                <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-slate-400 dark:text-foreground/40 text-xs text-right pr-2">
                  <span>{formatCurrency(chartMax, true)}</span>
                  <span>{formatCurrency(chartMax * 0.75, true)}</span>
                  <span>{formatCurrency(chartMax * 0.5, true)}</span>
                  <span>{formatCurrency(chartMax * 0.25, true)}</span>
                  <span>$0</span>
                </div>
                
                {/* Chart */}
                <div className="absolute left-16 right-0 top-0 bottom-8">
                  <svg className="w-full h-full" viewBox="0 0 400 200" preserveAspectRatio="none">
                    {/* Grid */}
                    {[0.25, 0.5, 0.75, 1].map((p, i) => (
                      <line key={i} x1="0" y1={200 - p * 200} x2="400" y2={200 - p * 200} className="stroke-slate-200 dark:stroke-white/10" strokeDasharray="4" />
                    ))}
                    
                    {/* Revenue line */}
                    <defs>
                      <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M 0 ${200 - (financials.monthlyBreakdown[0]?.revenue / chartMax) * 200} ${financials.monthlyBreakdown.map((m, i) => 
                        `L ${(i / 11) * 400} ${200 - (m.revenue / chartMax) * 200}`
                      ).join(' ')} L 400 200 L 0 200 Z`}
                      fill="url(#revenueGradient)"
                    />
                    <path
                      d={`M 0 ${200 - (financials.monthlyBreakdown[0]?.revenue / chartMax) * 200} ${financials.monthlyBreakdown.map((m, i) => 
                        `L ${(i / 11) * 400} ${200 - (m.revenue / chartMax) * 200}`
                      ).join(' ')}`}
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="3"
                    />
                    
                    {/* Costs line */}
                    <path
                      d={`M 0 ${200 - (financials.monthlyBreakdown[0]?.totalCosts / chartMax) * 200} ${financials.monthlyBreakdown.map((m, i) => 
                        `L ${(i / 11) * 400} ${200 - (m.totalCosts / chartMax) * 200}`
                      ).join(' ')}`}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="3"
                      strokeDasharray="8 4"
                    />
                  </svg>
                </div>
                
                {/* X-axis */}
                <div className="absolute left-16 right-0 bottom-0 flex justify-between text-slate-400 dark:text-foreground/40 text-xs">
                  {MONTHS.map(m => <span key={m}>{m}</span>)}
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-8 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-green-500 rounded" />
                  <span className="text-slate-500 dark:text-foreground/60">Revenue</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-1 bg-purple-500 rounded border-dashed" style={{ borderTop: '2px dashed #a855f7', height: 0 }} />
                  <span className="text-slate-500 dark:text-foreground/60">Costs</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Cumulative Profit/Loss */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-500 dark:text-green-400" />
                </div>
                <div>
                  <CardTitle className="text-slate-900 dark:text-foreground">Cumulative Profit/Loss (Running Balance)</CardTitle>
                  <p className="text-slate-500 dark:text-foreground/40 text-sm">Running total of monthly profits throughout the year</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-2">
                {financials.monthlyBreakdown.map((m, i) => {
                  const maxCumulative = Math.max(...financials.monthlyBreakdown.map(x => Math.abs(x.cumulative)))
                  const height = (Math.abs(m.cumulative) / maxCumulative) * 100
                  const isPositive = m.cumulative >= 0
                  
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center">
                      <motion.div
                        className={cn(
                          "w-full rounded-t",
                          isPositive ? "bg-gradient-to-t from-green-600 to-green-400" : "bg-gradient-to-t from-red-600 to-red-400"
                        )}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: i * 0.05, duration: 0.5 }}
                      />
                      <span className="text-[10px] text-slate-400 dark:text-foreground/40 mt-2">{m.month}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-foreground/50 mt-4 px-2">
                <span>Start: $0</span>
                <span className={cn("font-bold", financials.annualProfit >= 0 ? "text-green-500 dark:text-green-400" : "text-red-500 dark:text-red-400")}>
                  End: {formatCurrency(financials.annualProfit)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Month-by-Month Breakdown Table */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-foreground">Month-by-Month Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border bg-slate-50 dark:bg-white/5">
                      <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Month</th>
                      <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Revenue</th>
                      <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Staff</th>
                      <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Ops</th>
                      <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Cumulative</th>
                      <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Surplus</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financials.monthlyBreakdown.map((m, i) => (
                      <tr key={m.month} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-foreground font-medium">{m.month}</span>
                            {i === selectedMonth && <Badge className="bg-cyan-600 text-foreground text-[10px]">Now</Badge>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-mono">{formatCurrency(m.revenue)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-foreground/70 font-mono">{formatCurrency(m.payroll)}</td>
                        <td className="py-3 px-4 text-right text-slate-600 dark:text-foreground/70 font-mono">{formatCurrency(m.overhead)}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={m.cumulative >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
                            {formatCurrency(m.cumulative)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          <span className={m.profit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}>
                            {m.profit >= 0 ? '+' : ''}{formatCurrency(m.profit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Team Members Table */}
        {showCosts && (
          <motion.div variants={itemVariants}>
            <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-slate-900 dark:text-foreground">Team Members</CardTitle>
                      <p className="text-slate-500 dark:text-foreground/40 text-sm">Fully loaded costs including burden and benefits</p>
                    </div>
                  </div>
                  <Button className="bg-brand-orange hover:bg-brand-coral">
                    + Add Employee
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border bg-slate-50 dark:bg-white/5">
                        <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Name</th>
                        <th className="text-left py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Role</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Hourly Cost</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Burden Rate</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">PTO Days</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Annual Gross</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Status</th>
                        <th className="text-right py-3 px-4 text-slate-500 dark:text-foreground/50 font-medium text-sm">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {financials.teamCosts.map((member) => (
                        <tr key={member.id} className="border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar_url} />
                                <AvatarFallback className="bg-purple-500 text-foreground text-xs">
                                  {member.full_name?.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-slate-900 dark:text-foreground font-medium">{member.full_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-foreground/70">{member.title || member.role || '—'}</td>
                          <td className="py-3 px-4 text-right text-slate-900 dark:text-foreground font-mono">${member.hourlyRate}/hr</td>
                          <td className="py-3 px-4 text-right text-purple-600 dark:text-purple-400 font-mono">
                            {(member.burdenRate * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600 dark:text-foreground/70">10</td>
                          <td className="py-3 px-4 text-right text-green-600 dark:text-green-400 font-mono">
                            {formatCurrency(member.annualGross)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 text-xs">
                              Active
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button variant="ghost" size="sm" className="text-slate-400 dark:text-foreground/50 hover:text-slate-900 dark:hover:text-foreground">
                              <Settings className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 dark:bg-white/5 border-t border-slate-200 dark:border">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-foreground" colSpan={5}>Total Annual Staff Costs</td>
                        <td className="py-3 px-4 text-right font-bold text-purple-600 dark:text-purple-400" colSpan={3}>
                          {formatCurrency(financials.totalAnnualFullyLoaded)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Cost Distribution Pie Chart */}
        <motion.div variants={itemVariants}>
          <Card className="bg-white dark:bg-card border-slate-200 dark:border shadow-sm">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <PieChart className="h-5 w-5 text-pink-500 dark:text-pink-400" />
                </div>
                <CardTitle className="text-slate-900 dark:text-foreground">Current Cost Distribution</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center">
                <div className="relative w-48 h-48">
                  <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                    {/* Staff costs */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#22c55e"
                      strokeWidth="20"
                      strokeDasharray={`${(financials.totalAnnualPayroll / financials.annualOverhead) * 251.2} 251.2`}
                    />
                    {/* Overhead */}
                    <circle
                      cx="50"
                      cy="50"
                      r="40"
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth="20"
                      strokeDasharray={`${((settings.monthlyOverhead * 12) / financials.annualOverhead) * 251.2} 251.2`}
                      strokeDashoffset={`-${(financials.totalAnnualPayroll / financials.annualOverhead) * 251.2}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-slate-500 dark:text-foreground/50 text-xs">Total</span>
                    <span className="text-slate-900 dark:text-foreground text-lg font-bold">{formatCurrency(financials.annualOverhead, true)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-8 mt-6">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  <div>
                    <p className="text-slate-900 dark:text-foreground text-sm">Staff: {((financials.totalAnnualPayroll / financials.annualOverhead) * 100).toFixed(0)}%</p>
                    <p className="text-slate-500 dark:text-foreground/50 text-xs">{formatCurrency(financials.totalAnnualPayroll, true)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded" />
                  <div>
                    <p className="text-slate-900 dark:text-foreground text-sm">Overhead: {(((settings.monthlyOverhead * 12) / financials.annualOverhead) * 100).toFixed(0)}%</p>
                    <p className="text-slate-500 dark:text-foreground/50 text-xs">{formatCurrency(settings.monthlyOverhead * 12, true)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  )
}
