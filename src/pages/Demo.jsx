import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  Users,
  Clock,
  Kanban,
  TrendingUp,
  ArrowLeft,
  Plus,
  Search,
  MessageSquare,
  Paperclip,
  Calendar,
  Play,
  Square,
  X,
  Zap,
  ChevronRight,
  Activity,
  Sparkles,
  Target,
  Command,
} from 'lucide-react'
import { cn, formatDuration, calculateProgress, getProgressColor, getStatusInfo, getPriorityInfo, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import AnimatedCounter, { PercentageCounter } from '../components/AnimatedCounter'
import { DonutChart, AreaChart, Sparkline } from '../components/Charts'
import Confetti, { useConfetti } from '../components/Confetti'

// Demo data
const DEMO_CLIENTS = [
  { id: '1', name: 'TechStart Inc', color: '#F7931E', monthly_hours: 40, hours_used: 28.5 },
  { id: '2', name: 'Bloom Agency', color: '#00AEEF', monthly_hours: 60, hours_used: 45 },
  { id: '3', name: 'Acme Corp', color: '#8B5CF6', monthly_hours: 30, hours_used: 12 },
  { id: '4', name: 'StartupXYZ', color: '#EC4899', monthly_hours: 20, hours_used: 18.5 },
]

const DEMO_TICKETS = {
  todo: [
    { id: '1', ticket_id: 'TECH-101', title: 'Design new landing page hero section', priority: 'high', assignee: 'Sarah M.', tags: ['design', 'urgent'] },
    { id: '2', ticket_id: 'TECH-102', title: 'Set up Google Analytics 4', priority: 'medium', assignee: 'John D.', tags: ['analytics'] },
    { id: '3', ticket_id: 'BLOOM-45', title: 'Create social media content calendar', priority: 'low', assignee: null, tags: ['social'] },
  ],
  inprogress: [
    { id: '4', ticket_id: 'TECH-98', title: 'Implement email automation workflow', priority: 'high', assignee: 'Sarah M.', tags: ['email', 'automation'] },
    { id: '5', ticket_id: 'ACME-23', title: 'SEO audit and recommendations', priority: 'urgent', assignee: 'Mike R.', tags: ['seo'] },
  ],
  done: [
    { id: '6', ticket_id: 'TECH-95', title: 'Facebook Ads campaign setup', priority: 'medium', assignee: 'John D.', tags: ['ads'] },
    { id: '7', ticket_id: 'BLOOM-42', title: 'Brand guidelines document', priority: 'low', assignee: 'Sarah M.', tags: ['branding'] },
    { id: '8', ticket_id: 'ACME-21', title: 'Monthly performance report', priority: 'medium', assignee: 'Mike R.', tags: ['reporting'] },
  ],
}

const HOURS_TREND = [
  { label: 'Mon', value: 28 },
  { label: 'Tue', value: 35 },
  { label: 'Wed', value: 42 },
  { label: 'Thu', value: 38 },
  { label: 'Fri', value: 45 },
  { label: 'Sat', value: 12 },
  { label: 'Sun', value: 8 },
]

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'status-todo' },
  { id: 'inprogress', label: 'In Progress', color: 'status-inprogress' },
  { id: 'done', label: 'Done', color: 'status-done' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300
    }
  },
}

function generateSparklineData() {
  return Array.from({ length: 7 }, () => Math.floor(Math.random() * 100) + 20)
}

function DemoTicketCard({ ticket, index }) {
  const priorityInfo = getPriorityInfo(ticket.priority)
  
  return (
    <Draggable draggableId={ticket.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
        >
          <motion.div
            layout
            whileHover={{ y: -4, scale: 1.02 }}
            className={cn(
              "group relative rounded-xl border bg-card p-4 shadow-sm transition-all duration-300 cursor-pointer",
              "hover:shadow-xl hover:shadow-brand-orange/10 hover:border-brand-orange/30",
              snapshot.isDragging && "shadow-2xl ring-2 ring-brand-orange/40 rotate-2 scale-105"
            )}
          >
            {/* Priority strip */}
            <div className={cn(
              "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
              ticket.priority === 'urgent' && "bg-priority-urgent",
              ticket.priority === 'high' && "bg-priority-high",
              ticket.priority === 'medium' && "bg-priority-medium",
              ticket.priority === 'low' && "bg-priority-low",
            )} />

            <div className="pl-2">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">{ticket.ticket_id}</span>
                <Badge variant={ticket.priority} className="text-[10px] px-1.5 py-0">
                  {priorityInfo.label}
                </Badge>
              </div>

              <h4 className="font-medium text-sm leading-snug mb-3 line-clamp-2 group-hover:text-brand-orange transition-colors">
                {ticket.title}
              </h4>

              {ticket.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {ticket.tags.map((tag, i) => (
                    <span key={i} className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground text-[11px]">
                  <MessageSquare className="h-3 w-3" />
                  <span>{Math.floor(Math.random() * 5)}</span>
                  <Paperclip className="h-3 w-3 ml-2" />
                  <span>{Math.floor(Math.random() * 3)}</span>
                </div>
                {ticket.assignee && (
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-[10px] bg-brand-orange/10 text-brand-orange">
                      {getInitials(ticket.assignee)}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  )
}

export default function Demo() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [tickets, setTickets] = useState(DEMO_TICKETS)
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerTime, setTimerTime] = useState('00:12:34')
  const { trigger: confettiTrigger, fire: fireConfetti } = useConfetti()

  const totalClients = DEMO_CLIENTS.length
  const totalHoursUsed = DEMO_CLIENTS.reduce((sum, c) => sum + c.hours_used, 0)
  const totalHoursAvailable = DEMO_CLIENTS.reduce((sum, c) => sum + c.monthly_hours, 0)
  const utilization = Math.round((totalHoursUsed / totalHoursAvailable) * 100)

  const handleDragEnd = (result) => {
    if (!result.destination) return

    const { source, destination } = result
    
    if (source.droppableId === destination.droppableId && source.index === destination.index) {
      return
    }

    const sourceColumn = [...tickets[source.droppableId]]
    const destColumn = source.droppableId === destination.droppableId 
      ? sourceColumn 
      : [...tickets[destination.droppableId]]

    const [removed] = sourceColumn.splice(source.index, 1)
    destColumn.splice(destination.index, 0, removed)

    setTickets({
      ...tickets,
      [source.droppableId]: sourceColumn,
      [destination.droppableId]: destColumn,
    })

    // Fire confetti when moving to done
    if (destination.droppableId === 'done' && source.droppableId !== 'done') {
      fireConfetti()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Confetti trigger={confettiTrigger} />
      
      {/* Demo Banner */}
      <motion.div 
        initial={{ y: -50 }}
        animate={{ y: 0 }}
        className="bg-gradient-to-r from-brand-orange via-brand-coral to-brand-blue text-white py-2.5 px-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-2 py-1 bg-white/20 rounded-full">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">DEMO</span>
            </div>
            <span className="text-sm font-medium">You're viewing a demo with sample data</span>
          </div>
          <Link to="/login">
            <Button size="sm" className="h-8 bg-white text-brand-orange hover:bg-white/90 font-medium">
              Sign Up for Real
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* Demo Navbar */}
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/login" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-orange flex items-center justify-center">
                  <span className="text-white font-bold text-lg">B</span>
                </div>
                <span className="font-bold text-lg hidden sm:block">Brandastic</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    activeTab === 'dashboard' 
                      ? "text-white bg-brand-orange shadow-lg shadow-brand-orange/30" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('board')}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                    activeTab === 'board' 
                      ? "text-white bg-brand-orange shadow-lg shadow-brand-orange/30" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  Kanban Board
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Command palette hint */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-muted/50">
                <Command className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">K to search</span>
              </div>
              
              <Avatar className="h-9 w-9 ring-2 ring-brand-orange/20">
                <AvatarFallback className="bg-brand-orange/10 text-brand-orange font-medium">DU</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-6 lg:p-8 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -20 }}
              variants={containerVariants}
            >
              {/* Header */}
              <motion.div variants={itemVariants} className="mb-10">
                <h1 className="text-4xl font-bold mb-2 flex items-center gap-3">
                  Welcome to the Demo!
                  <motion.span
                    animate={{ rotate: [0, 14, -8, 14, -4, 10, 0] }}
                    transition={{ duration: 2.5, delay: 0.5 }}
                    className="inline-block"
                  >
                    🚀
                  </motion.span>
                </h1>
                <p className="text-lg text-muted-foreground">
                  Explore the dashboard with sample client data. Try dragging tickets!
                </p>
              </motion.div>

              {/* Stats */}
              <motion.div
                variants={containerVariants}
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
              >
                <motion.div variants={itemVariants}>
                  <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                          <p className="text-4xl font-bold mt-2 group-hover:text-brand-orange transition-colors">
                            <AnimatedCounter value={totalClients} />
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                            <TrendingUp className="h-3 w-3" />
                            <span>+2 this month</span>
                          </div>
                        </div>
                        <div className="relative">
                          <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                            <Users className="h-7 w-7 text-brand-orange" />
                          </div>
                          <Sparkline data={generateSparklineData()} className="absolute -bottom-2 -right-2 opacity-50" />
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
                            <AnimatedCounter value={8} />
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Kanban className="h-3 w-3" />
                            <span>6 kanban</span>
                          </div>
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
                          <p className="text-sm font-medium text-muted-foreground">Hours Used</p>
                          <p className="text-4xl font-bold mt-2 group-hover:text-brand-purple transition-colors">
                            <AnimatedCounter value={Math.round(totalHoursUsed)} />
                            <span className="text-lg text-muted-foreground font-normal ml-1">
                              /{totalHoursAvailable}
                            </span>
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{Math.round(totalHoursAvailable - totalHoursUsed)}h remaining</span>
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                          <Clock className="h-7 w-7 text-brand-purple" />
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
                          <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                          <p className="text-4xl font-bold mt-2 group-hover:text-green-500 transition-colors">
                            <PercentageCounter value={utilization} />
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                            <Target className="h-3 w-3" />
                            <span>On track</span>
                          </div>
                        </div>
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                          <TrendingUp className="h-7 w-7 text-green-500" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Main Grid */}
              <div className="grid gap-6 lg:grid-cols-3">
                <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
                  {/* Client Hours */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">Client Hours</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Monthly hour allocation</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {DEMO_CLIENTS.map((client, index) => {
                          const progress = calculateProgress(client.hours_used, client.monthly_hours)
                          const isNearLimit = progress >= 90
                          
                          return (
                            <motion.div
                              key={client.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-5 rounded-2xl border bg-card hover:shadow-md hover:border-brand-orange/30 transition-all cursor-pointer group"
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                  <div
                                    className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg group-hover:scale-110 transition-transform"
                                    style={{ backgroundColor: client.color }}
                                  >
                                    {client.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h3 className="font-semibold text-lg group-hover:text-brand-orange transition-colors">
                                      {client.name}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                      {Math.round(client.monthly_hours - client.hours_used)}h remaining
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="text-right">
                                    <p className="font-bold text-lg">
                                      {client.hours_used}
                                      <span className="text-muted-foreground font-normal text-sm">
                                        /{client.monthly_hours}h
                                      </span>
                                    </p>
                                  </div>
                                  <Badge
                                    variant={isNearLimit ? 'high' : 'secondary'}
                                    className={cn(
                                      "px-3 py-1 font-medium",
                                      !isNearLimit && "bg-green-500/10 text-green-600"
                                    )}
                                  >
                                    {Math.round(progress)}%
                                  </Badge>
                                </div>
                              </div>
                              
                              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${progress}%` }}
                                  transition={{ duration: 1, delay: index * 0.1 }}
                                  className={cn(
                                    "absolute inset-y-0 left-0 rounded-full",
                                    isNearLimit 
                                      ? "bg-gradient-to-r from-amber-500 to-orange-500"
                                      : "bg-gradient-to-r from-brand-orange to-brand-coral"
                                  )}
                                />
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Hours Chart */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-xl">Hours Trend</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">Hours logged this week</p>
                        </div>
                        <Badge variant="outline" className="font-normal">
                          <Calendar className="h-3 w-3 mr-1" />
                          This Week
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <AreaChart data={HOURS_TREND} height={180} />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Right Column */}
                <motion.div variants={itemVariants} className="space-y-6">
                  {/* Donut Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">Overall Utilization</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                      <DonutChart 
                        value={totalHoursUsed} 
                        total={totalHoursAvailable} 
                        size={160}
                        strokeWidth={16}
                        label="of hours used"
                      />
                      <div className="mt-6 w-full grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-xl bg-muted/50">
                          <p className="text-2xl font-bold text-brand-orange">
                            <AnimatedCounter value={Math.round(totalHoursUsed)} />h
                          </p>
                          <p className="text-xs text-muted-foreground">Used</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-muted/50">
                          <p className="text-2xl font-bold text-brand-blue">
                            <AnimatedCounter value={Math.round(totalHoursAvailable - totalHoursUsed)} />h
                          </p>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Timer Demo */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Clock className="h-5 w-5 text-brand-orange" />
                        Time Tracker
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn(
                        "text-center py-6 rounded-xl font-mono text-4xl font-bold mb-4 relative overflow-hidden",
                        timerRunning ? "bg-brand-orange/10 text-brand-orange" : "bg-muted text-muted-foreground"
                      )}>
                        {timerRunning && (
                          <motion.div
                            className="absolute inset-0 bg-brand-orange/5"
                            animate={{ opacity: [0.3, 0.6, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        )}
                        <span className="relative z-10">{timerTime}</span>
                      </div>
                      <Button
                        onClick={() => setTimerRunning(!timerRunning)}
                        className={cn(
                          "w-full h-12 text-base font-medium",
                          timerRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                        )}
                      >
                        {timerRunning ? (
                          <><Square className="mr-2 h-5 w-5 fill-current" /> Stop Timer</>
                        ) : (
                          <><Play className="mr-2 h-5 w-5 fill-current" /> Start Timer</>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        Currently tracking: <span className="font-mono text-brand-orange">TECH-98</span>
                      </p>
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Zap className="h-5 w-5 text-brand-orange" />
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <Button 
                        variant="outline" 
                        className="w-full justify-between h-12 rounded-xl group"
                        onClick={() => setActiveTab('board')}
                      >
                        <span className="flex items-center">
                          <Kanban className="mr-3 h-5 w-5 text-brand-blue" />
                          View Kanban Board
                        </span>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between h-12 rounded-xl group"
                        onClick={fireConfetti}
                      >
                        <span className="flex items-center">
                          <Sparkles className="mr-3 h-5 w-5 text-brand-purple" />
                          Celebrate! 🎉
                        </span>
                        <ChevronRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Board Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setActiveTab('dashboard')}
                    className="rounded-xl"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-orange flex items-center justify-center">
                      <span className="text-white font-bold">T</span>
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold">TechStart Inc - Q1 Campaign</h1>
                      <p className="text-sm text-muted-foreground">Marketing campaign board • Drag tickets to move them</p>
                    </div>
                  </div>
                </div>
                <Button className="rounded-xl">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Ticket
                </Button>
              </div>

              {/* Kanban Board */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-6">
                  {COLUMNS.map((column) => (
                    <div key={column.id} className="flex flex-col min-h-[500px] w-80 rounded-2xl p-4 bg-muted/30 border flex-shrink-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={column.id} className="text-xs font-medium">{column.label}</Badge>
                          <span className="text-sm text-muted-foreground font-medium">{tickets[column.id].length}</span>
                        </div>
                        <Button variant="ghost" size="icon-sm" className="rounded-lg">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 space-y-3 min-h-[200px] rounded-xl p-2 transition-all duration-200",
                              snapshot.isDraggingOver && "bg-brand-orange/5 ring-2 ring-brand-orange/20 ring-dashed"
                            )}
                          >
                            {tickets[column.id].map((ticket, index) => (
                              <DemoTicketCard key={ticket.id} ticket={ticket} index={index} />
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  ))}
                </div>
              </DragDropContext>
              
              <div className="mt-6 p-4 rounded-xl bg-muted/50 border border-dashed">
                <p className="text-center text-sm text-muted-foreground">
                  💡 <strong>Tip:</strong> Drag a ticket to the "Done" column to see a celebration! 🎉
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
