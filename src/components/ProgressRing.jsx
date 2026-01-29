import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

/**
 * Animated circular progress ring
 * 
 * @param {number} progress - Progress value 0-100
 * @param {number} size - Size in pixels (default 60)
 * @param {number} strokeWidth - Stroke width (default 6)
 * @param {string} className - Additional classes
 * @param {boolean} showValue - Show percentage in center
 * @param {string} color - Color class or hex (default brand-orange)
 */
export default function ProgressRing({ 
  progress = 0, 
  size = 60, 
  strokeWidth = 6,
  className = '',
  showValue = true,
  color = 'stroke-brand-orange',
  bgColor = 'stroke-muted',
  children,
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference
  
  // Determine color based on progress
  const getAutoColor = () => {
    if (progress >= 100) return 'stroke-red-500'
    if (progress >= 80) return 'stroke-amber-500'
    return 'stroke-brand-orange'
  }
  
  const actualColor = color === 'auto' ? getAutoColor() : color

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={bgColor}
          strokeWidth={strokeWidth}
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={actualColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{
            strokeDasharray: circumference,
          }}
        />
      </svg>
      
      {/* Center content */}
      <div className="absolute inset-0 flex items-center justify-center">
        {children || (showValue && (
          <motion.span 
            className="text-sm font-bold"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
          >
            {Math.round(progress)}%
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/**
 * Mini version for inline use
 */
export function MiniProgressRing({ progress, size = 24, strokeWidth = 3 }) {
  return (
    <ProgressRing 
      progress={progress} 
      size={size} 
      strokeWidth={strokeWidth}
      showValue={false}
      color="auto"
    />
  )
}

/**
 * Hours progress ring with label
 */
export function HoursProgressRing({ used, total, size = 80 }) {
  const progress = total > 0 ? (used / total) * 100 : 0
  
  return (
    <ProgressRing progress={progress} size={size} color="auto">
      <div className="text-center">
        <div className="text-lg font-bold">{used}h</div>
        <div className="text-[10px] text-muted-foreground">/ {total}h</div>
      </div>
    </ProgressRing>
  )
}
