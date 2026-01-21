import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, Square, Clock, X, Minimize2, ChevronDown, 
  Building2, FileText, Check, Zap
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { useToast } from '../hooks/useToast'

// Format seconds to HH:MM:SS
function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function FloatingTimer({ 
  isVisible,
  onClose 
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  
  const [isRunning, setIsRunning] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [startTime, setStartTime] = useState(null)
  const [minimized, setMinimized] = useState(false)
  
  // Form state
  const [description, setDescription] = useState('')
  const [selectedClient, setSelectedClient] = useState(null)
  const [showClientPicker, setShowClientPicker] = useState(false)
  const [clients, setClients] = useState([])
  const [isBillable, setIsBillable] = useState(true)
  
  const inputRef = useRef(null)

  // Load clients
  useEffect(() => {
    const loadClients = async () => {
      const { data } = await supabase
        .from('clients')
        .select('id, name, color')
        .eq('is_active', true)
        .order('name')
      if (data) setClients(data)
    }
    loadClients()
  }, [])

  // Timer tick
  useEffect(() => {
    let interval
    if (isRunning) {
      interval = setInterval(() => {
        setSeconds(s => s + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isRunning])

  // Load saved timer from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activeTimer')
    if (saved) {
      const { startTime, description, clientId, isBillable } = JSON.parse(saved)
      const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
      setStartTime(startTime)
      setSeconds(elapsed)
      setDescription(description || '')
      setIsBillable(isBillable !== false)
      setIsRunning(true)
      
      // Find and set client
      if (clientId) {
        supabase
          .from('clients')
          .select('id, name, color')
          .eq('id', clientId)
          .single()
          .then(({ data }) => {
            if (data) setSelectedClient(data)
          })
      }
    }
  }, [])

  // Start timer
  const handleStart = () => {
    if (!selectedClient) {
      toast({
        title: 'Select a client first',
        description: 'Choose which client you\'re working for',
        variant: 'destructive'
      })
      return
    }
    
    const now = new Date().toISOString()
    setStartTime(now)
    setIsRunning(true)
    setSeconds(0)
    
    // Save to localStorage
    localStorage.setItem('activeTimer', JSON.stringify({
      startTime: now,
      description,
      clientId: selectedClient?.id,
      isBillable
    }))
    
    toast({
      title: '⏱️ Timer started!',
      description: `Tracking time for ${selectedClient.name}`,
    })
  }

  // Stop timer and save
  const handleStop = async () => {
    setIsRunning(false)
    localStorage.removeItem('activeTimer')
    
    if (seconds < 60) {
      toast({
        title: 'Timer too short',
        description: 'Time entries must be at least 1 minute',
        variant: 'destructive'
      })
      setSeconds(0)
      return
    }

    // Save to database
    try {
      const { error } = await supabase.from('time_entries').insert({
        user_id: user.id,
        client_id: selectedClient?.id,
        description: description || 'No description',
        minutes: Math.round(seconds / 60),
        date: new Date().toISOString().split('T')[0],
        billable: isBillable
      })

      if (error) throw error

      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      
      toast({
        title: '✅ Time saved!',
        description: `Logged ${hours > 0 ? `${hours}h ` : ''}${mins}m for ${selectedClient?.name}`,
        variant: 'success'
      })
      
      // Reset
      setSeconds(0)
      setDescription('')
      
    } catch (error) {
      console.error('Error saving time:', error)
      toast({
        title: 'Error saving time',
        description: 'Please try again',
        variant: 'destructive'
      })
    }
  }

  // Discard timer
  const handleDiscard = () => {
    setIsRunning(false)
    setSeconds(0)
    localStorage.removeItem('activeTimer')
    toast({ title: 'Timer discarded' })
  }

  if (!isVisible && !isRunning) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.8 }}
        drag
        dragMomentum={false}
        className="fixed z-50 cursor-move bottom-6 right-6"
      >
        {minimized ? (
          // Minimized - floating button
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setMinimized(false)}
            className={cn(
              "relative h-16 w-16 rounded-full shadow-2xl flex items-center justify-center",
              isRunning 
                ? "bg-gradient-to-br from-green-500 to-emerald-600" 
                : "bg-gradient-to-br from-brand-orange to-brand-coral"
            )}
          >
            {isRunning && (
              <motion.div
                className="absolute inset-0 rounded-full bg-green-500"
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
            <Clock className="h-7 w-7 text-white relative z-10" />
            {isRunning && (
              <div className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-white text-green-600 text-[10px] font-bold shadow">
                {formatTime(seconds).slice(0, 5)}
              </div>
            )}
          </motion.button>
        ) : (
          // Expanded - Toggl-style widget
          <motion.div
            layout
            className="w-80 rounded-2xl shadow-2xl border bg-background overflow-hidden"
          >
            {/* Header */}
            <div className={cn(
              "px-4 py-3 flex items-center justify-between",
              isRunning 
                ? "bg-gradient-to-r from-green-500 to-emerald-600" 
                : "bg-gradient-to-r from-brand-orange to-brand-coral"
            )}>
              <div className="flex items-center gap-2 text-white">
                <Zap className="h-4 w-4" />
                <span className="font-semibold">
                  {isRunning ? 'Tracking...' : 'Start Timer'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setMinimized(true)}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Timer Display */}
              <div className={cn(
                "text-center py-5 rounded-xl font-mono text-4xl font-bold relative overflow-hidden",
                isRunning 
                  ? "bg-green-500/10 text-green-600" 
                  : "bg-muted text-muted-foreground"
              )}>
                {isRunning && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-green-500/20 to-green-500/10"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  />
                )}
                <span className="relative z-10">{formatTime(seconds)}</span>
              </div>

              {/* Description Input */}
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What are you working on?"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-brand-orange/50"
                  disabled={isRunning}
                />
              </div>

              {/* Client Picker */}
              <div className="relative">
                <button
                  onClick={() => !isRunning && setShowClientPicker(!showClientPicker)}
                  disabled={isRunning}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                    isRunning ? "opacity-60 cursor-not-allowed" : "hover:bg-muted/50"
                  )}
                >
                  {selectedClient ? (
                    <>
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: selectedClient.color || '#F7931E' }}
                      />
                      <span className="flex-1 font-medium">{selectedClient.name}</span>
                    </>
                  ) : (
                    <>
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-muted-foreground">Select client...</span>
                    </>
                  )}
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform",
                    showClientPicker && "rotate-180"
                  )} />
                </button>

                {/* Client Dropdown */}
                <AnimatePresence>
                  {showClientPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto"
                    >
                      {clients.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                          No clients found
                        </div>
                      ) : (
                        clients.map(client => (
                          <button
                            key={client.id}
                            onClick={() => {
                              setSelectedClient(client)
                              setShowClientPicker(false)
                            }}
                            className={cn(
                              "w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors",
                              selectedClient?.id === client.id && "bg-brand-orange/10"
                            )}
                          >
                            <div 
                              className="w-4 h-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: client.color || '#F7931E' }}
                            />
                            <span className="flex-1 text-left font-medium">{client.name}</span>
                            {selectedClient?.id === client.id && (
                              <Check className="h-4 w-4 text-brand-orange" />
                            )}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Billable Toggle */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-muted-foreground">Billable</span>
                <button
                  onClick={() => !isRunning && setIsBillable(!isBillable)}
                  disabled={isRunning}
                  className={cn(
                    "relative w-12 h-6 rounded-full transition-colors",
                    isBillable ? "bg-green-500" : "bg-muted",
                    isRunning && "opacity-60 cursor-not-allowed"
                  )}
                >
                  <motion.div
                    animate={{ x: isBillable ? 24 : 2 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                  />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {isRunning ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleDiscard}
                      className="flex-1 h-12 rounded-xl border-2 border-red-500 text-red-500 font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                    >
                      <X className="h-5 w-5" />
                      Discard
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleStop}
                      className="flex-[2] h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-500/25"
                    >
                      <Square className="h-5 w-5 fill-current" />
                      Stop & Save
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    disabled={!selectedClient}
                    className={cn(
                      "flex-1 h-12 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all shadow-lg",
                      selectedClient
                        ? "bg-green-500 hover:bg-green-600 text-white shadow-green-500/25"
                        : "bg-muted text-muted-foreground cursor-not-allowed shadow-none"
                    )}
                  >
                    <Play className="h-5 w-5 fill-current" />
                    Start Timer
                  </motion.button>
                )}
              </div>

              {/* Quick tip */}
              {!isRunning && !selectedClient && (
                <p className="text-center text-xs text-muted-foreground">
                  👆 Select a client above to start tracking
                </p>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
