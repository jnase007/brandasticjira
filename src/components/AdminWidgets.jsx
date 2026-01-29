import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { 
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle, Info, Sparkles,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

/**
 * Animated stat card with comparison
 */
export function StatCard({ 
  title, 
  value, 
  subtitle,
  icon: Icon,
  trend, // 'up' | 'down' | null
  trendValue,
  color = 'brand-orange',
  size = 'default',
  onClick,
  className = ''
}) {
  const colors = {
    'brand-orange': 'from-brand-orange/20 to-transparent border-brand-orange/30 text-brand-orange',
    'green': 'from-green-500/20 to-transparent border-green-500/30 text-green-400',
    'purple': 'from-purple-500/20 to-transparent border-purple-500/30 text-purple-400',
    'cyan': 'from-cyan-500/20 to-transparent border-cyan-500/30 text-cyan-400',
    'pink': 'from-pink-500/20 to-transparent border-pink-500/30 text-pink-400',
    'amber': 'from-amber-500/20 to-transparent border-amber-500/30 text-amber-400',
    'red': 'from-red-500/20 to-transparent border-red-500/30 text-red-400',
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "p-4 rounded-xl bg-gradient-to-br border transition-all",
        colors[color],
        onClick && "cursor-pointer",
        size === 'large' && "p-6",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={cn("text-xs mb-1 opacity-60", size === 'large' && "text-sm")}>{title}</p>
          <motion.p 
            className={cn(
              "font-bold",
              size === 'large' ? "text-4xl" : "text-2xl"
            )}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={value}
          >
            {value}
          </motion.p>
          {subtitle && (
            <p className="text-white/40 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={cn(
            "w-10 h-10 rounded-xl flex items-center justify-center",
            "bg-white/10"
          )}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
      
      {trend && (
        <div className={cn(
          "flex items-center gap-1 mt-3 text-xs",
          trend === 'up' ? "text-green-400" : "text-red-400"
        )}>
          {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{trendValue}</span>
        </div>
      )}
    </motion.div>
  )
}

/**
 * Progress ring with animation
 */
export function ProgressRing({ 
  value, 
  max = 100,
  size = 80, 
  strokeWidth = 8,
  color = '#F7931E',
  bgColor = 'rgba(255,255,255,0.1)',
  showValue = true,
  label,
  children,
}) {
  const progress = Math.min((value / max) * 100, 100)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (progress / 100) * circumference

  // Auto color based on progress
  const autoColor = progress >= 100 ? '#ef4444' : progress >= 80 ? '#f59e0b' : color

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={autoColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ strokeDasharray: circumference }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children || (showValue && (
          <>
            <motion.span 
              className="text-lg font-bold text-white"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {Math.round(progress)}%
            </motion.span>
            {label && <span className="text-[10px] text-white/50">{label}</span>}
          </>
        ))}
      </div>
    </div>
  )
}

/**
 * Mini sparkline chart
 */
export function Sparkline({ data, color = '#F7931E', height = 40, width = 100 }) {
  if (!data || data.length === 0) return null
  
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((value - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={(data.length - 1) / (data.length - 1) * width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="3"
        fill={color}
      />
    </svg>
  )
}

/**
 * Status indicator with pulse
 */
export function StatusIndicator({ status, label, showPulse = false }) {
  const statusColors = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-white/30',
  }

  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-2.5 w-2.5">
        {showPulse && (
          <span className={cn(
            "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
            statusColors[status]
          )} />
        )}
        <span className={cn(
          "relative inline-flex rounded-full h-2.5 w-2.5",
          statusColors[status]
        )} />
      </span>
      {label && <span className="text-sm text-white/70">{label}</span>}
    </div>
  )
}

/**
 * Alert banner with different severity levels
 */
export function AlertBanner({ type = 'info', title, message, onDismiss }) {
  const styles = {
    success: 'bg-green-500/10 border-green-500/30 text-green-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
    error: 'bg-red-500/10 border-red-500/30 text-red-400',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  }

  const icons = {
    success: CheckCircle,
    warning: AlertTriangle,
    error: AlertTriangle,
    info: Info,
  }

  const Icon = icons[type]

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn("flex items-start gap-3 p-4 rounded-xl border", styles[type])}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        {title && <p className="font-medium">{title}</p>}
        {message && <p className="text-sm opacity-80 mt-0.5">{message}</p>}
      </div>
    </motion.div>
  )
}

/**
 * Comparison badge
 */
export function ComparisonBadge({ current, previous, format = 'percent' }) {
  if (!previous) return null
  
  const change = ((current - previous) / previous) * 100
  const isPositive = change >= 0
  
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded",
      isPositive 
        ? "bg-green-500/20 text-green-400" 
        : "bg-red-500/20 text-red-400"
    )}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  )
}

/**
 * Metric row for tables
 */
export function MetricRow({ label, value, subValue, trend, sparklineData }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-white/5 hover:bg-white/5 px-2 -mx-2 rounded transition-colors">
      <span className="text-white/70">{label}</span>
      <div className="flex items-center gap-4">
        {sparklineData && (
          <Sparkline data={sparklineData} width={60} height={20} />
        )}
        <div className="text-right">
          <span className="text-white font-medium">{value}</span>
          {subValue && <span className="text-white/40 text-xs ml-2">{subValue}</span>}
        </div>
        {trend && <ComparisonBadge current={trend.current} previous={trend.previous} />}
      </div>
    </div>
  )
}

/**
 * Goal tracker with milestones
 */
export function GoalTracker({ current, target, milestones = [], label }) {
  const progress = (current / target) * 100
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-white/50">{label}</span>
        <span className="text-white font-medium">{current.toLocaleString()} / {target.toLocaleString()}</span>
      </div>
      
      <div className="relative">
        <div className="h-3 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-brand-orange to-brand-coral rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        
        {/* Milestones */}
        {milestones.map((milestone, i) => {
          const position = (milestone.value / target) * 100
          const reached = current >= milestone.value
          
          return (
            <TooltipProvider key={i}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className="absolute top-0 -translate-x-1/2"
                    style={{ left: `${position}%` }}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 border-[#0a1628]",
                      reached ? "bg-green-500" : "bg-white/30"
                    )} />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{milestone.label}: {milestone.value.toLocaleString()}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Quick action button with glow
 */
export function QuickActionButton({ icon: Icon, label, onClick, color = 'brand-orange' }) {
  const colors = {
    'brand-orange': 'bg-brand-orange hover:bg-brand-coral shadow-brand-orange/30',
    'green': 'bg-green-500 hover:bg-green-600 shadow-green-500/30',
    'purple': 'bg-purple-500 hover:bg-purple-600 shadow-purple-500/30',
  }

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium",
        "shadow-lg transition-all",
        colors[color]
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </motion.button>
  )
}

/**
 * Section header with action
 */
export function SectionHeader({ icon: Icon, title, subtitle, action, iconColor = 'text-brand-orange', iconBg = 'bg-brand-orange/20' }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", iconBg)}>
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {subtitle && <p className="text-white/40 text-sm">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}

/**
 * Animated number with flip effect
 */
export function FlipNumber({ value, prefix = '', suffix = '', className = '' }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("tabular-nums", className)}
    >
      {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
    </motion.span>
  )
}

/**
 * Keyboard shortcut hint
 */
export function KeyboardShortcut({ keys }) {
  return (
    <span className="inline-flex items-center gap-0.5 ml-2">
      {keys.split(' ').map((key, i) => (
        <kbd
          key={i}
          className="inline-flex items-center justify-center min-w-[18px] h-5 px-1 text-[10px] font-mono bg-white/10 border border-white/20 rounded text-white/50"
        >
          {key}
        </kbd>
      ))}
    </span>
  )
}

/**
 * Empty state with illustration
 */
export function EmptyStateAdmin({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-16"
    >
      <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-6">
        <Icon className="h-10 w-10 text-white/20" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-white/50 max-w-md mx-auto mb-6">{description}</p>
      {action}
    </motion.div>
  )
}
