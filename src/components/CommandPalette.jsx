import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
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
  Building2,
  BarChart3,
  Trophy,
  Wallet,
  Timer,
  HelpCircle,
  Keyboard,
  Activity,
  Users2,
  Hash,
  Loader2,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { supabase } from '../lib/supabase'
import { Badge } from './ui/badge'

const COMMANDS = [
  // Navigation
  { id: 'dashboard', label: 'Go to Dashboard', icon: LayoutDashboard, shortcut: 'G D', action: 'navigate', path: '/dashboard', category: 'Navigation' },
  { id: 'time', label: 'Go to Time Tracking', icon: Clock, shortcut: 'G T', action: 'navigate', path: '/time', category: 'Navigation' },
  { id: 'clients', label: 'Go to Clients', icon: Building2, shortcut: 'G C', action: 'navigate', path: '/clients', category: 'Navigation' },
  { id: 'reports', label: 'Go to Reports', icon: BarChart3, shortcut: 'G R', action: 'navigate', path: '/reports', category: 'Navigation' },
  { id: 'payroll', label: 'Go to Payroll Report', icon: Wallet, action: 'navigate', path: '/reports?tab=payroll', category: 'Navigation' },
  { id: 'team', label: 'Go to Team Hub', icon: Users2, shortcut: 'G H', action: 'navigate', path: '/team', category: 'Navigation' },
  { id: 'leaderboard', label: 'Go to Leaderboard', icon: Trophy, shortcut: 'G L', action: 'navigate', path: '/leaderboard', category: 'Navigation' },
  { id: 'boards', label: 'Go to Boards', icon: Kanban, shortcut: 'G B', action: 'navigate', path: '/boards', category: 'Navigation' },
  { id: 'settings', label: 'Go to Settings', icon: Settings, shortcut: 'G S', action: 'navigate', path: '/settings', category: 'Navigation' },
  
  // Quick Actions
  { id: 'log-time', label: 'Log Time Entry', icon: Clock, shortcut: 'T L', action: 'custom', category: 'Quick Actions' },
  { id: 'start-timer', label: 'Start Timer', icon: Timer, shortcut: 'T S', action: 'custom', category: 'Quick Actions' },
  { id: 'stop-timer', label: 'Stop Timer', icon: Timer, shortcut: 'T X', action: 'custom', category: 'Quick Actions' },
  { id: 'new-ticket', label: 'Create New Task', icon: Ticket, shortcut: 'C T', action: 'custom', category: 'Quick Actions' },
  { id: 'new-board', label: 'Create New Board', icon: Plus, shortcut: 'C B', action: 'navigate', path: '/boards?new=true', category: 'Quick Actions' },
  { id: 'activity', label: 'View Activity Feed', icon: Activity, action: 'custom', category: 'Quick Actions' },
  
  // Preferences
  { id: 'toggle-theme', label: 'Toggle Dark Mode', icon: Moon, shortcut: 'T D', action: 'theme', category: 'Preferences' },
  { id: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', icon: Keyboard, shortcut: '?', action: 'custom', category: 'Preferences' },
  
  // Account
  { id: 'logout', label: 'Sign Out', icon: LogOut, action: 'custom', category: 'Account' },
]

export default function CommandPalette({ open, onOpenChange, onAction }) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const searchTimeoutRef = useRef(null)

  // Search tickets when query changes
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      return
    }

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        // Search by ticket_id or title
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id, ticket_id, title, client_id, client:client_id(name)')
          .or(`ticket_id.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(5)

        // Also search clients
        const { data: clients } = await supabase
          .from('clients')
          .select('id, name')
          .ilike('name', `%${query}%`)
          .limit(3)

        const results = []
        
        // Add ticket results
        if (tickets?.length) {
          tickets.forEach(t => {
            results.push({
              id: `ticket-${t.id}`,
              type: 'ticket',
              label: t.title,
              sublabel: `${t.ticket_id || 'No ID'} • ${t.client?.name || 'Unknown Client'}`,
              ticketId: t.ticket_id,
              icon: Hash,
              action: 'navigate',
              path: `/clients/${t.client_id}/tickets/${t.id}`,
              category: 'Tickets',
            })
          })
        }

        // Add client results
        if (clients?.length) {
          clients.forEach(c => {
            results.push({
              id: `client-${c.id}`,
              type: 'client',
              label: c.name,
              sublabel: 'Client',
              icon: Building2,
              action: 'navigate',
              path: `/clients/${c.id}`,
              category: 'Clients',
            })
          })
        }

        setSearchResults(results)
      } catch (error) {
        console.error('Search error:', error)
      } finally {
        setSearching(false)
      }
    }, 200)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [query])

  // Filter commands based on query
  const filteredCommands = COMMANDS.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase()) ||
    cmd.category.toLowerCase().includes(query.toLowerCase())
  )

  // Group by category (including search results)
  const groupedCommands = useMemo(() => {
    const grouped = {}
    
    // Add search results first
    searchResults.forEach(result => {
      if (!grouped[result.category]) grouped[result.category] = []
      grouped[result.category].push(result)
    })
    
    // Add filtered commands
    filteredCommands.forEach(cmd => {
      if (!grouped[cmd.category]) grouped[cmd.category] = []
      grouped[cmd.category].push(cmd)
    })
    
    return grouped
  }, [filteredCommands, searchResults])

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
                {searching ? (
                  <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                ) : (
                  <Search className="h-5 w-5 text-muted-foreground" />
                )}
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Search tickets (BRA-1), clients, commands..."
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
                            <cmd.icon className={cn("h-5 w-5 flex-shrink-0", isSelected ? "text-white" : "text-muted-foreground")} />
                            <div className="flex-1 min-w-0">
                              <span className="font-medium block truncate">{cmd.label}</span>
                              {cmd.sublabel && (
                                <span className={cn(
                                  "text-xs block truncate",
                                  isSelected ? "text-white/80" : "text-muted-foreground"
                                )}>
                                  {cmd.sublabel}
                                </span>
                              )}
                            </div>
                            {cmd.ticketId && (
                              <Badge 
                                variant="outline" 
                                className={cn(
                                  "font-mono text-xs flex-shrink-0",
                                  isSelected ? "bg-white/20 text-white border-white/30" : "bg-blue-50 text-blue-700 border-blue-200"
                                )}
                              >
                                {cmd.ticketId}
                              </Badge>
                            )}
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
