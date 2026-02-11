import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, RefreshCw } from 'lucide-react'

// Brandastic Logo (PNG with transparency for dark mode)
const LOGO = 'https://auth.brandastic.co/storage/v1/object/public/images/mark.png'

export default function LoadingScreen() {
  const [showRecovery, setShowRecovery] = useState(false)
  
  // Show recovery option after 10 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowRecovery(true)
    }, 10000)
    
    return () => clearTimeout(timeout)
  }, [])
  
  const handleClearAndReload = () => {
    // Clear all auth-related storage
    localStorage.clear()
    sessionStorage.clear()
    // Clear caches if available
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name))
      })
    }
    window.location.href = '/'
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center">
      <motion.div
        className="text-center"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.img
          src={LOGO}
          alt="Brandastic"
          className="w-16 h-16 mx-auto mb-4"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
        
        {/* Recovery option after timeout */}
        <AnimatePresence>
          {showRecovery && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8"
            >
              <p className="text-xs text-muted-foreground mb-3">
                Taking longer than expected?
              </p>
              <button
                onClick={handleClearAndReload}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Clear Cache & Reload
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
