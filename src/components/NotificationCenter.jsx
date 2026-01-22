import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell, X, Check, CheckCheck, Heart, AtSign, 
  ClipboardList, MessageSquare, Trophy, Info,
  Trash2, Settings,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatRelativeDate } from '../lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

const NOTIFICATION_ICONS = {
  kudos: { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  mention: { icon: AtSign, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  assignment: { icon: ClipboardList, color: 'text-orange-500', bg: 'bg-orange-500/10' },
  comment: { icon: MessageSquare, color: 'text-green-500', bg: 'bg-green-500/10' },
  achievement: { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  system: { icon: Info, color: 'text-gray-500', bg: 'bg-gray-500/10' },
}

export function NotificationBell() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Fetch notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
      setLoading(false)
    }

    fetchNotifications()

    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev])
          setUnreadCount(prev => prev + 1)
          
          // Play notification sound (optional)
          // new Audio('/notification.mp3').play()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markAsRead = async (notificationId) => {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllAsRead = async () => {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false)

    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const deleteNotification = async (notificationId) => {
    await supabase.from('notifications').delete().eq('id', notificationId)
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
  }

  return (
    <>
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="relative"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </motion.span>
        )}
      </Button>

      {/* Notification Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="fixed right-4 top-4 bottom-4 w-full max-w-sm z-50 bg-background rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-brand-orange" />
                  <h2 className="font-bold">Notifications</h2>
                  {unreadCount > 0 && (
                    <Badge className="bg-red-500 text-white">{unreadCount}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      <CheckCheck className="h-4 w-4 mr-1" />
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Notifications List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <Bell className="h-12 w-12 mb-3 opacity-30" />
                    <p>No notifications yet</p>
                  </div>
                ) : (
                  <div className="p-2">
                    {notifications.map((notification) => {
                      const config = NOTIFICATION_ICONS[notification.type] || NOTIFICATION_ICONS.system
                      const Icon = config.icon
                      
                      return (
                        <motion.div
                          key={notification.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "group p-3 rounded-xl mb-2 transition-colors cursor-pointer",
                            notification.read 
                              ? "hover:bg-muted/50" 
                              : "bg-brand-orange/5 hover:bg-brand-orange/10"
                          )}
                          onClick={() => !notification.read && markAsRead(notification.id)}
                        >
                          <div className="flex gap-3">
                            <div className={cn("p-2 rounded-xl flex-shrink-0", config.bg)}>
                              <Icon className={cn("h-4 w-4", config.color)} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={cn(
                                  "text-sm font-medium",
                                  !notification.read && "text-foreground"
                                )}>
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <div className="w-2 h-2 rounded-full bg-brand-orange flex-shrink-0 mt-1.5" />
                                )}
                              </div>
                              {notification.message && (
                                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {notification.message}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatRelativeDate(new Date(notification.created_at))}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNotification(notification.id)
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-all"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t">
                <Button variant="ghost" className="w-full text-sm" asChild>
                  <a href="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Notification Settings
                  </a>
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

export default NotificationBell
