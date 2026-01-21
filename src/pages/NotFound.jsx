import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Search, ArrowLeft, Coffee, Rocket, Ghost } from 'lucide-react'
import { Button } from '../components/ui/button'

const MESSAGES = [
  {
    title: "404: Page took a vacation 🏖️",
    subtitle: "It's probably on a beach somewhere. Can't blame it.",
  },
  {
    title: "Oops! This page is playing hide and seek 🙈",
    subtitle: "Spoiler: It's winning.",
  },
  {
    title: "404: Page not found (but we found this cool GIF) 🎬",
    subtitle: "The page you're looking for has gone to a better place.",
  },
  {
    title: "You've discovered the void! 🕳️",
    subtitle: "It's empty here. Just like my coffee cup.",
  },
  {
    title: "This page ghosted us 👻",
    subtitle: "No goodbye, no explanation. Just... gone.",
  },
]

const FLOATING_ITEMS = ['🚀', '⭐', '🌙', '☁️', '✨', '🛸']

export default function NotFound() {
  const [message] = useState(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])
  const [clicks, setClicks] = useState(0)
  const [showSecret, setShowSecret] = useState(false)

  useEffect(() => {
    if (clicks >= 5) {
      setShowSecret(true)
    }
  }, [clicks])

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-brand-purple/5 flex items-center justify-center p-8 overflow-hidden relative">
      {/* Floating decorations */}
      {FLOATING_ITEMS.map((item, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl pointer-events-none"
          style={{
            left: `${10 + (i * 15)}%`,
            top: `${20 + (i % 3) * 20}%`,
          }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            delay: i * 0.5,
          }}
        >
          {item}
        </motion.div>
      ))}

      <div className="text-center max-w-lg relative z-10">
        {/* Giant 404 */}
        <motion.div
          className="relative mb-8"
          onClick={() => setClicks(c => c + 1)}
          style={{ cursor: 'pointer' }}
        >
          <motion.h1
            className="text-[150px] font-bold leading-none bg-gradient-to-r from-brand-orange via-brand-coral to-brand-purple bg-clip-text text-transparent"
            animate={{
              scale: [1, 1.02, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            404
          </motion.h1>
          
          {/* Floating ghost */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{
              y: [-20, 20, -20],
              x: [-10, 10, -10],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
            }}
          >
            <Ghost className="h-16 w-16 text-brand-purple/30" />
          </motion.div>
        </motion.div>

        {/* Message */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold mb-3"
        >
          {message.title}
        </motion.h2>
        
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-muted-foreground mb-8"
        >
          {message.subtitle}
        </motion.p>

        {/* Secret message */}
        {showSecret && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-4 rounded-xl bg-brand-orange/10 border border-brand-orange/20"
          >
            <p className="text-sm">
              🎉 You clicked 5 times! Here's a virtual cookie: 🍪
            </p>
          </motion.div>
        )}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button asChild size="lg" className="gap-2">
            <Link to="/dashboard">
              <Home className="h-4 w-4" />
              Back to Dashboard
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg" className="gap-2">
            <Link to="/boards">
              <ArrowLeft className="h-4 w-4" />
              View Boards
            </Link>
          </Button>
        </motion.div>

        {/* Fun footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-12 text-xs text-muted-foreground/50"
        >
          If you think this is a mistake, try turning it off and on again. <br />
          Or blame the intern. (Just kidding, we love our interns ❤️)
        </motion.p>
      </div>
    </div>
  )
}
