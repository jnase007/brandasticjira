import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './ui/button'

/**
 * Visual indicator for session status.
 * Shows when session is refreshing or when there's an auth error.
 */
export default function SessionStatus() {
  const { sessionRefreshing, sessionHealthy, authError, forceRefresh, user } = useAuth()
  
  // Don't show anything if not logged in
  if (!user) return null
  
  // Show refreshing indicator
  if (sessionRefreshing) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-blue-500/90 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
        >
          <RefreshCw className="h-4 w-4 animate-spin" />
          Refreshing session...
        </motion.div>
      </AnimatePresence>
    )
  }
  
  // Show error state with retry button
  if (!sessionHealthy || authError) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-amber-500/95 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-3 text-sm backdrop-blur-sm"
        >
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span className="max-w-xs truncate">
            {authError || 'Session issue detected'}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={forceRefresh}
            className="h-7 px-3 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
          >
            Retry
          </Button>
        </motion.div>
      </AnimatePresence>
    )
  }
  
  return null
}
