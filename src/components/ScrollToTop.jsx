import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { cn } from '../lib/utils'

/**
 * Floating scroll-to-top button
 * Appears when user scrolls down the page
 */
export default function ScrollToTop({ threshold = 400, className = '' }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > threshold)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToTop}
          className={cn(
            "fixed bottom-20 right-4 z-40",
            "w-10 h-10 rounded-full",
            "bg-brand-orange text-white shadow-lg shadow-brand-orange/30",
            "flex items-center justify-center",
            "hover:bg-brand-coral transition-colors",
            "lg:bottom-8",
            className
          )}
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/**
 * Scroll progress indicator
 * Shows a progress bar at the top of the page
 */
export function ScrollProgress({ className = '' }) {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
      const scrolled = (window.scrollY / scrollHeight) * 100
      setProgress(scrolled)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <div className={cn("fixed top-0 left-0 right-0 h-1 z-50", className)}>
      <motion.div
        className="h-full bg-gradient-to-r from-brand-orange to-brand-coral"
        style={{ width: `${progress}%` }}
        transition={{ duration: 0.1 }}
      />
    </div>
  )
}

/**
 * Section observer - triggers animation when section comes into view
 */
export function useInView(options = {}) {
  const [ref, setRef] = useState(null)
  const [isInView, setIsInView] = useState(false)

  useEffect(() => {
    if (!ref) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true)
          if (options.once) observer.disconnect()
        } else if (!options.once) {
          setIsInView(false)
        }
      },
      {
        threshold: options.threshold || 0.1,
        rootMargin: options.rootMargin || '0px',
      }
    )

    observer.observe(ref)
    return () => observer.disconnect()
  }, [ref, options.threshold, options.rootMargin, options.once])

  return { ref: setRef, isInView }
}
