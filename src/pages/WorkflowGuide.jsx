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
                  Go to <strong>Boards</strong> to drag tasks between <em>To Do</em>, <em>In Progress</em>, and <em>Done</em>.
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
              Boards are Kanban-style with three columns: <strong>To Do</strong>, <strong>In Progress</strong>,
              and <strong>Done</strong>.
            </p>
            <p>
              Drag tasks between columns to update their status. This is the primary way to track progress.
            </p>
            <p>
              Each task can be opened for details, comments, attachments, and time tracking.
            </p>
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

        </div>
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
