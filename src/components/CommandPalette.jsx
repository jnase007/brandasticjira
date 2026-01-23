import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  Kanban,
  Clock,
  Users,
  Settings,
  Plus,
  ArrowRight,
  Command,
  Ticket,
  Moon,
  Sun,
  LogOut,
  Zap,
} from 'lucide-react'
import { cn } from '../lib/utils'

const COMMANDS = [
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', action: 'navigate', path: '/dashboard', category: 'Navigation' },
  { id: 'boards', label: 'Go to Boards', icon: Kanban, shortcut: 'G B', action: 'navigate', path: '/boards', category: 'Navigation' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, shortcut: 'G S', action: 'navigate', path: '/settings', category: 'Navigation' },
  { id: 'new-board', label: 'Create New Board', icon: Plus, shortcut: 'C B', action: 'navigate', path: '/boards?new=true', category: 'Actions' },
  { id: 'new-ticket', label: 'Create New Task', icon: Ticket, shortcut: 'C T', action: 'custom', category: 'Actions' },
  { id: 'start-timer', label: 'Start Timer', icon: Clock, shortcut: 'T S', action: 'custom', category: 'Time Tracking' },
  { id: 'stop-timer', label: 'Stop Timer', icon: Clock, shortcut: 'T X', action: 'custom', category: 'Time Tracking' },
  { id: 'toggle-theme', label: 'Toggle Dark Mode', icon: Moon, shortcut: 'T D', action: 'theme', category: 'Preferences' },
  { id: 'logout', label: 'Sign Out', icon: LogOut, action: 'custom', category: 'Account' },
]

export default function CommandPalette({ open, onOpenChange, onAction }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter commands based on query
  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )

  // Group by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {})

  // Flatten for keyboard navigation
  const flatCommands = Object.values(groupedCommands).flat()

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!open) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, flatCommands.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatCommands[selectedIndex]) {
          executeCommand(flatCommands[selectedIndex])
        }
        break
      case 'Escape':
        onOpenChange(false)
        break
    }
  }, [open, flatCommands, selectedIndex])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Execute command
  const executeCommand = (cmd) => {
    onOpenChange(false)
    
    switch (cmd.action) {
      case 'navigate':
        navigate(cmd.path)
        break
      case 'theme':
        document.documentElement.classList.toggle('dark')
        break
      case 'custom':
        onAction?.(cmd.id)
        break
    }
  }

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, onOpenChange])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2"
          >
            <div className="mx-4 overflow-hidden rounded-2xl border bg-background shadow-2xl">
              {/* Search Input */}
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Search className="h-5 w-5 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search commands, pages, tasks..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setSelectedIndex(0)
                  }}
                  className="flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground"
                />
                <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-muted px-2 text-xs text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Commands List */}
              <div className="max-h-[400px] overflow-y-auto p-2">
                {Object.entries(groupedCommands).length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No commands found</p>
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, commands]) => (
                    <div key={category} className="mb-4">
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {category}
                      </div>
                      {commands.map((cmd) => {
                        const isSelected = flatCommands[selectedIndex]?.id === cmd.id
                        return (
                          <button
                            key={cmd.id}
                            onClick={() => executeCommand(cmd)}
                            onMouseEnter={() => setSelectedIndex(flatCommands.findIndex(c => c.id === cmd.id))}
                            className={cn(
                              "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all",
                              isSelected
                                ? "bg-brand-orange text-white"
                                : "hover:bg-muted"
                            )}
                          >
                            <cmd.icon className={cn("h-5 w-5", isSelected ? "text-white" : "text-muted-foreground")} />
                            <span className="flex-1 font-medium">{cmd.label}</span>
                            {cmd.shortcut && (
                              <kbd className={cn(
                                "hidden sm:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-mono",
                                isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                              )}>
                                {cmd.shortcut}
                              </kbd>
                            )}
                            <ArrowRight className={cn(
                              "h-4 w-4 transition-transform",
                              isSelected ? "text-white translate-x-0" : "text-transparent -translate-x-2"
                            )} />
                          </button>
                        )
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted">↑↓</kbd> Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted">↵</kbd> Select
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Command className="h-3 w-3" />
                  <span>K to toggle</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
