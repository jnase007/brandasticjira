import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coffee, Rocket, Zap, Heart, Star, Flame, RefreshCw, Cloud } from 'lucide-react'

// Brandastic Logo Mark
const LOGO_MARK = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Logo-1024x1024.png'

// Fun loading messages that rotate
const LOADING_MESSAGES = [
  { text: "Brewing creativity...", icon: Coffee },
  { text: "Polishing pixels...", icon: Sparkles },
  { text: "Launching rockets...", icon: Rocket },
  { text: "Charging superpowers...", icon: Zap },
  { text: "Spreading love...", icon: Heart },
  { text: "Aligning stars...", icon: Star },
  { text: "Getting fired up...", icon: Flame },
  { text: "Making magic happen...", icon: Sparkles },
  { text: "Caffeinating the team...", icon: Coffee },
  { text: "Chasing deadlines...", icon: Rocket },
]

// Flying rocket that goes across the whole screen
const FlyingRocket = ({ startX, startY, size, delay, duration, angle }) => (
  <motion.div
    className="absolute text-brand-orange"
    style={{
      left: `${startX}%`,
      top: `${startY}%`,
      fontSize: size,
    }}
    initial={{ 
      opacity: 0, 
      x: 0, 
      y: 0,
      rotate: angle - 45, // Rockets point up-right
    }}
    animate={{
      opacity: [0, 1, 1, 1, 0],
      x: [0, 150, 350, 500],
      y: [0, -100, -250, -400],
    }}
    transition={{
      duration: duration,
      repeat: Infinity,
      delay,
      ease: "easeOut",
    }}
  >
    <Rocket className="drop-shadow-lg" style={{ width: size, height: size }} />
  </motion.div>
)

// Floating cloud
const FloatingCloud = ({ x, y, size, delay, opacity }) => (
  <motion.div
    className="absolute text-white/10 dark:text-white/5"
    style={{ left: `${x}%`, top: `${y}%` }}
    animate={{
      x: [0, 30, 0],
      opacity: [opacity * 0.5, opacity, opacity * 0.5],
    }}
    transition={{
      duration: 8 + delay,
      repeat: Infinity,
      ease: "easeInOut",
    }}
  >
    <Cloud style={{ width: size, height: size }} />
  </motion.div>
)

export default function LoadingScreen({ onRetry, error }) {
  const [messageIndex, setMessageIndex] = useState(0)
  const [showRefresh, setShowRefresh] = useState(false)
  const currentMessage = LOADING_MESSAGES[messageIndex]
  const IconComponent = currentMessage.icon

  // Rotate through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Show refresh button after 2 seconds (faster for better UX)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowRefresh(true)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [])

  // Handle refresh
  const handleRefresh = () => {
    if (onRetry) {
      onRetry()
    } else {
      window.location.reload()
    }
  }

  // Generate rocket configurations for variety
  const rockets = [
    // Left side rockets
    { startX: -5, startY: 90, size: 48, delay: 0, duration: 4, angle: 45 },
    { startX: 5, startY: 70, size: 36, delay: 1.2, duration: 3.5, angle: 50 },
    { startX: -10, startY: 50, size: 56, delay: 2.5, duration: 4.5, angle: 40 },
    { startX: 10, startY: 85, size: 32, delay: 0.8, duration: 3, angle: 55 },
    // Middle rockets
    { startX: 25, startY: 95, size: 44, delay: 1.5, duration: 4, angle: 45 },
    { startX: 35, startY: 80, size: 40, delay: 3, duration: 3.8, angle: 48 },
    { startX: 45, startY: 100, size: 52, delay: 0.5, duration: 4.2, angle: 42 },
    // Right side rockets
    { startX: 55, startY: 75, size: 38, delay: 2, duration: 3.5, angle: 50 },
    { startX: 65, startY: 90, size: 50, delay: 1, duration: 4, angle: 45 },
    { startX: 75, startY: 85, size: 34, delay: 2.8, duration: 3.2, angle: 52 },
    { startX: 85, startY: 95, size: 46, delay: 0.3, duration: 4.3, angle: 43 },
    { startX: 90, startY: 70, size: 42, delay: 1.8, duration: 3.7, angle: 47 },
  ]

  // Cloud configurations
  const clouds = [
    { x: 5, y: 10, size: 120, delay: 0, opacity: 0.4 },
    { x: 25, y: 25, size: 180, delay: 2, opacity: 0.3 },
    { x: 60, y: 8, size: 150, delay: 1, opacity: 0.35 },
    { x: 80, y: 30, size: 130, delay: 3, opacity: 0.25 },
    { x: 15, y: 50, size: 100, delay: 1.5, opacity: 0.2 },
    { x: 70, y: 55, size: 140, delay: 2.5, opacity: 0.3 },
    { x: 40, y: 15, size: 160, delay: 0.5, opacity: 0.35 },
    { x: 90, y: 60, size: 110, delay: 3.5, opacity: 0.25 },
  ]

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-sky-400 via-sky-300 to-sky-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-700 flex items-center justify-center overflow-hidden">
      {/* Clouds layer */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {clouds.map((cloud, i) => (
          <FloatingCloud key={`cloud-${i}`} {...cloud} />
        ))}
      </div>

      {/* Rockets layer - all over the page */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {rockets.map((rocket, i) => (
          <FlyingRocket key={`rocket-${i}`} {...rocket} />
        ))}
      </div>

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent dark:from-black/20 pointer-events-none" />

      <div className="relative text-center z-10">
        {/* Brandastic Logo with animation */}
        <motion.div
          className="relative mx-auto mb-6 w-28 h-28"
        >
          {/* Outer glowing ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'conic-gradient(from 0deg, #F7931E, #FF6B6B, #6C5CE7, #4ECDC4, #F7931E)',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Inner white/dark circle */}
          <div className="absolute inset-1 rounded-full bg-white dark:bg-slate-900 shadow-2xl" />
          
          {/* Logo container */}
          <motion.div
            className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.img
              src={LOGO_MARK}
              alt="Brandastic"
              className="w-full h-full object-contain p-1"
              animate={{
                filter: [
                  'drop-shadow(0 0 8px rgba(247, 147, 30, 0.3))',
                  'drop-shadow(0 0 20px rgba(247, 147, 30, 0.6))',
                  'drop-shadow(0 0 8px rgba(247, 147, 30, 0.3))',
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </motion.div>

          {/* Orbiting sparkles */}
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              className="absolute w-3 h-3"
              style={{ 
                left: '50%', 
                top: '50%',
                marginLeft: -6,
                marginTop: -6,
              }}
              animate={{
                x: Math.cos((i * Math.PI) / 2) * 60,
                y: Math.sin((i * Math.PI) / 2) * 60,
                opacity: [0.4, 1, 0.4],
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.25,
                ease: "easeInOut",
              }}
            >
              <Sparkles className="w-full h-full text-brand-orange drop-shadow-lg" />
            </motion.div>
          ))}
        </motion.div>

        {/* Card container for text */}
        <motion.div
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Rotating message with icon */}
          <AnimatePresence mode="wait">
            <motion.div
              key={messageIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-300"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 15, -15, 0],
                  scale: [1, 1.2, 1],
                }}
                transition={{ duration: 0.5 }}
              >
                <IconComponent className="h-5 w-5 text-brand-orange" />
              </motion.div>
              <span className="text-base font-medium">{currentMessage.text}</span>
            </motion.div>
          </AnimatePresence>

          {/* Fun progress bar */}
          <div className="mt-4 w-56 mx-auto">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-brand-orange via-brand-coral to-brand-orange"
                animate={{
                  x: ['-100%', '100%'],
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ width: '50%' }}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <motion.p
              className="mt-4 text-sm text-red-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Oops! {error}
            </motion.p>
          )}

          {/* Refresh button - appears after timeout */}
          <AnimatePresence>
            {showRefresh && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-5"
              >
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-medium text-white bg-brand-orange hover:bg-brand-orange/90 rounded-xl transition-colors shadow-lg shadow-brand-orange/25 active:scale-95"
                >
                  <RefreshCw className="h-5 w-5 flex-shrink-0" strokeWidth={2.5} />
                  <span>Refresh & Try Again</span>
                </button>
                <p className="mt-3 text-xs text-slate-400">
                  Taking too long? Click to reload!
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Tiny footer joke - only show when not showing refresh */}
        {!showRefresh && (
          <motion.p
            className="mt-6 text-[11px] text-white/60 dark:text-slate-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
          >
            🚀 Rockets launching across the sky...
          </motion.p>
        )}
      </div>
    </div>
  )
}
