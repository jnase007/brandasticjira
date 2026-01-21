import { useState } from 'react'
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
} from 'lucide-react'
import { cn, formatDuration, calculateProgress, getProgressColor, getStatusInfo, getPriorityInfo, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Progress } from '../components/ui/progress'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

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

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: 'status-todo' },
  { id: 'inprogress', label: 'In Progress', color: 'status-inprogress' },
  { id: 'done', label: 'Done', color: 'status-done' },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
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

  const totalClients = DEMO_CLIENTS.length
  const totalHoursUsed = DEMO_CLIENTS.reduce((sum, c) => sum + c.hours_used, 0)
  const totalHoursAvailable = DEMO_CLIENTS.reduce((sum, c) => sum + c.monthly_hours, 0)

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
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-brand-orange to-brand-blue text-white py-2 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">🎉 You're viewing a demo with sample data</span>
          </div>
          <Link to="/login">
            <Button size="sm" variant="secondary" className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0">
              Sign Up for Real
            </Button>
          </Link>
        </div>
      </div>

      {/* Demo Navbar */}
      <nav className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/login" className="flex items-center gap-3">
                <img 
                  src="https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Brandastic_black_logo%20(6).png" 
                  alt="Brandastic" 
                  className="h-7 w-auto object-contain"
                />
              </Link>

              <div className="hidden md:flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeTab === 'dashboard' ? "text-brand-orange bg-brand-orange/10" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('board')}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    activeTab === 'board' ? "text-brand-orange bg-brand-orange/10" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Kanban Board
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-brand-orange/10 text-brand-orange">DU</AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="p-6 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Welcome back, Demo User!</h1>
                <p className="text-muted-foreground">Here's what's happening across your clients this month.</p>
              </div>

              {/* Stats */}
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
              >
                <motion.div variants={itemVariants}>
                  <Card className="card-hover group cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Active Clients</p>
                          <p className="text-3xl font-bold mt-1 group-hover:text-brand-orange transition-colors">{totalClients}</p>
                        </div>
                        <div className="p-3 rounded-xl bg-brand-orange/10 group-hover:bg-brand-orange/20 group-hover:scale-110 transition-all">
                          <Users className="h-6 w-6 text-brand-orange" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="card-hover group cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                          <p className="text-3xl font-bold mt-1 group-hover:text-brand-blue transition-colors">8</p>
                        </div>
                        <div className="p-3 rounded-xl bg-brand-blue/10 group-hover:bg-brand-blue/20 group-hover:scale-110 transition-all">
                          <Kanban className="h-6 w-6 text-brand-blue" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="card-hover group cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Hours Used</p>
                          <p className="text-3xl font-bold mt-1 group-hover:text-brand-purple transition-colors">
                            {Math.round(totalHoursUsed)}
                            <span className="text-lg text-muted-foreground font-normal">/{totalHoursAvailable}</span>
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-brand-purple/10 group-hover:bg-brand-purple/20 group-hover:scale-110 transition-all">
                          <Clock className="h-6 w-6 text-brand-purple" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                <motion.div variants={itemVariants}>
                  <Card className="card-hover group cursor-pointer">
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Utilization</p>
                          <p className="text-3xl font-bold mt-1 group-hover:text-brand-teal transition-colors">
                            {Math.round((totalHoursUsed / totalHoursAvailable) * 100)}%
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-brand-teal/10 group-hover:bg-brand-teal/20 group-hover:scale-110 transition-all">
                          <TrendingUp className="h-6 w-6 text-brand-teal" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>

              {/* Client Hours */}
              <div className="grid gap-6 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Client Hours This Month</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {DEMO_CLIENTS.map((client, index) => {
                          const progress = calculateProgress(client.hours_used, client.monthly_hours)
                          return (
                            <motion.div
                              key={client.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-4 rounded-xl border bg-card hover:shadow-md hover:border-brand-orange/20 transition-all cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: client.color }} />
                                  <span className="font-medium">{client.name}</span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  <span className="font-medium text-foreground">{client.hours_used}</span> / {client.monthly_hours}h
                                </div>
                              </div>
                              <Progress value={progress} className="h-2" />
                              <div className="flex items-center justify-between mt-2">
                                <span className="text-xs text-muted-foreground">
                                  {Math.round(client.monthly_hours - client.hours_used)}h remaining
                                </span>
                                <Badge variant={progress >= 90 ? 'destructive' : 'outline'} className="text-xs">
                                  {progress}% used
                                </Badge>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Time Tracker Demo */}
                <div>
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Time Tracker
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={cn(
                        "text-center py-6 rounded-xl font-mono text-3xl font-semibold mb-4",
                        timerRunning ? "bg-brand-orange/10 text-brand-orange" : "bg-muted text-muted-foreground"
                      )}>
                        {timerTime}
                      </div>
                      <Button
                        onClick={() => setTimerRunning(!timerRunning)}
                        className={cn(
                          "w-full h-12",
                          timerRunning ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                        )}
                      >
                        {timerRunning ? (
                          <><Square className="mr-2 h-5 w-5" /> Stop Timer</>
                        ) : (
                          <><Play className="mr-2 h-5 w-5" /> Start Timer</>
                        )}
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        Currently tracking: TECH-98
                      </p>
                    </CardContent>
                  </Card>
                </div>
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
                  <div className="w-3 h-3 rounded-full bg-brand-orange" />
                  <div>
                    <h1 className="text-2xl font-bold">TechStart Inc - Q1 Campaign</h1>
                    <p className="text-sm text-muted-foreground">Marketing campaign board</p>
                  </div>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Ticket
                </Button>
              </div>

              {/* Kanban Board */}
              <DragDropContext onDragEnd={handleDragEnd}>
                <div className="flex gap-6 overflow-x-auto pb-6">
                  {COLUMNS.map((column) => (
                    <div key={column.id} className="flex flex-col min-h-[500px] w-80 rounded-xl p-4 bg-muted/30 border flex-shrink-0">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Badge variant={column.id}>{column.label}</Badge>
                          <span className="text-sm text-muted-foreground">{tickets[column.id].length}</span>
                        </div>
                        <Button variant="ghost" size="icon-sm">
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      <Droppable droppableId={column.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "flex-1 space-y-3 min-h-[200px] rounded-lg p-1 transition-colors",
                              snapshot.isDraggingOver && "bg-brand-orange/5 ring-2 ring-brand-orange/20"
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
