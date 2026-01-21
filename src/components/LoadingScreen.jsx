import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coffee, Rocket, Zap, Heart, Star, Flame } from 'lucide-react'

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

// Bouncing letter animation
const BouncingLetter = ({ letter, index }) => (
  <motion.span
    className="inline-block font-bold"
    animate={{
      y: [0, -8, 0],
      color: ['#F7931E', '#FF6B6B', '#F7931E'],
    }}
    transition={{
      duration: 0.6,
      repeat: Infinity,
      delay: index * 0.1,
      ease: "easeInOut",
    }}
  >
    {letter}
  </motion.span>
)

export default function LoadingScreen() {
  const [messageIndex, setMessageIndex] = useState(0)
  const currentMessage = LOADING_MESSAGES[messageIndex]
  const IconComponent = currentMessage.icon

  // Rotate through messages
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-background via-background to-brand-orange/5 flex items-center justify-center overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-64 h-64 rounded-full bg-brand-orange/5"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          />
        ))}
      </div>

      <div className="relative text-center z-10">
        {/* Fun animated icon */}
        <motion.div
          className="relative mx-auto mb-6 w-20 h-20"
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-4 border-brand-orange/30"
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Inner ring (opposite direction) */}
          <motion.div
            className="absolute inset-2 rounded-full border-4 border-dashed border-brand-coral/40"
            animate={{ rotate: -360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Center "B" logo */}
          <motion.div
            className="absolute inset-4 rounded-xl bg-gradient-to-br from-brand-orange to-brand-coral flex items-center justify-center shadow-lg"
            animate={{
              scale: [1, 1.1, 1],
              boxShadow: [
                '0 4px 14px rgba(247, 147, 30, 0.3)',
                '0 8px 25px rgba(247, 147, 30, 0.5)',
                '0 4px 14px rgba(247, 147, 30, 0.3)',
              ],
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <span className="text-white font-bold text-xl">B</span>
          </motion.div>

          {/* Orbiting dots */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-brand-orange"
              style={{ left: '50%', top: '50%' }}
              animate={{
                x: [0, 40, 0, -40, 0].map(v => v * Math.cos((i * 2 * Math.PI) / 3 + Math.PI / 6)),
                y: [0, 40, 0, -40, 0].map(v => v * Math.sin((i * 2 * Math.PI) / 3 + Math.PI / 6)),
                scale: [0.8, 1.2, 0.8],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: i * 0.3,
                ease: "easeInOut",
              }}
            />
          ))}
        </motion.div>

        {/* Bouncing "Brandastic" text */}
        <div className="text-2xl mb-4">
          {"Brandastic".split('').map((letter, i) => (
            <BouncingLetter key={i} letter={letter} index={i} />
          ))}
        </div>

        {/* Rotating message with icon */}
        <AnimatePresence mode="wait">
          <motion.div
            key={messageIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex items-center justify-center gap-2 text-muted-foreground"
          >
            <motion.div
              animate={{ 
                rotate: [0, 15, -15, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{ duration: 0.5 }}
            >
              <IconComponent className="h-4 w-4 text-brand-orange" />
            </motion.div>
            <span className="text-sm">{currentMessage.text}</span>
          </motion.div>
        </AnimatePresence>

        {/* Fun progress bar */}
        <div className="mt-6 w-48 mx-auto">
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
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

        {/* Tiny footer joke */}
        <motion.p
          className="mt-8 text-[10px] text-muted-foreground/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
        >
          (If this takes too long, try turning it off and on again 😉)
        </motion.p>
      </div>
    </div>
  )
}
