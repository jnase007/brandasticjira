import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

/**
 * Beautiful shimmer loading skeleton for cards
 */
export function CardSkeleton({ className = '' }) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted skeleton-shimmer" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-muted rounded skeleton-shimmer" />
          <div className="h-3 w-1/2 bg-muted rounded skeleton-shimmer" />
        </div>
      </div>
      
      {/* Content */}
      <div className="grid grid-cols-2 gap-4">
        <div className="h-16 bg-muted rounded-lg skeleton-shimmer" />
        <div className="h-16 bg-muted rounded-lg skeleton-shimmer" />
      </div>
      
      {/* Footer */}
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-muted rounded-full skeleton-shimmer" />
        <div className="h-6 w-16 bg-muted rounded-full skeleton-shimmer" />
      </div>
    </div>
  )
}

/**
 * Staggered loading cards
 */
export function LoadingCardGrid({ count = 6, className = '' }) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <CardSkeleton />
        </motion.div>
      ))}
    </div>
  )
}

/**
 * Table row skeleton
 */
export function TableRowSkeleton({ columns = 5 }) {
  return (
    <tr className="border-b">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <div 
            className="h-4 bg-muted rounded skeleton-shimmer"
            style={{ width: `${60 + Math.random() * 40}%` }}
          />
        </td>
      ))}
    </tr>
  )
}

/**
 * Stats card skeleton
 */
export function StatSkeleton() {
  return (
    <div className="p-4 rounded-xl border bg-card">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-muted skeleton-shimmer" />
        <div className="flex-1">
          <div className="h-6 w-16 bg-muted rounded skeleton-shimmer mb-1" />
          <div className="h-3 w-24 bg-muted rounded skeleton-shimmer" />
        </div>
      </div>
    </div>
  )
}

/**
 * Line of text skeleton
 */
export function TextSkeleton({ width = '100%', height = 16 }) {
  return (
    <div 
      className="bg-muted rounded skeleton-shimmer"
      style={{ width, height }}
    />
  )
}

/**
 * Avatar skeleton
 */
export function AvatarSkeleton({ size = 40 }) {
  return (
    <div 
      className="rounded-full bg-muted skeleton-shimmer"
      style={{ width: size, height: size }}
    />
  )
}

/**
 * Page loading state
 */
export function PageLoading({ title = 'Loading...' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-[400px] gap-4"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full"
      />
      <p className="text-muted-foreground text-sm">{title}</p>
    </motion.div>
  )
}
