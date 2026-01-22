import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Keyboard, Command } from 'lucide-react'
import { cn } from '../lib/utils'

const SHORTCUTS = [
  {
    category: 'Navigation',
    items: [
      { keys: ['G', 'D'], description: 'Go to Dashboard' },
      { keys: ['G', 'B'], description: 'Go to Boards' },
      { keys: ['G', 'C'], description: 'Go to Clients' },
      { keys: ['G', 'T'], description: 'Go to Team Hub' },
      { keys: ['G', 'S'], description: 'Go to Settings' },
      { keys: ['G', 'A'], description: 'Go to Admin (if admin)' },
    ],
  },
  {
    category: 'Actions',
    items: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['T'], description: 'Toggle timer' },
      { keys: ['N'], description: 'New ticket' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    category: 'Timer',
    items: [
      { keys: ['Space'], description: 'Start/Stop timer (when focused)' },
      { keys: ['Esc'], description: 'Close timer' },
    ],
  },
  {
    category: 'Boards',
    items: [
      { keys: ['C'], description: 'Create new ticket' },
      { keys: ['F'], description: 'Filter tickets' },
      { keys: ['←', '→'], description: 'Navigate columns' },
    ],
  },
  {
    category: 'Global',
    items: [
      { keys: ['⌘', '⇧', 'D'], description: 'Toggle dark mode' },
      { keys: ['Esc'], description: 'Close dialogs/modals' },
      { keys: ['⌘', 'S'], description: 'Save (when editing)' },
    ],
  },
]

export function ShortcutsPanel({ isOpen, onClose }) {
  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-2xl sm:max-h-[80vh] z-50 bg-background rounded-2xl shadow-2xl border overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-orange/10">
                  <Keyboard className="h-5 w-5 text-brand-orange" />
                </div>
                <div>
                  <h2 className="font-bold text-lg">Keyboard Shortcuts</h2>
                  <p className="text-sm text-muted-foreground">
                    Master the app with these shortcuts
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid gap-6 sm:grid-cols-2">
                {SHORTCUTS.map((section) => (
                  <div key={section.category}>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3">
                      {section.category}
                    </h3>
                    <div className="space-y-2">
                      {section.items.map((shortcut, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, j) => (
                              <kbd
                                key={j}
                                className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded bg-muted border text-xs font-mono"
                              >
                                {key}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Command className="h-4 w-4" />
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted border text-xs font-mono">?</kbd>
                <span>anytime to show this panel</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default ShortcutsPanel
