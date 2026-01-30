import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Plus, Timer, X, ClipboardList, Command, Keyboard
} from 'lucide-react'
import { cn } from '../lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export function QuickActionsFAB({ 
  onStartTimer, 
  onNewTicket, 
  onOpenSearch,
  onShowShortcuts 
}) {
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    { 
      id: 'timer', 
      icon: Timer, 
      label: 'Start Timer', 
      shortcut: 'T S',
      onClick: onStartTimer,
      color: 'from-green-500 to-emerald-500'
    },
    { 
      id: 'task', 
      icon: ClipboardList, 
      label: 'New Task', 
      shortcut: 'C T',
      onClick: onNewTicket,
      color: 'from-purple-500 to-violet-500'
    },
    { 
      id: 'command', 
      icon: Command, 
      label: 'Command Palette', 
      shortcut: '⌘K',
      onClick: onOpenSearch,
      color: 'from-orange-500 to-amber-500'
    },
    { 
      id: 'shortcuts', 
      icon: Keyboard, 
      label: 'Shortcuts', 
      shortcut: '?',
      onClick: onShowShortcuts,
      color: 'from-slate-500 to-slate-600'
    },
  ]

  return (
    <div className="fixed bottom-24 right-6 z-40 lg:bottom-8 hidden sm:block">
      <TooltipProvider delayDuration={100}>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-16 right-0 flex flex-col-reverse gap-2 items-end"
            >
              {actions.map((action, idx) => (
                <motion.div
                  key={action.id}
                  initial={{ opacity: 0, scale: 0.8, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 20 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          action.onClick?.()
                          setIsOpen(false)
                        }}
                        className={cn(
                          "flex items-center gap-3 pl-4 pr-3 py-2.5 rounded-full",
                          "bg-gradient-to-r shadow-lg",
                          "text-white font-medium text-sm",
                          "hover:scale-105 active:scale-95 transition-transform",
                          action.color
                        )}
                      >
                        <span>{action.label}</span>
                        <action.icon className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left">
                      <div className="flex items-center gap-2">
                        <span>{action.label}</span>
                        <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-xs font-mono">
                          {action.shortcut}
                        </kbd>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main FAB Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              onClick={() => setIsOpen(!isOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "w-14 h-14 rounded-full shadow-xl",
                "bg-gradient-to-br from-brand-orange to-brand-coral",
                "flex items-center justify-center",
                "text-white transition-all",
                "hover:shadow-2xl hover:shadow-brand-orange/30",
                isOpen && "rotate-45"
              )}
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 45, opacity: 0 }}
                  >
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="open"
                    initial={{ rotate: 45, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -45, opacity: 0 }}
                  >
                    <Plus className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="left">
            Quick Actions
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
