import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Bot, Users, Target, TrendingUp, Zap, MessageSquare, Mail,
  Search, BarChart3, Sparkles, ArrowRight, CheckCircle, Clock,
  DollarSign, Rocket, Brain, Eye, Heart, Shield, Globe, Megaphone,
  PenTool, Code, Palette, Calendar, FileText, Phone, Linkedin
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Progress } from '../components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// AI Squad Member definitions with missions, goals, and KPIs
const AI_SQUAD_MEMBERS = [
  {
    id: 'william',
    name: 'William Harris',
    role: 'Chief Strategy AI',
    avatar: null, // Will be loaded from DB
    specialization: 'Business Development & Outreach',
    icon: Target,
    color: 'from-blue-500 to-cyan-500',
    mission: 'Generate $50K+ in new business pipeline through intelligent outreach and lead qualification.',
    goals: [
      'Send 500+ personalized outreach messages/month',
      'Book 20+ qualified discovery calls',
      'Achieve 15% reply rate on cold outreach',
    ],
    kpis: [
      { label: 'Leads Generated', value: 847, target: 1000, unit: '' },
      { label: 'Reply Rate', value: 12.4, target: 15, unit: '%' },
      { label: 'Meetings Booked', value: 23, target: 30, unit: '' },
    ],
    tools: ['Apollo', 'HeyReach', 'LinkedIn Sales Nav'],
    status: 'active',
  },
  {
    id: 'amelia',
    name: 'Amelia Clark',
    role: 'Creative Director AI',
    avatar: null,
    specialization: 'Content & Design Strategy',
    icon: Palette,
    color: 'from-pink-500 to-rose-500',
    mission: 'Create compelling content that drives engagement and establishes thought leadership.',
    goals: [
      'Produce 30+ pieces of content/month',
      'Increase social engagement by 25%',
      'Maintain brand consistency score of 95%+',
    ],
    kpis: [
      { label: 'Content Pieces', value: 34, target: 30, unit: '' },
      { label: 'Engagement Rate', value: 4.2, target: 5, unit: '%' },
      { label: 'Brand Score', value: 97, target: 95, unit: '%' },
    ],
    tools: ['Figma', 'Canva', 'Midjourney'],
    status: 'active',
  },
  {
    id: 'benjamin',
    name: 'Benjamin Lewis',
    role: 'Analytics AI',
    avatar: null,
    specialization: 'Data Analysis & Reporting',
    icon: BarChart3,
    color: 'from-green-500 to-emerald-500',
    mission: 'Transform data into actionable insights that drive 20% improvement in client ROI.',
    goals: [
      'Deliver weekly performance reports',
      'Identify 5+ optimization opportunities/client',
      'Reduce reporting time by 50%',
    ],
    kpis: [
      { label: 'Reports Generated', value: 156, target: 150, unit: '' },
      { label: 'Insights Delivered', value: 89, target: 100, unit: '' },
      { label: 'Time Saved', value: 45, target: 50, unit: 'hrs' },
    ],
    tools: ['Google Analytics', 'Looker', 'BigQuery'],
    status: 'active',
  },
  {
    id: 'evelyn',
    name: 'Evelyn Hall',
    role: 'Customer Success AI',
    avatar: null,
    specialization: 'Client Relations & Support',
    icon: Heart,
    color: 'from-purple-500 to-violet-500',
    mission: 'Maintain 95%+ client retention through proactive engagement and exceptional support.',
    goals: [
      'Respond to all inquiries within 2 hours',
      'Conduct monthly check-ins with all clients',
      'Achieve 9.5+ NPS score',
    ],
    kpis: [
      { label: 'Response Time', value: 1.2, target: 2, unit: 'hrs' },
      { label: 'Client Retention', value: 96, target: 95, unit: '%' },
      { label: 'NPS Score', value: 9.2, target: 9.5, unit: '' },
    ],
    tools: ['Intercom', 'Slack', 'Notion'],
    status: 'active',
  },
  {
    id: 'oliver',
    name: 'Oliver Wright',
    role: 'SEO Specialist AI',
    avatar: null,
    specialization: 'Search Optimization',
    icon: Search,
    color: 'from-orange-500 to-amber-500',
    mission: 'Improve organic visibility and drive 40% increase in qualified organic traffic.',
    goals: [
      'Audit and optimize 100+ pages/month',
      'Build 50+ quality backlinks',
      'Achieve top 10 rankings for priority keywords',
    ],
    kpis: [
      { label: 'Pages Optimized', value: 87, target: 100, unit: '' },
      { label: 'Backlinks Built', value: 42, target: 50, unit: '' },
      { label: 'Keywords Ranked', value: 156, target: 200, unit: '' },
    ],
    tools: ['Ahrefs', 'SEMrush', 'Screaming Frog'],
    status: 'active',
  },
  {
    id: 'sophia',
    name: 'Sophia Chen',
    role: 'Paid Media AI',
    avatar: null,
    specialization: 'Advertising & Media Buying',
    icon: Megaphone,
    color: 'from-red-500 to-pink-500',
    mission: 'Maximize ROAS across all paid channels while maintaining cost efficiency.',
    goals: [
      'Manage $500K+ in monthly ad spend',
      'Achieve 4x+ ROAS across accounts',
      'Reduce CPA by 20%',
    ],
    kpis: [
      { label: 'Ad Spend Managed', value: 487, target: 500, unit: 'K' },
      { label: 'Average ROAS', value: 4.2, target: 4, unit: 'x' },
      { label: 'CPA Reduction', value: 18, target: 20, unit: '%' },
    ],
    tools: ['Google Ads', 'Meta Ads', 'TikTok Ads'],
    status: 'active',
  },
  {
    id: 'james',
    name: 'James Porter',
    role: 'Development AI',
    avatar: null,
    specialization: 'Web Development & Automation',
    icon: Code,
    color: 'from-slate-500 to-zinc-600',
    mission: 'Build and maintain high-performance digital experiences that convert.',
    goals: [
      'Complete 20+ development tickets/month',
      'Maintain 99.9% uptime across sites',
      'Achieve 90+ PageSpeed scores',
    ],
    kpis: [
      { label: 'Tickets Completed', value: 24, target: 20, unit: '' },
      { label: 'Site Uptime', value: 99.97, target: 99.9, unit: '%' },
      { label: 'Avg PageSpeed', value: 92, target: 90, unit: '' },
    ],
    tools: ['React', 'Next.js', 'Vercel'],
    status: 'active',
  },
  {
    id: 'emma',
    name: 'Emma Davis',
    role: 'Social Media AI',
    avatar: null,
    specialization: 'Social Strategy & Community',
    icon: Globe,
    color: 'from-sky-500 to-blue-500',
    mission: 'Build engaged communities and drive brand awareness across social platforms.',
    goals: [
      'Post 60+ pieces of content/month',
      'Grow follower base by 10%/month',
      'Drive 25% of traffic from social',
    ],
    kpis: [
      { label: 'Posts Published', value: 67, target: 60, unit: '' },
      { label: 'Follower Growth', value: 8.5, target: 10, unit: '%' },
      { label: 'Social Traffic', value: 22, target: 25, unit: '%' },
    ],
    tools: ['Buffer', 'Sprout Social', 'Later'],
    status: 'active',
  },
  {
    id: 'isabella',
    name: 'Isabella Martinez',
    role: 'QA & Research AI',
    avatar: null,
    specialization: 'Quality Assurance & Market Research',
    icon: Eye,
    color: 'from-teal-500 to-cyan-500',
    mission: 'Ensure quality standards and provide competitive intelligence for strategic decisions.',
    goals: [
      'Review 100% of deliverables before launch',
      'Conduct monthly competitive analysis',
      'Identify 10+ market opportunities/quarter',
    ],
    kpis: [
      { label: 'QA Reviews', value: 234, target: 200, unit: '' },
      { label: 'Bug Detection', value: 98, target: 95, unit: '%' },
      { label: 'Research Reports', value: 12, target: 12, unit: '' },
    ],
    tools: ['Notion', 'Airtable', 'SimilarWeb'],
    status: 'active',
  },
]

// How It Works steps
const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Strategy & Planning',
    description: 'AI agents analyze your goals and create data-driven strategies',
    icon: Brain,
  },
  {
    step: 2,
    title: 'Execution & Optimization',
    description: 'Agents work 24/7 executing campaigns and optimizing in real-time',
    icon: Zap,
  },
  {
    step: 3,
    title: 'Analysis & Reporting',
    description: 'Continuous monitoring with actionable insights delivered daily',
    icon: BarChart3,
  },
  {
    step: 4,
    title: 'Scale & Grow',
    description: 'AI learns and improves, scaling what works for maximum ROI',
    icon: Rocket,
  },
]

export default function AISquad() {
  const { profile, isAdmin } = useAuth()
  const [squadMembers, setSquadMembers] = useState(AI_SQUAD_MEMBERS)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  
  // Revenue goal tracking
  const [revenueGoal] = useState(500000) // $500K annual goal
  const [currentRevenue] = useState(287500) // Current progress
  const revenueProgress = (currentRevenue / revenueGoal) * 100

  useEffect(() => {
    async function loadSquadAvatars() {
      try {
        // Fetch AI squad members from profiles
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, title, is_ai')
          .eq('is_ai', true)
        
        if (data) {
          // Update squad members with real avatars from DB
          setSquadMembers(prev => prev.map(member => {
            const dbMember = data.find(d => 
              d.full_name?.toLowerCase().includes(member.name.split(' ')[0].toLowerCase())
            )
            return dbMember ? { ...member, avatar: dbMember.avatar_url } : member
          }))
        }
      } catch (err) {
        console.log('Could not load squad avatars:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadSquadAvatars()
  }, [])

  const calculateOverallProgress = (kpis) => {
    if (!kpis?.length) return 0
    const total = kpis.reduce((sum, kpi) => {
      const progress = Math.min(100, (kpi.value / kpi.target) * 100)
      return sum + progress
    }, 0)
    return Math.round(total / kpis.length)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-r from-brand-orange/5 via-purple-500/5 to-blue-500/5">
        <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_70%)]" />
        <div className="relative max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-brand-orange to-orange-600 shadow-lg shadow-brand-orange/25">
                <Bot className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-bold bg-gradient-to-r from-brand-orange via-purple-500 to-blue-500 bg-clip-text text-transparent">
                AI Squad
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Meet your 24/7 marketing team. 9 specialized AI agents working around the clock 
              to grow your business, optimize campaigns, and deliver results.
            </p>
            
            {/* Stats */}
            <div className="flex flex-wrap justify-center gap-8 mb-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-brand-orange">9</p>
                <p className="text-sm text-muted-foreground">AI Agents</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-purple-500">24/7</p>
                <p className="text-sm text-muted-foreground">Always On</p>
              </div>
              <div className="text-center">
                <p className="text-4xl font-bold text-blue-500">∞</p>
                <p className="text-sm text-muted-foreground">Scalability</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Revenue Progress Bar */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-gradient-to-r from-green-500/5 to-emerald-500/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <DollarSign className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Revenue Goal Progress</h3>
                    <p className="text-sm text-muted-foreground">Annual target: ${revenueGoal.toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-green-500">${currentRevenue.toLocaleString()}</p>
                  <p className="text-sm text-muted-foreground">{revenueProgress.toFixed(1)}% achieved</p>
                </div>
              </div>
              <Progress value={revenueProgress} className="h-3 bg-green-500/10" />
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Q1: $125K</span>
                <span>Q2: $250K</span>
                <span>Q3: $375K</span>
                <span>Q4: $500K</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-2xl font-display font-bold mb-6 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * i }}
                className="relative"
              >
                <Card className="h-full bg-gradient-to-br from-card to-muted/30 hover:shadow-lg transition-all">
                  <CardContent className="p-6 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-orange/10 mb-4">
                      <step.icon className="h-6 w-6 text-brand-orange" />
                    </div>
                    <Badge className="mb-2">Step {step.step}</Badge>
                    <h3 className="font-semibold mb-2">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Squad Members */}
      <section className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-display font-bold">Meet The Squad</h2>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All Agents</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
                <TabsTrigger value="tech">Tech</TabsTrigger>
                <TabsTrigger value="support">Support</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {squadMembers.map((member) => {
              const overallProgress = calculateOverallProgress(member.kpis)
              const Icon = member.icon
              
              return (
                <motion.div key={member.id} variants={itemVariants}>
                  <Card className="h-full hover:shadow-xl transition-all duration-300 overflow-hidden group">
                    {/* Header with gradient */}
                    <div className={cn(
                      "h-2 bg-gradient-to-r",
                      member.color
                    )} />
                    
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-16 w-16 border-2 border-background shadow-lg">
                          <AvatarImage src={member.avatar} referrerPolicy="no-referrer" />
                          <AvatarFallback className={cn(
                            "bg-gradient-to-br text-white text-lg font-bold",
                            member.color
                          )}>
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg">{member.name}</CardTitle>
                            <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                              <Bot className="h-3 w-3 mr-1" />
                              AI
                            </Badge>
                          </div>
                          <CardDescription className="flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {member.role}
                          </CardDescription>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Mission */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Mission</p>
                        <p className="text-sm">{member.mission}</p>
                      </div>

                      {/* Goals */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Goals</p>
                        <ul className="space-y-1">
                          {member.goals.map((goal, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                              <span>{goal}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* KPIs */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">KPIs</p>
                        <div className="space-y-2">
                          {member.kpis.map((kpi, i) => {
                            const progress = Math.min(100, (kpi.value / kpi.target) * 100)
                            const isOnTrack = progress >= 80
                            return (
                              <div key={i}>
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{kpi.label}</span>
                                  <span className={isOnTrack ? 'text-green-500' : 'text-yellow-500'}>
                                    {kpi.value}{kpi.unit} / {kpi.target}{kpi.unit}
                                  </span>
                                </div>
                                <Progress 
                                  value={progress} 
                                  className={cn(
                                    "h-1.5",
                                    isOnTrack ? "bg-green-500/10" : "bg-yellow-500/10"
                                  )}
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Tools */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tools</p>
                        <div className="flex flex-wrap gap-1">
                          {member.tools.map((tool, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tool}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* Overall Progress */}
                      <div className="pt-2 border-t">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Overall Progress</span>
                          <Badge className={cn(
                            overallProgress >= 90 ? "bg-green-500" :
                            overallProgress >= 70 ? "bg-blue-500" :
                            overallProgress >= 50 ? "bg-yellow-500" : "bg-red-500"
                          )}>
                            {overallProgress}%
                          </Badge>
                        </div>
                        <Progress value={overallProgress} className="mt-2 h-2" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </motion.div>
        </motion.div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-r from-brand-orange/10 via-purple-500/10 to-blue-500/10 border-0 overflow-hidden">
            <CardContent className="p-8 md:p-12 text-center relative">
              <div className="absolute inset-0 bg-grid-white/5 [mask-image:radial-gradient(white,transparent_70%)]" />
              <div className="relative">
                <Sparkles className="h-12 w-12 mx-auto text-brand-orange mb-4" />
                <h2 className="text-3xl font-display font-bold mb-4">
                  Ready to Scale with AI?
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
                  Our AI Squad is ready to take your marketing to the next level. 
                  Get started today and see results in weeks, not months.
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <Button size="lg" className="bg-brand-orange hover:bg-brand-orange/90">
                    <Rocket className="h-5 w-5 mr-2" />
                    Get Started
                  </Button>
                  <Button size="lg" variant="outline">
                    <Calendar className="h-5 w-5 mr-2" />
                    Book a Demo
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </section>
    </div>
  )
}
