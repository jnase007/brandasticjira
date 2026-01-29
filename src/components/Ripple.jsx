import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

/**
 * Ripple effect hook and component
 * Adds a material-design style ripple effect to any element
 * 
 * Usage:
 * const { ripples, createRipple } = useRipple()
 * <button onClick={createRipple}>
 *   <Ripples ripples={ripples} />
 *   Click me
 * </button>
 */

export function useRipple() {
  const [ripples, setRipples] = useState([])

  const createRipple = useCallback((event) => {
    const element = event.currentTarget
    const rect = element.getBoundingClientRect()
    
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    
    const size = Math.max(rect.width, rect.height) * 2
    
    const newRipple = {
      id: Date.now(),
      x: x - size / 2,
      y: y - size / 2,
      size,
    }
    
    setRipples(prev => [...prev, newRipple])
    
    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(r => r.id !== newRipple.id))
    }, 600)
  }, [])

  return { ripples, createRipple }
}

export function Ripples({ ripples, color = 'rgba(255, 255, 255, 0.3)' }) {
  return (
    <AnimatePresence>
      {ripples.map(ripple => (
        <motion.span
          key={ripple.id}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: ripple.x,
            top: ripple.y,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color,
          }}
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </AnimatePresence>
  )
}

/**
 * Ripple button wrapper component
 * Wraps content with automatic ripple effect
 */
export function RippleButton({ 
  children, 
  className = '',
  rippleColor = 'rgba(255, 255, 255, 0.3)',
  onClick,
  ...props 
}) {
  const { ripples, createRipple } = useRipple()
  
  const handleClick = useCallback((e) => {
    createRipple(e)
    onClick?.(e)
  }, [createRipple, onClick])

  return (
    <button
      className={cn("relative overflow-hidden", className)}
      onClick={handleClick}
      {...props}
    >
      <Ripples ripples={ripples} color={rippleColor} />
      {children}
    </button>
  )
}

/**
 * Pulse animation for drawing attention
 */
export function PulseRing({ className = '', color = 'brand-orange' }) {
  return (
    <span className={cn("absolute inset-0 pointer-events-none", className)}>
      <motion.span
        className={cn("absolute inset-0 rounded-full border-2", `border-${color}`)}
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.5, 0, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </span>
  )
}
