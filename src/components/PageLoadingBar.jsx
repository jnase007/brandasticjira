import { motion, AnimatePresence } from 'framer-motion'

/**
 * A sleek top-of-page loading bar with a "laser" effect
 * Shows a glowing blue line that animates across the top of the screen
 */
export default function PageLoadingBar({ isLoading }) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed top-0 left-0 right-0 z-[9999] h-1 bg-slate-200/50 dark:bg-slate-800/50 overflow-hidden"
        >
          {/* Main animated bar with laser glow effect */}
          <motion.div
            className="absolute inset-0"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            {/* Laser glow - outer */}
            <div 
              className="absolute inset-0 w-full"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.3) 30%, rgba(59, 130, 246, 0.8) 50%, rgba(59, 130, 246, 0.3) 70%, transparent 100%)',
                boxShadow: '0 0 20px rgba(59, 130, 246, 0.6), 0 0 40px rgba(59, 130, 246, 0.4)',
              }}
            />
            {/* Laser core - bright center */}
            <div 
              className="absolute inset-0 w-full h-0.5 top-1/2 -translate-y-1/2"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, #60a5fa 30%, #3b82f6 50%, #60a5fa 70%, transparent 100%)',
              }}
            />
          </motion.div>

          {/* Secondary pulse wave for extra visibility */}
          <motion.div
            className="absolute inset-0"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 0.4,
            }}
          >
            <div 
              className="absolute inset-0 w-1/2 opacity-60"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(96, 165, 250, 0.5) 50%, transparent 100%)',
              }}
            />
          </motion.div>

          {/* Shimmer overlay */}
          <motion.div
            className="absolute inset-0"
            animate={{
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Inline loading bar for use within components/cards
 * A smaller version of the page loading bar
 */
export function InlineLoadingBar({ className = '' }) {
  return (
    <div className={`relative h-1 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="absolute inset-0"
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div 
          className="absolute inset-0 w-full"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(59, 130, 246, 0.4) 30%, rgba(59, 130, 246, 1) 50%, rgba(59, 130, 246, 0.4) 70%, transparent 100%)',
          }}
        />
      </motion.div>
    </div>
  )
}
