import { useCallback, useMemo, useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'

const STATUS = {
  idle: { label: 'Idle', color: 'secondary' },
  running: { label: 'Running', color: 'default' },
  pass: { label: 'Pass', color: 'success' },
  warn: { label: 'Warn', color: 'warning' },
  fail: { label: 'Fail', color: 'destructive' },
}

function StatusIcon({ status }) {
  if (status === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-4 w-4 text-yellow-500" />
  if (status === 'fail') return <XCircle className="h-4 w-4 text-red-500" />
  return <RefreshCw className="h-4 w-4 text-muted-foreground" />
}

export default function Diagnostics() {
  const { user, profile } = useAuth()
  const [checks, setChecks] = useState([])
  const [running, setRunning] = useState(false)
  const [lastRunAt, setLastRunAt] = useState(null)

  const setCheckResult = useCallback((id, result) => {
    setChecks((prev) =>
      prev.map((check) => (check.id === id ? { ...check, ...result } : check))
    )
  }, [])

  const baseChecks = useMemo(
    () => [
      {
        id: 'auth-session',
        name: 'Auth session',
        description: 'User is signed in and profile is available.',
        run: async () => {
          if (!user) {
            return { status: 'fail', message: 'No active user session.' }
          }
          if (!profile) {
            return { status: 'warn', message: 'User session exists, profile not loaded.' }
          }
          return { status: 'pass', message: `Signed in as ${profile.full_name || user.email}.` }
        },
      },
      {
        id: 'clients-table',
        name: 'Clients table access',
        description: 'Read access to clients table.',
        run: async () => {
          const { error, count } = await supabase
            .from('clients')
            .select('id', { count: 'exact', head: true })
          if (error) return { status: 'fail', message: error.message }
          return { status: 'pass', message: `Accessible. Total clients: ${count ?? 0}.` }
        },
      },
      {
        id: 'boards-table',
        name: 'Boards table access',
        description: 'Read access to boards table.',
        run: async () => {
          const { error, count } = await supabase
            .from('boards')
            .select('id', { count: 'exact', head: true })
          if (error) return { status: 'fail', message: error.message }
          return { status: 'pass', message: `Accessible. Total boards: ${count ?? 0}.` }
        },
      },
      {
        id: 'tickets-table',
        name: 'Tickets table access',
        description: 'Read access to tickets table.',
        run: async () => {
          const { error, count } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true })
          if (error) return { status: 'fail', message: error.message }
          return { status: 'pass', message: `Accessible. Total tickets: ${count ?? 0}.` }
        },
      },
      {
        id: 'time-entries-table',
        name: 'Time entries access',
        description: 'Read access to time_entries table.',
        run: async () => {
          const { error, count } = await supabase
            .from('time_entries')
            .select('id', { count: 'exact', head: true })
          if (error) return { status: 'fail', message: error.message }
          return { status: 'pass', message: `Accessible. Total entries: ${count ?? 0}.` }
        },
      },
      {
        id: 'ticket-id-populated',
        name: 'Ticket IDs populated',
        description: 'Newest ticket has a ticket_id value.',
        run: async () => {
          const { data, error } = await supabase
            .from('tickets')
            .select('id, ticket_id')
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) return { status: 'fail', message: error.message }
          if (!data?.length) return { status: 'warn', message: 'No tickets found yet.' }
          if (!data[0].ticket_id) {
            return { status: 'warn', message: 'Latest ticket is missing ticket_id.' }
          }
          return { status: 'pass', message: `Latest ticket: ${data[0].ticket_id}.` }
        },
      },
      {
        id: 'time-entry-joins',
        name: 'Time entry joins',
        description: 'Time entries can join client + user profiles.',
        run: async () => {
          const { data, error } = await supabase
            .from('time_entries')
            .select('id, client:clients(name), user:profiles(full_name)')
            .order('created_at', { ascending: false })
            .limit(1)
          if (error) return { status: 'fail', message: error.message }
          if (!data?.length) return { status: 'warn', message: 'No time entries to validate.' }
          const entry = data[0]
          if (!entry.client || !entry.user) {
            return { status: 'warn', message: 'Time entry missing client or user join.' }
          }
          return { status: 'pass', message: 'Joins look good.' }
        },
      },
      {
        id: 'orphan-tickets',
        name: 'Orphan tickets check',
        description: 'Tickets missing board_id or client_id.',
        run: async () => {
          const [boardRes, clientRes] = await Promise.all([
            supabase.from('tickets').select('id', { count: 'exact', head: true }).is('board_id', null),
            supabase.from('tickets').select('id', { count: 'exact', head: true }).is('client_id', null),
          ])
          if (boardRes.error) return { status: 'fail', message: boardRes.error.message }
          if (clientRes.error) return { status: 'fail', message: clientRes.error.message }
          const orphanBoards = boardRes.count ?? 0
          const orphanClients = clientRes.count ?? 0
          if (orphanBoards || orphanClients) {
            return {
              status: 'warn',
              message: `Missing board_id: ${orphanBoards}, missing client_id: ${orphanClients}.`,
            }
          }
          return { status: 'pass', message: 'No orphan tickets found.' }
        },
      },
    ],
    [profile, user]
  )

  const runDiagnostics = useCallback(async () => {
    setRunning(true)
    setLastRunAt(null)
    setChecks(baseChecks.map((check) => ({ ...check, status: 'running', message: '' })))

    for (const check of baseChecks) {
      try {
        const result = await check.run()
        setCheckResult(check.id, result)
      } catch (error) {
        setCheckResult(check.id, {
          status: 'fail',
          message: error?.message || 'Unexpected error',
        })
      }
    }

    setLastRunAt(new Date())
    setRunning(false)
  }, [baseChecks, setCheckResult])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Diagnostics & Workflow Checks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Read-only checks that validate core tables, joins, and workflow data.
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={running}>
          {running ? 'Running...' : 'Run Diagnostics'}
        </Button>
      </div>

      {lastRunAt && (
        <p className="text-xs text-muted-foreground">
          Last run: {lastRunAt.toLocaleString()}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Checks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Click “Run Diagnostics” to validate the system.
            </p>
          )}
          {checks.map((check) => (
            <div key={check.id} className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <StatusIcon status={check.status} />
                <div>
                  <p className="text-sm font-medium">{check.name}</p>
                  <p className="text-xs text-muted-foreground">{check.description}</p>
                  {check.message && (
                    <p className="text-xs text-muted-foreground mt-1">{check.message}</p>
                  )}
                </div>
              </div>
              <Badge variant={STATUS[check.status || 'idle']?.color || 'secondary'}>
                {STATUS[check.status || 'idle']?.label || 'Idle'}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manual Workflow Tests</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Use this checklist to verify end‑to‑end behavior:</p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Create a task from a client → confirm it appears in the client’s Tasks tab.</li>
            <li>Open the board for that client → confirm task appears in To Do.</li>
            <li>Move task to In Progress and Done → confirm status updates everywhere.</li>
            <li>Open task detail → update assignee/priority → confirm updates persist.</li>
            <li>Start Timer from client → select the task → start/stop → confirm time entry saved.</li>
            <li>Verify time entry in Time Tracking page and in client Time Entries tab.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
