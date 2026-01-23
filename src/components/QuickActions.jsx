import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Timer, FileText, Users, Kanban, Clock,
  MessageSquare, Zap, Sparkles, Target, Trophy,
  Calendar, BarChart3, Search, Keyboard,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'

const QUICK_ACTIONS = [
  { id: 'timer', icon: Timer, label: 'Start Timer', color: 'bg-green-500', shortcut: 'T' },
  { id: 'ticket', icon: FileText, label: 'New Task', color: 'bg-blue-500', shortcut: 'N' },
  { id: 'search', icon: Search, label: 'Search', color: 'bg-purple-500', shortcut: '/' },
  { id: 'boards', icon: Kanban, label: 'Boards', color: 'bg-orange-500', path: '/boards' },
  { id: 'time', icon: Clock, label: 'Time Log', color: 'bg-teal-500', path: '/time' },
  { id: 'shortcuts', icon: Keyboard, label: 'Shortcuts', color: 'bg-gray-500', shortcut: '?' },
]

export function QuickActionsFAB({ 
  onStartTimer, 
  onNewTicket, 
  onOpenSearch,
  onShowShortcuts,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleAction = (action) => {
    setIsOpen(false)
    
    switch (action.id) {
      case 'timer':
        onStartTimer?.()
        break
      case 'ticket':
        onNewTicket?.()
        break
      case 'search':
        onOpenSearch?.()
        break
      case 'shortcuts':
        onShowShortcuts?.()
        break
      default:
        if (action.path) {
          navigate(action.path)
        }
    }
  }

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm hidden lg:block"
          />
        )}
      </AnimatePresence>

      {/* FAB Container - Desktop only */}
      <div className="fixed bottom-6 right-6 z-50 hidden lg:flex flex-col-reverse items-end gap-3">
        {/* Action Buttons */}
        <AnimatePresence>
          {isOpen && QUICK_ACTIONS.map((action, index) => (
            <motion.button
              key={action.id}
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ 
                opacity: 1, 
                y: 0, 
                scale: 1,
                transition: { delay: index * 0.05 }
              }}
              exit={{ 
                opacity: 0, 
                y: 10, 
                scale: 0.8,
                transition: { delay: (QUICK_ACTIONS.length - index) * 0.03 }
              }}
              onClick={() => handleAction(action)}
              className="flex items-center gap-3 group"
            >
              {/* Label */}
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0, transition: { delay: index * 0.05 + 0.1 } }}
                className="px-3 py-1.5 rounded-lg bg-background border shadow-lg text-sm font-medium whitespace-nowrap"
              >
                {action.label}
                {action.shortcut && (
                  <kbd className="ml-2 px-1.5 py-0.5 rounded bg-muted text-xs font-mono">
                    {action.shortcut}
                  </kbd>
                )}
              </motion.span>
              
              {/* Icon Button */}
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110",
                action.color
              )}>
                <action.icon className="h-5 w-5" />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
            isOpen 
              ? "bg-gray-800 dark:bg-gray-200 rotate-45" 
              : "bg-gradient-to-br from-brand-orange to-brand-coral"
          )}
        >
          {isOpen ? (
            <X className="h-6 w-6 text-white dark:text-gray-800" />
          ) : (
            <Plus className="h-6 w-6 text-white" />
          )}
        </motion.button>
      </div>
    </>
  )
}

export default QuickActionsFAB
