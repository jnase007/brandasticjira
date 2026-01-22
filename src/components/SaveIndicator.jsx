import { motion, AnimatePresence } from 'framer-motion'
import { Check, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * Visual indicator for autosave status
 * Shows saving spinner, saved checkmark, or unsaved dot
 */
export function SaveIndicator({ 
  isSaving, 
  hasUnsavedChanges, 
  isEnabled = true,
  lastSaved,
  className,
}) {
  if (!isEnabled) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={isSaving ? 'saving' : hasUnsavedChanges ? 'unsaved' : 'saved'}
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 5 }}
        className={cn(
          "flex items-center gap-2 text-sm transition-colors",
          className
        )}
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-brand-orange" />
            <span className="text-muted-foreground">Saving...</span>
          </>
        ) : hasUnsavedChanges ? (
          <>
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-yellow-600 dark:text-yellow-400">Unsaved changes</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-green-600 dark:text-green-400">All changes saved</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Minimal save dot indicator (for tight spaces)
 */
export function SaveDot({ isSaving, hasUnsavedChanges, isEnabled = true }) {
  if (!isEnabled) return null

  return (
    <motion.div
      animate={{
        backgroundColor: isSaving 
          ? '#F7931E' 
          : hasUnsavedChanges 
            ? '#EAB308' 
            : '#22C55E',
        scale: isSaving ? [1, 1.2, 1] : 1,
      }}
      transition={{ 
        backgroundColor: { duration: 0.2 },
        scale: { repeat: isSaving ? Infinity : 0, duration: 0.5 }
      }}
      className="h-2 w-2 rounded-full"
      title={
        isSaving 
          ? 'Saving...' 
          : hasUnsavedChanges 
            ? 'Unsaved changes' 
            : 'All changes saved'
      }
    />
  )
}

export default SaveIndicator
