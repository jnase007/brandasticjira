import { useState, useEffect, createContext, useContext, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Focus, X, Timer, Volume2, VolumeX, Maximize, Minimize, Music, ChevronDown, Radio } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { useToast } from '../hooks/useToast'

// Music tracks - Supabase storage URLs (loops until user changes)
const MUSIC_STORAGE_BASE = 'https://auth.brandastic.co/storage/v1/object/public/Music'
const MUSIC_TRACKS = [
  { id: 'lofi', name: 'Lo-Fi Beats', emoji: '🎧', file: 'Lo-Fi%20Beats.wav', color: 'from-purple-500 to-pink-500' },
  { id: 'chill', name: 'Chill Vibes', emoji: '🌊', file: 'Chill%20Vibes.wav', color: 'from-cyan-500 to-blue-500' },
  { id: 'jazz', name: 'Jazz & Coffee', emoji: '☕', file: 'Jazz%20Coffee.wav', color: 'from-amber-500 to-orange-500' },
  { id: 'nature', name: 'Nature Sounds', emoji: '🌲', file: 'Nature%20Sounds.wav', color: 'from-green-500 to-emerald-500' },
  { id: 'classical', name: 'Classical Focus', emoji: '🎻', file: 'Classical%20Focus.wav', color: 'from-rose-500 to-red-500' },
  { id: 'country', name: 'Country', emoji: '🤠', file: 'Country.wav', color: 'from-yellow-500 to-amber-500' },
  { id: 'none', name: 'No Music', emoji: '🔇', file: null, color: 'from-gray-400 to-gray-500' },
]

// Focus Mode Context
const FocusModeContext = createContext({
  isFocusMode: false,
  toggleFocusMode: () => {},
  focusTask: null,
  setFocusTask: () => {},
})

export function useFocusMode() {
  return useContext(FocusModeContext)
}

export function FocusModeProvider({ children }) {
  const [isFocusMode, setIsFocusMode] = useState(false)
  const [focusTask, setFocusTask] = useState(null)
  const { toast } = useToast()

  const toggleFocusMode = (task = null) => {
    const newState = !isFocusMode
    setIsFocusMode(newState)
    setFocusTask(task)
    
    if (newState) {
      toast({
        title: '🧘 Focus Mode Activated',
        description: 'Distractions hidden. Time to crush it!',
      })
      
      // Add class to body for CSS targeting
      document.body.classList.add('focus-mode')
    } else {
      document.body.classList.remove('focus-mode')
      toast({
        title: 'Focus Mode Off',
        description: 'Welcome back to the full experience!',
      })
    }
  }

  // Keyboard shortcut: F to toggle focus mode
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) {
        toggleFocusMode()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFocusMode])

  return (
    <FocusModeContext.Provider value={{ isFocusMode, toggleFocusMode, focusTask, setFocusTask }}>
      {children}
      
      {/* Focus Mode Overlay */}
      <AnimatePresence>
        {isFocusMode && (
          <FocusModeOverlay onExit={() => toggleFocusMode()} task={focusTask} />
        )}
      </AnimatePresence>
    </FocusModeContext.Provider>
  )
}

function FocusModeOverlay({ onExit, task }) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [selectedMusic, setSelectedMusic] = useState(() => {
    // Restore last selected music from localStorage
    const saved = localStorage.getItem('focusMusic')
    return saved ? MUSIC_TRACKS.find(m => m.id === saved) || MUSIC_TRACKS[0] : MUSIC_TRACKS[0]
  })
  const [isMuted, setIsMuted] = useState(false)
  const [showMusicPicker, setShowMusicPicker] = useState(false)
  const [isPlaying, setIsPlaying] = useState(true)
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('focusVolume')
    return saved ? parseFloat(saved) : 0.5
  })
  const audioRef = useRef(null)

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [])

  // Save music preference
  useEffect(() => {
    localStorage.setItem('focusMusic', selectedMusic.id)
  }, [selectedMusic])

  // Save volume preference
  useEffect(() => {
    localStorage.setItem('focusVolume', volume.toString())
  }, [volume])

  // Handle audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
      if (isMuted) {
        audioRef.current.pause()
      } else if (isPlaying && selectedMusic.file) {
        audioRef.current.play().catch(() => {
          // Autoplay may be blocked, user needs to interact
        })
      }
    }
  }, [isMuted, isPlaying, volume, selectedMusic])

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const currentTrack = selectedMusic
  const audioUrl = currentTrack.file ? `${MUSIC_STORAGE_BASE}/${currentTrack.file}` : null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-background"
    >
      {/* HTML5 Audio Player - Loops until changed */}
      {audioUrl && !isMuted && (
        <audio
          ref={audioRef}
          src={audioUrl}
          loop
          autoPlay
          className="hidden"
        />
      )}

      {/* Minimal Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-brand-orange/10">
            <Focus className="h-5 w-5 text-brand-orange" />
          </div>
          <div>
            <p className="font-semibold">Focus Mode</p>
            <p className="text-sm text-muted-foreground">Stay in the zone</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Music Selector */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMusicPicker(!showMusicPicker)}
              className="gap-2"
            >
              <Music className="h-4 w-4" />
              <span className="hidden sm:inline">{currentTrack.emoji} {currentTrack.name}</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", showMusicPicker && "rotate-180")} />
            </Button>
            
            {/* Music Picker Dropdown */}
            <AnimatePresence>
              {showMusicPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-background shadow-xl p-2 z-50"
                >
                  <p className="text-xs text-muted-foreground px-2 py-1 mb-1">Choose your vibe</p>
                  {MUSIC_TRACKS.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        setSelectedMusic(track)
                        setShowMusicPicker(false)
                        setIsPlaying(track.file !== null)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors",
                        currentTrack.id === track.id 
                          ? "bg-brand-orange/10 text-brand-orange" 
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="text-xl">{track.emoji}</span>
                      <span className="font-medium">{track.name}</span>
                      {currentTrack.id === track.id && isPlaying && track.file && (
                        <Radio className="h-4 w-4 ml-auto animate-pulse text-green-500" />
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className={cn("opacity-50 hover:opacity-100", isMuted && "text-red-500 opacity-100")}
          >
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            onClick={onExit}
          >
            <X className="h-4 w-4 mr-2" />
            Exit Focus
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="h-full flex flex-col items-center justify-center px-4">
        {/* Now Playing Indicator */}
        {currentTrack.file && isPlaying && !isMuted && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 px-4 py-2 rounded-full bg-muted/50"
          >
            <div className="flex items-center gap-1">
              <span className="w-1 h-3 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-4 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-2 bg-green-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-sm text-muted-foreground">
              {currentTrack.emoji} {currentTrack.name}
            </span>
            {/* Volume Slider */}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-20 h-1 accent-green-500 cursor-pointer"
            />
          </motion.div>
        )}

        {/* Timer */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <div className="text-8xl font-mono font-bold text-center bg-gradient-to-r from-brand-orange to-brand-coral bg-clip-text text-transparent">
            {formatTime(elapsedTime)}
          </div>
          <p className="text-center text-muted-foreground mt-2">
            Time in focus
          </p>
        </motion.div>

        {/* Task */}
        {task && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="max-w-md text-center"
          >
            <p className="text-sm text-muted-foreground mb-2">Currently working on</p>
            <h2 className="text-2xl font-bold">{task.title}</h2>
            {task.client && (
              <p className="text-muted-foreground mt-1">{task.client}</p>
            )}
          </motion.div>
        )}

        {/* Breathing Exercise Hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-0 right-0 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">F</kbd> to exit focus mode
          </p>
        </motion.div>
      </div>

      {/* Ambient Animation */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.03, 0.06, 0.03],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-brand-orange blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.03, 0.06, 0.03],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 4,
          }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-brand-blue blur-3xl"
        />
      </div>
    </motion.div>
  )
}

// Simple focus mode toggle button
export function FocusModeToggle() {
  const { isFocusMode, toggleFocusMode } = useFocusMode()
  
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => toggleFocusMode()}
      className={cn(
        "gap-2",
        isFocusMode && "bg-brand-orange/10 text-brand-orange"
      )}
    >
      <Focus className="h-4 w-4" />
      <span className="hidden sm:inline">Focus</span>
    </Button>
  )
}

export default FocusModeProvider
