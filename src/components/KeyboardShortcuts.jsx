import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard, X, Command } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

const SHORTCUTS = [
  { category: 'Navigation', shortcuts: [
    { keys: ['⌘', 'K'], description: 'Open Command Palette' },
    { keys: ['G', 'D'], description: 'Go to Dashboard' },
    { keys: ['G', 'B'], description: 'Go to Boards' },
    { keys: ['G', 'S'], description: 'Go to Settings' },
  ]},
  { category: 'Actions', shortcuts: [
    { keys: ['C', 'B'], description: 'Create New Board' },
    { keys: ['C', 'T'], description: 'Create New Task' },
    { keys: ['T', 'S'], description: 'Start Timer' },
    { keys: ['T', 'X'], description: 'Stop Timer' },
  ]},
  { category: 'Preferences', shortcuts: [
    { keys: ['⌘', '⇧', 'D'], description: 'Toggle Dark Mode' },
    { keys: ['?'], description: 'Show Keyboard Shortcuts' },
    { keys: ['Esc'], description: 'Close Modal / Cancel' },
  ]},
]

export default function KeyboardShortcuts({ open, onClose }) {
  // Toggle with ? key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        // Toggle handled externally
      }
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2"
          >
            <div className="mx-4 rounded-2xl border bg-background shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-brand-orange/10">
                    <Keyboard className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">Keyboard Shortcuts</h2>
                    <p className="text-sm text-muted-foreground">Navigate faster with keys</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Shortcuts List */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {SHORTCUTS.map((group) => (
                  <div key={group.category}>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      {group.category}
                    </h3>
                    <div className="space-y-2">
                      {group.shortcuts.map((shortcut, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <span className="text-sm">{shortcut.description}</span>
                          <div className="flex items-center gap-1">
                            {shortcut.keys.map((key, keyIndex) => (
                              <kbd
                                key={keyIndex}
                                className={cn(
                                  "px-2 py-1 rounded-md text-xs font-mono",
                                  "bg-muted border shadow-sm",
                                  key === '⌘' && "px-1.5"
                                )}
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

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-muted/30">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Command className="h-4 w-4" />
                  <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">?</kbd> anytime to toggle</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Hook for keyboard shortcut sequences (like "G then D")
export function useKeySequence(sequence, callback, deps = []) {
  useEffect(() => {
    let buffer = []
    let timeout = null

    const handleKeyDown = (e) => {
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey) return

      buffer.push(e.key.toUpperCase())

      // Reset after delay
      if (timeout) clearTimeout(timeout)
      timeout = setTimeout(() => {
        buffer = []
      }, 500)

      // Check if sequence matches
      if (buffer.length === sequence.length) {
        const matches = buffer.every((key, i) => key === sequence[i].toUpperCase())
        if (matches) {
          e.preventDefault()
          callback()
        }
        buffer = []
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (timeout) clearTimeout(timeout)
    }
  }, deps)
}
