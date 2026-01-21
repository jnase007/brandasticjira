import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from './Confetti'

// Konami Code: ↑ ↑ ↓ ↓ ← → ← → B A
const KONAMI_CODE = [
  'ArrowUp', 'ArrowUp', 
  'ArrowDown', 'ArrowDown', 
  'ArrowLeft', 'ArrowRight', 
  'ArrowLeft', 'ArrowRight', 
  'KeyB', 'KeyA'
]

// Fun messages when easter egg is triggered
const EASTER_EGG_MESSAGES = [
  { emoji: '🦄', message: "You found the unicorn! You're magical!" },
  { emoji: '🎮', message: "KONAMI CODE ACTIVATED! +30 lives!" },
  { emoji: '🚀', message: "Secret mode: ULTRA PRODUCTIVITY!" },
  { emoji: '🎉', message: "PARTY MODE ENGAGED!" },
  { emoji: '🌈', message: "You unlocked the rainbow!" },
]

export default function EasterEggs() {
  const [sequence, setSequence] = useState([])
  const [triggered, setTriggered] = useState(false)
  const [message, setMessage] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)

  const handleKeyDown = useCallback((e) => {
    const newSequence = [...sequence, e.code].slice(-10)
    setSequence(newSequence)

    // Check if Konami code was entered
    if (newSequence.join(',') === KONAMI_CODE.join(',')) {
      setTriggered(true)
      setMessage(EASTER_EGG_MESSAGES[Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)])
      setShowConfetti(true)
      setSequence([])
      
      // Reset after animation
      setTimeout(() => {
        setTriggered(false)
        setShowConfetti(false)
      }, 5000)
    }
  }, [sequence])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Click counter easter egg (click logo 7 times)
  const [clickCount, setClickCount] = useState(0)
  
  useEffect(() => {
    const handleLogoClick = () => {
      setClickCount(prev => prev + 1)
    }

    // Find logo elements and attach listener
    const logos = document.querySelectorAll('[data-logo]')
    logos.forEach(logo => logo.addEventListener('click', handleLogoClick))

    return () => {
      logos.forEach(logo => logo.removeEventListener('click', handleLogoClick))
    }
  }, [])

  useEffect(() => {
    if (clickCount >= 7) {
      setTriggered(true)
      setMessage({ emoji: '🤫', message: "Shhh... you found the secret click!" })
      setShowConfetti(true)
      setClickCount(0)
      
      setTimeout(() => {
        setTriggered(false)
        setShowConfetti(false)
      }, 5000)
    }
  }, [clickCount])

  return (
    <>
      {showConfetti && <Confetti trigger={showConfetti} />}
      
      <AnimatePresence>
        {triggered && message && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: -100 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -100 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] pointer-events-none"
          >
            <div className="bg-gradient-to-r from-brand-purple via-brand-orange to-brand-coral p-1 rounded-2xl shadow-2xl">
              <div className="bg-background rounded-xl px-8 py-6 text-center">
                <motion.div
                  animate={{ 
                    rotate: [0, 20, -20, 0],
                    scale: [1, 1.2, 1],
                  }}
                  transition={{ duration: 0.5 }}
                  className="text-6xl mb-4"
                >
                  {message.emoji}
                </motion.div>
                <p className="text-xl font-bold">{message.message}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
