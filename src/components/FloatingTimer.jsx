import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Square, Clock, X, Minimize2, Maximize2 } from 'lucide-react'
import { cn, formatTimerDisplay } from '../lib/utils'

export default function FloatingTimer({ 
  isRunning, 
  startTime, 
  ticketId, 
  ticketTitle,
  onStart, 
  onStop,
  onClose 
}) {
  const [elapsed, setElapsed] = useState('00:00:00')
  const [minimized, setMinimized] = useState(false)

  // Update timer every second
  useEffect(() => {
    if (!isRunning || !startTime) {
      setElapsed('00:00:00')
      return
    }

    const updateTimer = () => {
      setElapsed(formatTimerDisplay(startTime))
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [isRunning, startTime])

  if (!isRunning && !ticketId) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.8 }}
        drag
        dragMomentum={false}
        className={cn(
          "fixed z-50 cursor-move",
          minimized ? "bottom-6 right-6" : "bottom-6 right-6"
        )}
      >
        {minimized ? (
          // Minimized view - just a floating button
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMinimized(false)}
            className={cn(
              "relative h-14 w-14 rounded-full shadow-lg flex items-center justify-center",
              isRunning 
                ? "bg-gradient-to-br from-brand-orange to-brand-coral" 
                : "bg-muted"
            )}
          >
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-full bg-brand-orange"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            <Clock className="h-6 w-6 text-white relative z-10" />
            {isRunning && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 border-2 border-white" />
            )}
          </motion.button>
        ) : (
          // Expanded view
          <motion.div
            layout
            className={cn(
              "w-72 rounded-2xl shadow-2xl border overflow-hidden",
              "bg-background/95 backdrop-blur-xl"
            )}
          >
            {/* Header */}
            <div className={cn(
              "px-4 py-3 flex items-center justify-between",
              isRunning ? "bg-gradient-to-r from-brand-orange to-brand-coral" : "bg-muted"
            )}>
              <div className="flex items-center gap-2">
                <Clock className={cn("h-4 w-4", isRunning ? "text-white" : "text-muted-foreground")} />
                <span className={cn("text-sm font-medium", isRunning ? "text-white" : "text-foreground")}>
                  {isRunning ? 'Timer Running' : 'Timer'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    isRunning ? "hover:bg-white/20 text-white" : "hover:bg-background text-muted-foreground"
                  )}
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    isRunning ? "hover:bg-white/20 text-white" : "hover:bg-background text-muted-foreground"
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Timer Display */}
            <div className="p-4">
              <div className={cn(
                "text-center py-4 rounded-xl font-mono text-3xl font-bold mb-3",
                isRunning 
                  ? "bg-brand-orange/10 text-brand-orange" 
                  : "bg-muted text-muted-foreground"
              )}>
                {isRunning && (
                  <motion.div
                    className="absolute inset-0 rounded-xl bg-brand-orange/5"
                    animate={{ opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
                <span className="relative z-10">{elapsed}</span>
              </div>

              {/* Ticket Info */}
              {ticketId && (
                <div className="mb-4 p-2 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Currently tracking</p>
                  <p className="text-sm font-medium truncate">{ticketId}: {ticketTitle}</p>
                </div>
              )}

              {/* Controls */}
              <div className="flex gap-2">
                {isRunning ? (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStop}
                    className="flex-1 h-11 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Square className="h-4 w-4 fill-current" />
                    Stop
                  </motion.button>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onStart}
                    className="flex-1 h-11 rounded-xl bg-green-500 hover:bg-green-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Start
                  </motion.button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
