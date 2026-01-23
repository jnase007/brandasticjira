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
                  Go to <strong>Clients</strong>, click a client card, and you’ll land on the client profile.
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
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
              From a task detail page you can update priority, due date, assignee, and add comments.
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
              Logged time appears in <strong>Time Tracking</strong> and in the client’s
              <strong> Time Entries</strong> tab.
            </p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" variants={SECTION}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5 text-brand-orange" />
              Tracking Time (Exact Steps)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <ol className="list-decimal pl-5 space-y-2">
              <li>Click <strong>Start Timer</strong> (sidebar or client page).</li>
              <li>Select a client.</li>
              <li>Select an existing task or create a new one.</li>
              <li>Press <strong>Start Timer</strong>.</li>
              <li>Press <strong>Stop</strong> to save the time entry.</li>
            </ol>
            <p>
              Manual entries can be added from the <strong>Time Tracking</strong> page using
              <strong> Add Time</strong>.
            </p>
          </CardContent>
        </Card>
      </motion.div>

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
      </motion.div>
    </div>
  )
}
