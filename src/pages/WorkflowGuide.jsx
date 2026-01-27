import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  ClipboardList,
  Clock,
  Kanban,
  Users,
  FileText,
  Play,
  ArrowRight,
  Timer,
  MessageSquare,
  Award,
  ThumbsUp,
  Share2,
  Edit,
  Trash2,
  BarChart3,
  AtSign,
  Bell,
  Calendar,
  DollarSign,
  Settings,
  UserPlus,
  Sparkles,
  FolderKanban,
  Hourglass,
  ClipboardCheck,
  Target,
  Eye,
  UserCheck,
  Receipt,
  Circle,
  PlayCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

const SECTION = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export default function WorkflowGuide() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={SECTION}
        className="space-y-3"
      >
        <Badge variant="secondary">Workflow Guide</Badge>
        <h1 className="text-3xl font-display font-bold">How Brandastic PM Works</h1>
        <p className="text-muted-foreground text-base">
          This page shows the exact flow for managing clients, boards, tasks, and time tracking.
          Follow it step-by-step and your work, time, and progress will always stay in sync.
        </p>
      </motion.div>

      {/* Quick Start */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-brand-orange" />
              Quick Start (Recommended Order)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">1. Open a Client</p>
                <p className="text-muted-foreground">
                  Go to <strong>Clients</strong>, click a client card, and you'll land on the client profile.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">2. Create or Review Tasks</p>
                <p className="text-muted-foreground">
                  The <strong>Tasks</strong> tab is first by default. Use <strong>New Task</strong> to add work.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">3. Manage Work on Boards</p>
                <p className="text-muted-foreground">
                  Go to <strong>Boards</strong> to drag tasks through the 7-stage workflow: New → In Progress → Internal Review → Client Review → Approved → Ready for Billing → Closed.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">4. Track Time</p>
                <p className="text-muted-foreground">
                  Click <strong>Start Timer</strong>, select a client and task, then start/stop to log time.
                  The timer follows you across all pages!
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Core Features Grid */}
      <motion.div initial="hidden" animate="visible" variants={SECTION} className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-brand-orange" />
              Clients → Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The <strong>Clients</strong> page is your hub. Click a client to view their profile.
              The <strong>Tasks</strong> tab shows all work for that client.
            </p>
            <p>
              <strong>⭐ Star your favorites!</strong> Click the star icon on any client card to pin them to the top.
              Your starred clients persist across sessions.
            </p>
            <p>
              When you create a task without selecting a board, it is automatically placed on a
              <strong> General Tasks</strong> board for that client.
            </p>
            <p>
              Use <strong>New Board</strong> or <strong>From Template</strong> to build structured project boards.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Kanban className="h-5 w-5 text-brand-orange" />
              Boards → Status Flow
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Boards now feature a <strong>7-column workflow</strong>: New → In Progress → Internal Review → 
              Client Review → Approved → Ready for Billing → Closed.
            </p>
            <p>
              Drag tasks between columns to update their status. This is the primary way to track progress.
            </p>
            <p>
              Each task can be opened for details, comments, attachments, and time tracking.
            </p>
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-700 dark:text-blue-300 font-medium">💡 Tip: Client Page Task View</p>
              <p className="text-blue-600 dark:text-blue-400 mt-1">
                On the client page, tasks are <strong>grouped by status</strong>. 
                Hover over any task to see a quick <strong>"Board" link</strong> that takes you directly to the Kanban board.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-brand-orange" />
              Tasks → Ownership
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Tasks can be assigned to team members. This keeps ownership clear and makes it easy to
              see who is responsible.
            </p>
            <p>
              From a task detail page you can update priority, due date, assignee, estimated hours, and add comments.
            </p>
            <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <p className="text-orange-700 dark:text-orange-300 font-medium">📋 My Tasks on Dashboard</p>
              <p className="text-orange-600 dark:text-orange-400 mt-1">
                Your Dashboard shows a <strong>"My Tasks"</strong> section with all tasks assigned to you that 
                are In Progress or To Do. Click any task to jump to its board.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-brand-orange" />
              Time Tracking → Reporting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The timer logs time entries for the selected client. If you pick a task, the entry is linked
              to that task; otherwise it still logs to the client.
            </p>
            <p>
              Logged time appears in <strong>Time Tracking</strong> and in the client's
              <strong> Time Entries</strong> tab.
            </p>
            <p>
              <strong>Edit or delete</strong> time entries by hovering over them and clicking the action menu.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* NEW: 10x Workflow Enhancements */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card className="border-2 border-brand-orange/30 bg-gradient-to-br from-brand-orange/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-orange" />
              <span className="bg-gradient-to-r from-brand-orange to-brand-coral bg-clip-text text-transparent">
                NEW: 10x Workflow Enhancements
              </span>
              <Badge className="ml-2 bg-brand-orange text-white">Just Added!</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 text-sm">
            
            {/* 7-Status Workflow */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Kanban className="h-5 w-5 text-brand-purple" />
                <h4 className="font-semibold">7-Status Workflow</h4>
              </div>
              <p className="text-muted-foreground mb-3">
                Tasks now flow through a comprehensive 7-stage pipeline for better tracking:
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">
                  <Circle className="h-3 w-3 mr-1 text-slate-500" /> New
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30">
                  <PlayCircle className="h-3 w-3 mr-1 text-amber-500" /> In Progress
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900/30">
                  <Eye className="h-3 w-3 mr-1 text-purple-500" /> Internal Review
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30">
                  <UserCheck className="h-3 w-3 mr-1 text-blue-500" /> Client Review
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-emerald-100 dark:bg-emerald-900/30">
                  <ThumbsUp className="h-3 w-3 mr-1 text-emerald-500" /> Approved
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900/30">
                  <Receipt className="h-3 w-3 mr-1 text-orange-500" /> Ready for Billing
                </Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30">
                  <CheckCircle2 className="h-3 w-3 mr-1 text-green-500" /> Closed
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Drag tasks between columns on the board, or use the status pipeline on the task detail page.
              </p>
            </div>

            {/* Categories/Folders */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <FolderKanban className="h-5 w-5 text-indigo-500" />
                <h4 className="font-semibold">Categories / Folders</h4>
              </div>
              <p className="text-muted-foreground">
                Organize tasks into categories (folders) for better grouping. Filter the board by category 
                to focus on specific types of work. Categories are per-client, so each client can have 
                their own organization structure.
              </p>
            </div>

            {/* Estimated Hours */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Hourglass className="h-5 w-5 text-teal-500" />
                <h4 className="font-semibold">Estimated Hours + Progress Tracking</h4>
              </div>
              <p className="text-muted-foreground mb-2">
                Set estimated hours on any task. The ticket card shows a visual progress bar comparing 
                logged time vs. estimated time:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li><span className="text-green-500 font-medium">Green</span> = On track (under 80% of budget)</li>
                <li><span className="text-amber-500 font-medium">Yellow</span> = Approaching budget (80-100%)</li>
                <li><span className="text-red-500 font-medium">Red</span> = Over budget (exceeded estimate)</li>
              </ul>
            </div>

            {/* Client Homework */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardCheck className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">Client Homework</h4>
              </div>
              <p className="text-muted-foreground mb-2">
                Mark tasks as <strong>"Client Homework"</strong> when the client needs to complete them. 
                These tasks have a simplified workflow:
              </p>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800">New</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/30">In Progress</Badge>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30">Closed</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Clients can only move their homework tasks to "Closed" - they can't change internal statuses.
              </p>
            </div>

            {/* Resolution Field */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">Automatic Resolution Tracking</h4>
              </div>
              <p className="text-muted-foreground">
                Tasks now have a <strong>Resolution</strong> field that automatically updates:
              </p>
              <ul className="list-disc pl-5 text-muted-foreground mt-2 space-y-1">
                <li>When status changes to <strong>"Closed"</strong> → Resolution = <Badge variant="outline" className="text-green-600 bg-green-50">Resolved</Badge></li>
                <li>When reopened → Resolution = <Badge variant="outline" className="text-slate-600 bg-slate-50">Unresolved</Badge></li>
              </ul>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Time Tracking Details */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5 text-brand-orange" />
              Tracking Time (Exact Steps)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Click <strong>Start Timer</strong> (sidebar or client page).</li>
              <li>Select a client.</li>
              <li>Select an existing task or create a new one.</li>
              <li>Press <strong>Start Timer</strong>.</li>
              <li>The timer follows you across all pages - work anywhere!</li>
              <li>Press <strong>Stop</strong> to save the time entry.</li>
            </ol>
            <div className="bg-muted/50 p-3 rounded-lg mt-4">
              <p className="font-medium text-foreground">💡 Tips:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>If you start a second timer, you'll be asked which one to keep.</li>
                <li>Manual entries can be added from the <strong>Time Tracking</strong> page using <strong>Add Time</strong>.</li>
                <li>Even time under a minute is tracked (minimum 1 minute logged).</li>
                <li>Your dashboard shows a notification when a timer is running.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* New Features Grid */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <h2 className="text-xl font-bold mb-4">Additional Features</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-5 w-5 text-brand-purple" />
                Messages
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Leave internal notes on client pages. Team members can reply and discuss - like a thread.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Share2 className="h-5 w-5 text-brand-blue" />
                Client Shareable Links
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Generate a public link so clients can view their portal without logging in. Find it on the client profile.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-5 w-5 text-green-500" />
                Team Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Assign team members to specific roles on each client (Account Manager, SEO, Design, etc.).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-5 w-5 text-yellow-500" />
                Client Wins
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Share wins and successes! Post conversion rates, traffic growth, or ROI achievements in the Client Wins section.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ThumbsUp className="h-5 w-5 text-pink-500" />
                Team Shoutouts
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Give appreciation to teammates! Go to <strong>Team Hub → Shoutouts</strong> to recognize great work.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-brand-coral" />
                Reports
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Export time and project data as <strong>CSV</strong>, <strong>Excel</strong>, or branded <strong>PDF</strong> reports.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AtSign className="h-5 w-5 text-blue-500" />
                @Mentions
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Type <strong>@</strong> in any comment or message to mention a team member. They'll receive a notification instantly!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bell className="h-5 w-5 text-orange-500" />
                Notifications
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Click the bell icon to see mentions, assignments, and kudos. Real-time updates keep you in the loop!
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="h-5 w-5 text-teal-500" />
                Renewal Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Track client contract renewals in <strong>Team Hub → Client Roster</strong>. Click any renewal date cell to add or edit.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings className="h-5 w-5 text-gray-500" />
                Custom Roles
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                Add or remove role columns in the Client Roster. Click <strong>Roles</strong> button to customize (e.g., add "Content Writer").
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-5 w-5 text-green-500" />
                Profitability Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>
                See fully loaded costs per employee in <strong>Team Hub → Profitability</strong>. Set labor costs and overhead to calculate margins.
              </p>
            </CardContent>
          </Card>

        </div>
      </motion.div>

      {/* @Mentions Guide */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AtSign className="h-5 w-5 text-blue-500" />
              Using @Mentions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Tag team members in comments and messages to notify them directly.</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>In any comment or message box, type <strong>@</strong></li>
              <li>A dropdown appears with team members</li>
              <li>Start typing a name to filter the list</li>
              <li>Click a name or press <strong>Enter/Tab</strong> to insert</li>
              <li>Send your message - they'll get a notification!</li>
            </ol>
            <div className="bg-muted/50 p-3 rounded-lg mt-4">
              <p className="font-medium text-foreground">💡 Where you can use @mentions:</p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>Task/ticket comments</li>
                <li>Client page Messages tab</li>
                <li>Message replies</li>
                <li>Client Portal comments (for clients)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Team Hub Details */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-brand-purple" />
              Team Hub (Complete Guide)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>The Team Hub is your central place for managing team assignments, ad spend, and profitability.</p>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground mb-2">📋 Client Roster Tab</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Assign team members</strong> to roles (Marketing Manager, Account Specialist, etc.)</li>
                <li><strong>Renewal dates</strong> - Click to add/edit contract renewal dates</li>
                <li><strong>Custom roles</strong> - Click "Roles" button to add/remove columns</li>
                <li>Assignments sync automatically to the client's Team tab</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground mb-2">📊 Ad Spend Tab</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Track monthly ad budgets by platform (Facebook, Google, TikTok, etc.)</li>
                <li>Compare budget vs. actuals with color-coded variance</li>
                <li><strong>Monthly & yearly totals</strong> - See totals at the bottom of the table</li>
                <li><strong>Apply to entire year</strong> - Add a budget for all 12 months with one click</li>
                <li>Filter by year with the arrow buttons</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground mb-2">💰 Profitability Tab</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Set <strong>labor costs</strong> for each team member</li>
                <li>Configure <strong>monthly overhead</strong> and target billable hours</li>
                <li>See fully loaded costs (labor + overhead per hour)</li>
                <li>Compare against $175/hr billing rate</li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="font-medium text-foreground mb-2">🎉 Shoutouts Tab</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Send appreciation to teammates</li>
                <li>Categories: Appreciation, Teamwork, Above & Beyond, Creativity</li>
                <li>Recent shoutouts display in a feed</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Keyboard Shortcuts & Power Features */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              <span className="bg-gradient-to-r from-purple-500 to-brand-blue bg-clip-text text-transparent">
                Power User Features
              </span>
              <Badge className="ml-2 bg-purple-500 text-white">Pro Tips!</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            
            {/* Command Palette */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Settings className="h-5 w-5 text-orange-500" />
                <h4 className="font-semibold">Command Palette</h4>
                <Badge variant="outline" className="ml-auto font-mono">⌘K</Badge>
              </div>
              <p className="text-muted-foreground">
                Press <strong>⌘K</strong> (or Ctrl+K on Windows) anywhere to open the Command Palette. 
                Quickly navigate to any page, start timers, create tasks, or toggle dark mode - all without using your mouse!
              </p>
            </div>

            {/* Keyboard Shortcuts */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Edit className="h-5 w-5 text-blue-500" />
                <h4 className="font-semibold">Keyboard Shortcuts</h4>
                <Badge variant="outline" className="ml-auto font-mono">?</Badge>
              </div>
              <p className="text-muted-foreground mb-3">
                Press <strong>?</strong> anytime to see all available keyboard shortcuts. Here are some favorites:
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>Dashboard</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">G D</kbd>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>Time Tracking</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">G T</kbd>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>Reports</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">G R</kbd>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>Start Timer</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">T S</kbd>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>New Task</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">C T</kbd>
                </div>
                <div className="flex justify-between p-2 bg-background rounded">
                  <span>Dark Mode</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted border font-mono">T D</kbd>
                </div>
              </div>
            </div>

            {/* Quick Actions Button */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <Play className="h-5 w-5 text-brand-coral" />
                <h4 className="font-semibold">Quick Actions Button</h4>
              </div>
              <p className="text-muted-foreground">
                Look for the <strong>orange + button</strong> in the bottom-right corner of your screen. 
                Click it to quickly access: Start Timer, New Task, Command Palette, and Keyboard Shortcuts. 
                It's always there when you need it!
              </p>
            </div>

            {/* Payroll Report */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="h-5 w-5 text-green-500" />
                <h4 className="font-semibold">Payroll Report</h4>
              </div>
              <p className="text-muted-foreground">
                Go to <strong>Reports → Payroll</strong> to pull contractor hours for any date range. 
                Select specific team members, set your pay period (like bi-weekly), and export to 
                <strong> Excel, PDF, or CSV</strong> for payroll processing.
              </p>
            </div>

          </CardContent>
        </Card>
      </motion.div>

      {/* Edit/Delete Time Entries */}
      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-brand-orange" />
              Editing & Deleting Time Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Made a mistake or need to adjust a time entry? No problem!</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>Go to <strong>Time Tracking → Time Entries</strong> tab.</li>
              <li>Hover over any row to see the <strong>⋯</strong> action menu.</li>
              <li>Click <strong>Edit Entry</strong> to change description, hours/minutes, or billable status.</li>
              <li>Click <strong>Delete Entry</strong> to remove it entirely.</li>
            </ol>
            <p className="text-xs mt-2">
              <em>Note: You can only edit/delete your own entries (admins can edit all).</em>
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation Buttons */}
      <motion.div initial="hidden" animate="visible" variants={SECTION} className="flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/clients">
            Go to Clients <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/boards">Go to Boards</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/time">Go to Time Tracking</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link to="/team">Go to Team Hub</Link>
        </Button>
      </motion.div>
    </div>
  )
}
