import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CONFETTI_COLORS = ['#F7931E', '#00AEEF', '#8B5CF6', '#EC4899', '#10B981', '#FBBF24']

function ConfettiPiece({ x, delay, color }) {
  const randomRotation = Math.random() * 360
  const randomScale = 0.5 + Math.random() * 0.5
  const randomX = (Math.random() - 0.5) * 200

  return (
    <motion.div
      initial={{ 
        x: x, 
        y: -20, 
        rotate: 0, 
        scale: 0,
        opacity: 1 
      }}
      animate={{ 
        x: x + randomX, 
        y: window.innerHeight + 100, 
        rotate: randomRotation + 720,
        scale: randomScale,
        opacity: [1, 1, 0]
      }}
      transition={{ 
        duration: 3 + Math.random() * 2,
        delay: delay,
        ease: [0.23, 1, 0.32, 1]
      }}
      className="fixed top-0 z-[100] pointer-events-none"
      style={{
        width: 10 + Math.random() * 10,
        height: 10 + Math.random() * 10,
        backgroundColor: color,
        borderRadius: Math.random() > 0.5 ? '50%' : '2px',
      }}
    />
  )
}

export default function Confetti({ trigger, duration = 3000 }) {
  const [pieces, setPieces] = useState([])
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (trigger && !active) {
      setActive(true)
      
      // Generate confetti pieces
      const newPieces = []
      const count = 100
      
      for (let i = 0; i < count; i++) {
        newPieces.push({
          id: i,
          x: Math.random() * window.innerWidth,
          delay: Math.random() * 0.5,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
        })
      }
      
      setPieces(newPieces)

      // Clear after duration
      setTimeout(() => {
        setActive(false)
        setPieces([])
      }, duration)
    }
  }, [trigger, active, duration])

  return (
    <AnimatePresence>
      {active && pieces.map(piece => (
        <ConfettiPiece 
          key={piece.id}
          x={piece.x}
          delay={piece.delay}
          color={piece.color}
        />
      ))}
    </AnimatePresence>
  )
}

// Hook for triggering confetti
export function useConfetti() {
  const [trigger, setTrigger] = useState(false)

  const fire = () => {
    setTrigger(true)
    setTimeout(() => setTrigger(false), 100)
  }

  return { trigger, fire }
}
