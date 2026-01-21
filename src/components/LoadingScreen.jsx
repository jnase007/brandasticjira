import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Coffee, Rocket, Zap, Heart, Star, Flame } from 'lucide-react'

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
        {/* Brandastic Logo with animation */}
        <motion.div
          className="relative mx-auto mb-6 w-24 h-24"
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
          <div className="absolute inset-1 rounded-full bg-background" />
          
          {/* Logo container */}
          <motion.div
            className="absolute inset-2 rounded-full overflow-hidden flex items-center justify-center"
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
              className="absolute w-2 h-2"
              style={{ 
                left: '50%', 
                top: '50%',
                marginLeft: -4,
                marginTop: -4,
              }}
              animate={{
                x: Math.cos((i * Math.PI) / 2) * 50,
                y: Math.sin((i * Math.PI) / 2) * 50,
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
              <Sparkles className="w-full h-full text-brand-orange" />
            </motion.div>
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
