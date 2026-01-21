import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'

// Pages
import Login from './pages/Login'
import Demo from './pages/Demo'
import Dashboard from './pages/Dashboard'
import Boards from './pages/Boards'
import BoardDetail from './pages/BoardDetail'
import TicketDetail from './pages/TicketDetail'
import ClientPortal from './pages/ClientPortal'
import Settings from './pages/Settings'

// Components
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import CommandPalette from './components/CommandPalette'
import FloatingTimer from './components/FloatingTimer'
import ActivityFeed from './components/ActivityFeed'
import Confetti, { useConfetti } from './components/Confetti'

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles = ['team', 'admin', 'client'] }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (profile && !allowedRoles.includes(profile.role)) {
    // Redirect clients to their portal
    if (profile.role === 'client') {
      return <Navigate to="/portal" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return children
}

// Team-only route
function TeamRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['team', 'admin']}>
      {children}
    </ProtectedRoute>
  )
}

// Client-only route
function ClientRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['client']}>
      {children}
    </ProtectedRoute>
  )
}

// Main Layout with Sidebar
function MainLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [timerState, setTimerState] = useState({
    isRunning: false,
    startTime: null,
    ticketId: null,
    ticketTitle: null,
    showWidget: false
  })

  // Handle command actions
  const handleCommandAction = useCallback((actionId) => {
    switch (actionId) {
      case 'start-timer':
        setTimerState(prev => ({
          ...prev,
          isRunning: true,
          startTime: new Date().toISOString(),
          showWidget: true
        }))
        break
      case 'stop-timer':
        setTimerState(prev => ({
          ...prev,
          isRunning: false,
          startTime: null,
          showWidget: true
        }))
        break
      case 'logout':
        // Handle in context
        break
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapse={setSidebarCollapsed}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenActivity={() => setActivityOpen(true)}
        onOpenTimer={() => setTimerState(prev => ({ ...prev, showWidget: true }))}
      />
      
      {/* Main content */}
      <motion.main
        initial={false}
        animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
        transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        className="min-h-screen"
      >
        {children}
      </motion.main>

      {/* Command Palette */}
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onAction={handleCommandAction}
      />

      {/* Activity Feed */}
      <ActivityFeed
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
      />

      {/* Floating Timer */}
      {timerState.showWidget && (
        <FloatingTimer
          isRunning={timerState.isRunning}
          startTime={timerState.startTime}
          ticketId={timerState.ticketId}
          ticketTitle={timerState.ticketTitle}
          onStart={() => setTimerState(prev => ({
            ...prev,
            isRunning: true,
            startTime: new Date().toISOString()
          }))}
          onStop={() => setTimerState(prev => ({
            ...prev,
            isRunning: false,
            startTime: null
          }))}
          onClose={() => setTimerState(prev => ({ ...prev, showWidget: false }))}
        />
      )}
    </div>
  )
}

function App() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const { trigger: confettiTrigger, fire: fireConfetti } = useConfetti()
  const [isDark, setIsDark] = useState(false)

  // Initialize theme from localStorage - default to LIGHT mode
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    // Only enable dark mode if explicitly set to 'dark' in localStorage
    const shouldBeDark = stored === 'dark'
    
    setIsDark(shouldBeDark)
    if (shouldBeDark) {
      document.documentElement.classList.add('dark')
    } else {
      // Ensure we're in light mode by default
      document.documentElement.classList.remove('dark')
    }
  }, [])

  // Toggle dark mode
  const toggleDarkMode = useCallback(() => {
    setIsDark(prev => {
      const next = !prev
      if (next) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
      return next
    })
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Theme toggle: Cmd/Ctrl + Shift + D
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault()
        toggleDarkMode()
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [toggleDarkMode])

  if (loading) {
    return <LoadingScreen />
  }

  // Confetti component
  const confetti = <Confetti trigger={confettiTrigger} />

  // Public routes (Login, Demo) - no sidebar
  if (!user && (location.pathname === '/login' || location.pathname === '/demo')) {
    return (
      <div className="min-h-screen bg-background">
        {confetti}
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<Login />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
      </div>
    )
  }

  // Demo page - no auth required but with sidebar experience
  if (location.pathname === '/demo') {
    return (
      <div className="min-h-screen bg-background">
        {confetti}
        <Demo />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {confetti}
      {user ? (
        <MainLayout>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              {/* Team routes */}
              <Route
                path="/dashboard"
                element={
                  <TeamRoute>
                    <Dashboard onConfetti={fireConfetti} />
                  </TeamRoute>
                }
              />
              <Route
                path="/boards"
                element={
                  <TeamRoute>
                    <Boards />
                  </TeamRoute>
                }
              />
              <Route
                path="/boards/:boardId"
                element={
                  <TeamRoute>
                    <BoardDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/tickets/:ticketId"
                element={
                  <TeamRoute>
                    <TicketDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <TeamRoute>
                    <Settings />
                  </TeamRoute>
                }
              />

              {/* Client portal route */}
              <Route
                path="/portal"
                element={
                  <ClientRoute>
                    <ClientPortal />
                  </ClientRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>
        </MainLayout>
      ) : (
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/login" element={<Login />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AnimatePresence>
      )}
    </div>
  )
}

export default App
