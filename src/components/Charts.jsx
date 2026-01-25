import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

// Simple animated bar chart
export function BarChart({ data = [], height = 200, className }) {
  if (!data || data.length === 0) {
    return <div className={cn("w-full flex items-center justify-center text-muted-foreground", className)} style={{ height }}>No data</div>
  }
  
  const maxValue = Math.max(...data.map(d => d.value)) || 1
  
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <div className="flex items-end justify-between h-full gap-2">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center gap-2">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(item.value / maxValue) * 100}%` }}
              transition={{ 
                delay: index * 0.1, 
                duration: 0.6,
                type: 'spring',
                damping: 15
              }}
              className={cn(
                "w-full rounded-t-lg relative overflow-hidden",
                "bg-gradient-to-t from-brand-orange to-brand-coral"
              )}
            >
              {/* Shine effect */}
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '200%' }}
                transition={{ 
                  delay: index * 0.1 + 0.5,
                  duration: 0.8,
                  ease: 'easeOut'
                }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
              />
            </motion.div>
            <span className="text-xs text-muted-foreground font-medium">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Animated donut/ring chart
export function DonutChart({ 
  value, 
  total, 
  size = 120, 
  strokeWidth = 12,
  label,
  className 
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const percentage = Math.min((value / total) * 100, 100)
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        {/* Animated progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
        {/* Gradient definition */}
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F7931E" />
            <stop offset="100%" stopColor="#00AEEF" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-2xl font-bold"
        >
          {Math.round(percentage)}%
        </motion.span>
        {label && (
          <span className="text-xs text-muted-foreground">{label}</span>
        )}
      </div>
    </div>
  )
}

// Line/Area chart
export function AreaChart({ data, height = 150, className }) {
  const svgRef = useRef(null)
  const [dimensions, setDimensions] = useState({ width: 0, height })

  useEffect(() => {
    if (svgRef.current) {
      const { width } = svgRef.current.getBoundingClientRect()
      setDimensions({ width, height })
    }
  }, [height])

  if (!data.length || dimensions.width === 0) return <div ref={svgRef} className={cn("w-full", className)} style={{ height }} />

  const maxValue = Math.max(...data.map(d => d.value)) * 1.1
  const minValue = 0
  const range = maxValue - minValue || 1 // Prevent division by zero

  const points = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * dimensions.width : dimensions.width / 2,
    y: dimensions.height - ((d.value - minValue) / range) * dimensions.height
  }))

  const linePath = points.map((p, i) => 
    i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`
  ).join(' ')

  const areaPath = `${linePath} L ${dimensions.width} ${dimensions.height} L 0 ${dimensions.height} Z`

  return (
    <svg ref={svgRef} className={cn("w-full", className)} height={height}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map((pct) => (
        <line
          key={pct}
          x1={0}
          y1={height * (1 - pct / 100)}
          x2={dimensions.width}
          y2={height * (1 - pct / 100)}
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Gradient definition */}
      <defs>
        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F7931E" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#F7931E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <motion.path
        d={areaPath}
        fill="url(#areaGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />

      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke="url(#gradient)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      />

      {/* Data points */}
      {points.map((point, i) => (
        <motion.circle
          key={i}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="white"
          stroke="#F7931E"
          strokeWidth={2}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.1 + 0.5, duration: 0.3 }}
          className="hover:r-6 transition-all cursor-pointer"
        />
      ))}
    </svg>
  )
}

// Simple progress bars with labels
export function ProgressList({ items, className }) {
  return (
    <div className={cn("space-y-4", className)}>
      {items.map((item, index) => (
        <div key={index}>
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{item.label}</span>
            <span className="text-sm text-muted-foreground">
              {item.value}/{item.total}h
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((item.value / item.total) * 100, 100)}%` }}
              transition={{ delay: index * 0.1, duration: 0.8, ease: 'easeOut' }}
              className={cn(
                "h-full rounded-full",
                item.value > item.total * 0.9 
                  ? "bg-red-500" 
                  : item.value > item.total * 0.7 
                    ? "bg-brand-orange" 
                    : "bg-green-500"
              )}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

// Stat sparkline
export function Sparkline({ data = [], width = 80, height = 24, color = '#F7931E' }) {
  if (!data || data.length === 0) {
    return <svg width={width} height={height} />
  }
  
  const maxValue = Math.max(...data)
  const minValue = Math.min(...data)
  const range = maxValue - minValue || 1

  const points = data.map((value, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * width : width / 2
    const y = height - ((value - minValue) / range) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={width} height={height}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}
