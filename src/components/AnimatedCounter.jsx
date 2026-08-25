import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform, useInView } from 'framer-motion'

export default function AnimatedCounter({ 
  value, 
  duration = 2,
  suffix = '',
  prefix = '',
  decimals = 0,
  className = ''
}) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0, margin: "200px" })
  const [hasAnimated, setHasAnimated] = useState(false)
  
  const spring = useSpring(0, {
    mass: 1,
    stiffness: 75,
    damping: 15,
    duration: duration * 1000,
  })

  const display = useTransform(spring, (current) => {
    return `${prefix}${current.toFixed(decimals)}${suffix}`
  })

  useEffect(() => {
    if (!hasAnimated) {
      spring.set(value)
      setHasAnimated(true)
    }
  }, [isInView, value, spring, hasAnimated])

  // Update if value changes after initial animation
  useEffect(() => {
    if (hasAnimated) {
      spring.set(value)
    }
  }, [value, spring, hasAnimated])

  return (
    <motion.span ref={ref} className={className}>
      {display}
    </motion.span>
  )
}

// Specialized counter for percentages
export function PercentageCounter({ value, className = '' }) {
  return (
    <AnimatedCounter 
      value={value} 
      suffix="%" 
      decimals={0}
      className={className}
    />
  )
}

// Specialized counter for hours
export function HoursCounter({ value, total, className = '' }) {
  return (
    <span className={className}>
      <AnimatedCounter value={value} decimals={0} />
      <span className="text-lg text-muted-foreground font-normal">/{total}</span>
    </span>
  )
}
