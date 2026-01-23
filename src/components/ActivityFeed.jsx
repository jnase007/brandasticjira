import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Activity, 
  CheckCircle, 
  Clock, 
  MessageSquare, 
  Plus, 
  ArrowRight,
  User,
  Zap,
  X,
  Building2,
  Loader2
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn, formatRelativeDate, getInitials } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'

// Map activity types to display info
const activityTypeConfig = {
  ticket_created: { icon: Plus, color: 'text-purple-500 bg-purple-500/10', action: 'created task' },
  ticket_updated: { icon: Activity, color: 'text-blue-500 bg-blue-500/10', action: 'updated' },
  ticket_completed: { icon: CheckCircle, color: 'text-green-500 bg-green-500/10', action: 'completed' },
  comment_added: { icon: MessageSquare, color: 'text-blue-500 bg-blue-500/10', action: 'commented on' },
  time_logged: { icon: Clock, color: 'text-brand-orange bg-brand-orange/10', action: 'logged time on' },
  client_created: { icon: Building2, color: 'text-teal-500 bg-teal-500/10', action: 'added client' },
  board_created: { icon: Plus, color: 'text-indigo-500 bg-indigo-500/10', action: 'created board' },
  status_changed: { icon: Activity, color: 'text-yellow-500 bg-yellow-500/10', action: 'moved' },
  assigned: { icon: User, color: 'text-pink-500 bg-pink-500/10', action: 'assigned' },
  shoutout_given: { icon: User, color: 'text-pink-500 bg-pink-500/10', action: 'gave a shoutout to' },
}

// Format minutes to readable time
function formatMinutes(minutes) {
  const hrs = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hrs === 0) return `${mins}m`
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

function ActivityItem({ activity, isNew }) {
  const config = activityTypeConfig[activity.activity_type] || { 
    icon: Activity, 
    color: 'text-muted-foreground bg-muted', 
    action: 'did something' 
  }
  const Icon = config.icon
  const metadata = activity.metadata || {}
  
  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : false}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      className="flex gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div className="flex-shrink-0">
        {activity.user?.avatar_url ? (
          <Avatar className="h-9 w-9">
            <AvatarImage src={activity.user.avatar_url} />
            <AvatarFallback className="text-xs">
              {getInitials(activity.user.full_name)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className={cn("p-2 rounded-lg", config.color)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{activity.user?.full_name || 'Someone'}</span>
          {' '}{config.action}{' '}
          <span className="font-medium text-brand-orange">
            {activity.entity_name || metadata.ticket_id || 'something'}
          </span>
          {activity.activity_type === 'time_logged' && metadata.minutes && (
            <span className="text-muted-foreground"> ({formatMinutes(metadata.minutes)})</span>
          )}
          {activity.activity_type === 'status_changed' && metadata.from_status && (
            <>
              <span className="text-muted-foreground"> from </span>
              <span className="capitalize">{metadata.from_status}</span>
              <span className="text-muted-foreground"> to </span>
              <span className="font-medium capitalize">{metadata.to_status}</span>
            </>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeDate(new Date(activity.created_at))}
        </p>
      </div>
    </motion.div>
  )
}

export default function ActivityFeed({ open, onClose }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasRealData, setHasRealData] = useState(false)

  // Fetch real activity data
  useEffect(() => {
    if (!open) return

    const fetchActivity = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('activity_log')
          .select('*, user:profiles(full_name, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(20)

        if (!error && data && data.length > 0) {
          setActivities(data)
          setHasRealData(true)
        } else {
          // No real data, will show demo
          setHasRealData(false)
        }
      } catch (err) {
        console.log('Activity log not set up yet, using demo data')
        setHasRealData(false)
      } finally {
        setLoading(false)
      }
    }

    fetchActivity()

    // Subscribe to real-time updates
    const channel = supabase
      .channel('activity-changes')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'activity_log' },
        async (payload) => {
          let nextActivity = payload.new
          if (payload.new?.user_id) {
            const { data: user } = await supabase
              .from('profiles')
              .select('full_name, avatar_url')
              .eq('id', payload.new.user_id)
              .maybeSingle()
            nextActivity = { ...payload.new, user }
          }
          setActivities(prev => [nextActivity, ...prev].slice(0, 20))
          setHasRealData(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [open])
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop - only on mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={cn(
              "fixed right-0 top-0 z-50 h-full w-80 border-l bg-background shadow-2xl",
              "flex flex-col"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-brand-orange/10">
                  <Zap className="h-4 w-4 text-brand-orange" />
                </div>
                <div>
                  <h3 className="font-semibold">Activity</h3>
                  <p className="text-xs text-muted-foreground">Real-time updates</p>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Activity List */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {hasRealData && activities.length > 0 ? (
                    activities.map((activity, index) => (
                      <ActivityItem 
                        key={activity.id} 
                        activity={activity}
                        isNew={index === 0}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 px-4">
                      <div className="p-3 rounded-full bg-muted w-fit mx-auto mb-3">
                        <Activity className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm font-medium mb-1">No activity yet</p>
                      <p className="text-xs text-muted-foreground">
                        When you or your team create tasks, log time, add comments, or move tickets, it will show up here in real time.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t">
              <Button variant="outline" className="w-full" size="sm">
                View All Activity
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
