import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Smartphone } from 'lucide-react'
import { Button } from './ui/button'

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://')
    setIsStandalone(standalone)
    
    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)
    
    // Check if user dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    const dismissedDate = dismissed ? new Date(dismissed) : null
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    
    // Show again after a week
    if (dismissedDate && dismissedDate > weekAgo) {
      return
    }

    // Listen for beforeinstallprompt
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
      // Delay showing prompt for better UX
      setTimeout(() => setShowPrompt(true), 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)
    
    // For iOS, show after delay if not standalone
    if (ios && !standalone) {
      setTimeout(() => setShowPrompt(true), 5000)
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', new Date().toISOString())
  }

  // Don't show if already installed
  if (isStandalone) return null

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className="bg-gradient-to-br from-brand-orange to-orange-600 rounded-2xl p-4 shadow-2xl border border-orange-400/30">
            <button
              onClick={handleDismiss}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-white/20 transition-colors"
            >
              <X className="h-4 w-4 text-white" />
            </button>
            
            <div className="flex items-start gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Smartphone className="h-6 w-6 text-white" />
              </div>
              
              <div className="flex-1">
                <h3 className="font-bold text-white text-lg">Install Brandastic</h3>
                
                {isIOS ? (
                  <p className="text-white/90 text-sm mt-1">
                    Tap <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                      Share
                    </span> then <span className="inline-flex items-center px-1.5 py-0.5 bg-white/20 rounded text-xs font-medium">
                      Add to Home Screen
                    </span>
                  </p>
                ) : (
                  <>
                    <p className="text-white/90 text-sm mt-1">
                      Get quick access from your home screen with offline support!
                    </p>
                    <Button
                      onClick={handleInstall}
                      className="mt-3 bg-white text-brand-orange hover:bg-white/90 font-semibold"
                      size="sm"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Install App
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
