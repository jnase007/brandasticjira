import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * Typewriter effect component
 * Types out text character by character
 */
export default function TypeWriter({
  words = ['Welcome'],
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseDuration = 2000,
  className = '',
  cursor = true,
  cursorChar = '|',
  loop = true,
}) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [currentText, setCurrentText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const currentWord = words[currentWordIndex]

    const timeout = setTimeout(() => {
      if (isPaused) {
        setIsPaused(false)
        setIsDeleting(true)
        return
      }

      if (isDeleting) {
        setCurrentText(currentWord.substring(0, currentText.length - 1))
        if (currentText.length === 0) {
          setIsDeleting(false)
          if (loop || currentWordIndex < words.length - 1) {
            setCurrentWordIndex((prev) => (prev + 1) % words.length)
          }
        }
      } else {
        setCurrentText(currentWord.substring(0, currentText.length + 1))
        if (currentText.length === currentWord.length) {
          if (loop || currentWordIndex < words.length - 1) {
            setIsPaused(true)
          }
        }
      }
    }, isPaused ? pauseDuration : isDeleting ? deletingSpeed : typingSpeed)

    return () => clearTimeout(timeout)
  }, [currentText, isDeleting, isPaused, currentWordIndex, words, typingSpeed, deletingSpeed, pauseDuration, loop])

  return (
    <span className={className}>
      {currentText}
      {cursor && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
          className="ml-0.5"
        >
          {cursorChar}
        </motion.span>
      )}
    </span>
  )
}

/**
 * Simple fade-in text reveal
 */
export function RevealText({ text, delay = 0, className = '' }) {
  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={className}
    >
      {text}
    </motion.span>
  )
}

/**
 * Word-by-word reveal animation
 */
export function WordReveal({ text, staggerDelay = 0.08, className = '' }) {
  const words = text.split(' ')
  
  return (
    <span className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: i * staggerDelay, duration: 0.4 }}
          className="inline-block mr-[0.25em]"
        >
          {word}
        </motion.span>
      ))}
    </span>
  )
}

/**
 * Counter that animates from 0 to target
 */
export function CountUp({ 
  target, 
  duration = 2, 
  prefix = '', 
  suffix = '',
  className = '' 
}) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const steps = 60
    const increment = target / steps
    let current = 0
    const stepDuration = (duration * 1000) / steps

    const timer = setInterval(() => {
      current += increment
      if (current >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [target, duration])

  return (
    <span className={className}>
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  )
}
