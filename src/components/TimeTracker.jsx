import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Clock, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { 
  startTimeEntry, 
  stopTimeEntry, 
  getRunningTimeEntry,
  getTimeEntries,
  createManualTimeEntry,
  deleteTimeEntry,
  logActivity,
} from '../lib/supabase'
import { formatTimerDisplay, formatDuration, formatDate, cn } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { useToast } from '../hooks/useToast'

export default function TimeTracker({ ticketId, clientId, onTimeLogged }) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [runningEntry, setRunningEntry] = useState(null)
  const [timeEntries, setTimeEntries] = useState([])
  const [elapsedTime, setElapsedTime] = useState('00:00:00')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(true)
  const [localStartTime, setLocalStartTime] = useState(null)
  const [manualDialogOpen, setManualDialogOpen] = useState(false)
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    hours: '',
    minutes: '',
    notes: '',
  })

  // Fetch running entry and time entries
  const fetchData = useCallback(async () => {
    if (!user || !ticketId) return
    
    setLoading(true)
    try {
      const [runningRes, entriesRes] = await Promise.all([
        getRunningTimeEntry(user.id),
        getTimeEntries(ticketId),
      ])

      if (runningRes.data && runningRes.data.ticket_id === ticketId) {
        setRunningEntry(runningRes.data)
        setNotes(runningRes.data.notes || '')
      } else {
        setRunningEntry(null)
      }

      setTimeEntries(entriesRes.data || [])
    } catch (error) {
      console.error('Error fetching time data:', error)
    } finally {
      setLoading(false)
    }
  }, [user, ticketId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Update elapsed time every second when timer is running
  useEffect(() => {
    if (!runningEntry) {
      setElapsedTime('00:00:00')
      return
    }

    const updateTimer = () => {
      setElapsedTime(formatTimerDisplay(runningEntry.start_time))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [runningEntry])

  const handleStart = async () => {
    if (!user || !ticketId || !clientId) return

    try {
      const { data, error } = await startTimeEntry(ticketId, clientId, user.id, notes)
      
      if (error) throw error

      setRunningEntry(data)
      setLocalStartTime(null)
      toast({
        title: 'Timer started',
        description: 'Time tracking has begun for this task.',
        duration: 2500,
      })
    } catch (error) {
      const message = error?.message || ''
      if (message.includes('column')) {
        const start = new Date().toISOString()
        setRunningEntry({ id: 'local', start_time: start, notes })
        setLocalStartTime(start)
        toast({
          title: 'Timer started',
          description: 'Tracking locally. Time will save on stop.',
          duration: 2500,
        })
        return
      }
      toast({
        title: 'Error',
        description: 'Failed to start timer. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleStop = async () => {
    if (!runningEntry) return

    try {
      let data = null
      let error = null

      if (runningEntry.id === 'local') {
        const startTime = localStartTime ? new Date(localStartTime) : new Date()
        const endTime = new Date()
        const durationMinutes = Math.max(1, Math.ceil((endTime - startTime) / 60000))

        const res = await createManualTimeEntry({
          ticket_id: ticketId,
          client_id: clientId,
          user_id: user.id,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          notes,
          minutes: durationMinutes,
          date: endTime.toISOString().split('T')[0],
          billable: true,
          description: notes || 'Time entry',
        })
        data = res.data
        error = res.error
      } else {
        const res = await stopTimeEntry(runningEntry.id)
        data = res.data
        error = res.error
      }

      if (error) throw error

      setRunningEntry(null)
      setNotes('')
      setLocalStartTime(null)
      
      // Refresh entries
      await fetchData()
      onTimeLogged?.()

      logActivity({
        activity_type: 'time_logged',
        user_id: user?.id,
        client_id: clientId,
        entity_type: 'ticket',
        entity_id: ticketId,
        entity_name: ticketId,
        metadata: { minutes: data.duration_minutes || data.minutes || 0, ticket_id: ticketId },
      })

      toast({
        title: 'Timer stopped',
        description: `Logged ${formatDuration(data.duration_minutes)}.`,
        variant: 'success',
        duration: 3000,
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to stop timer. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleManualSubmit = async () => {
    if (!user || !ticketId || !clientId) return

    const totalMinutes = (parseInt(manualEntry.hours) || 0) * 60 + (parseInt(manualEntry.minutes) || 0)
    
    if (totalMinutes <= 0) {
      toast({
        title: 'Invalid duration',
        description: 'Please enter a valid time duration.',
        variant: 'destructive',
      })
      return
    }

    try {
      const startTime = new Date(manualEntry.date)
      startTime.setHours(9, 0, 0, 0)
      const endTime = new Date(startTime.getTime() + totalMinutes * 60000)

      const { error } = await createManualTimeEntry({
        ticket_id: ticketId,
        client_id: clientId,
        user_id: user.id,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        notes: manualEntry.notes,
      })

      if (error) throw error

      setManualDialogOpen(false)
      setManualEntry({
        date: new Date().toISOString().split('T')[0],
        hours: '',
        minutes: '',
        notes: '',
      })
      
      await fetchData()
      onTimeLogged?.()

      logActivity({
        activity_type: 'time_logged',
        user_id: user?.id,
        client_id: clientId,
        entity_type: 'ticket',
        entity_id: ticketId,
        entity_name: ticketId,
        metadata: { minutes: totalMinutes, ticket_id: ticketId },
      })

      toast({
        title: 'Time logged',
        description: `Added ${formatDuration(totalMinutes)} to this task.`,
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to log time. Please try again.',
        variant: 'destructive',
      })
    }
  }

  const handleDeleteEntry = async (entryId) => {
    try {
      const { error } = await deleteTimeEntry(entryId)
      if (error) throw error

      setTimeEntries(prev => prev.filter(e => e.id !== entryId))
      onTimeLogged?.()

      toast({
        title: 'Entry deleted',
        description: 'Time entry has been removed.',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete entry.',
        variant: 'destructive',
      })
    }
  }

  // Calculate total time
  const totalMinutes = timeEntries.reduce(
    (sum, entry) => sum + (entry.duration_minutes || entry.minutes || 0),
    0
  )

  if (loading) {
    return (
      <div className="p-4 rounded-xl border bg-card animate-pulse">
        <div className="h-6 bg-muted rounded w-1/3 mb-4" />
        <div className="h-10 bg-muted rounded" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Timer Card */}
      <div className="p-4 rounded-xl border bg-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium">Time Tracking</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            Total: {formatDuration(totalMinutes)}
          </span>
        </div>

        {/* Timer Display */}
        <div className="flex items-center gap-4">
          <div className={cn(
            "relative flex-1 text-center py-4 rounded-lg font-mono text-2xl font-semibold",
            runningEntry 
              ? "bg-primary/10 text-primary" 
              : "bg-muted text-muted-foreground"
          )}>
            {runningEntry && (
              <motion.div
                className="absolute inset-0 rounded-lg bg-primary/5"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <span className="relative z-10">{elapsedTime}</span>
          </div>

          <AnimatePresence mode="wait">
            {runningEntry ? (
              <motion.div
                key="stop"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <Button
                  onClick={handleStop}
                  size="lg"
                  variant="destructive"
                  className="h-14 w-14 rounded-full p-0"
                >
                  <Square className="h-5 w-5 fill-current" />
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="start"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <Button
                  onClick={handleStart}
                  size="lg"
                  className="h-14 w-14 rounded-full p-0 bg-priority-low hover:bg-priority-low/90"
                >
                  <Play className="h-5 w-5 fill-current ml-0.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notes input */}
        <div className="mt-4">
          <Textarea
            placeholder="What are you working on?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="min-h-[60px] resize-none"
            disabled={!!runningEntry}
          />
        </div>

        {/* Manual entry button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3"
          onClick={() => setManualDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add manual entry
        </Button>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Manual Time Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={manualEntry.date}
                onChange={(e) => setManualEntry(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Hours</Label>
                <Input
                  type="number"
                  min="0"
                  max="24"
                  placeholder="0"
                  value={manualEntry.hours}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, hours: e.target.value }))}
                />
              </div>
              <div>
                <Label>Minutes</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="0"
                  value={manualEntry.minutes}
                  onChange={(e) => setManualEntry(prev => ({ ...prev, minutes: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="What did you work on?"
                value={manualEntry.notes}
                onChange={(e) => setManualEntry(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleManualSubmit}>
              Add Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
