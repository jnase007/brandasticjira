import { useState, useEffect, useCallback } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from './contexts/AuthContext'
import { GamificationProvider } from './contexts/GamificationContext'

// Pages
import Login from './pages/Login'
import Demo from './pages/Demo'
import Dashboard from './pages/Dashboard'
import Boards from './pages/Boards'
import BoardDetail from './pages/BoardDetail'
import TicketDetail from './pages/TicketDetail'
import ClientPortal from './pages/ClientPortal'
import Settings from './pages/Settings'
import Admin from './pages/Admin'
import TeamHub from './pages/TeamHub'
import JiraImport from './pages/JiraImport'
import LeaderboardPage from './pages/LeaderboardPage'
import TimeTracking from './pages/TimeTracking'
import Reports from './pages/Reports'
import ClientManagement from './pages/ClientManagement'
import ClientDetail from './pages/ClientDetail'
import TeamMemberDetail from './pages/TeamMemberDetail'
import NotFound from './pages/NotFound'

// Components
import Sidebar from './components/Sidebar'
import LoadingScreen from './components/LoadingScreen'
import CommandPalette from './components/CommandPalette'
import FloatingTimer from './components/FloatingTimer'
import ActivityFeed from './components/ActivityFeed'
import Confetti, { useConfetti } from './components/Confetti'
import EasterEggs from './components/EasterEggs'
import { MobileTabBar, MobileHeader } from './components/MobileNav'
import { QuickActionsFAB } from './components/QuickActions'
import { ShortcutsPanel } from './components/ShortcutsPanel'
import { NotificationBell } from './components/NotificationCenter'
import { FocusModeProvider } from './components/FocusMode'

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

// Admin-only route
function AdminRoute({ children }) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      {children}
    </ProtectedRoute>
  )
}

// Main Layout with Sidebar
function MainLayout({ children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [timerVisible, setTimerVisible] = useState(false)
  const [timerInitialClient, setTimerInitialClient] = useState(null)
  const [timerInitialDescription, setTimerInitialDescription] = useState('')
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      // ? for shortcuts panel
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShortcutsOpen(true)
      }
      
      // T for timer
      if (e.key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setTimerVisible(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Function to open timer with a pre-selected client (called from boards)
  const openTimerWithClient = useCallback((client, description = '') => {
    setTimerInitialClient(client)
    setTimerInitialDescription(description)
    setTimerVisible(true)
  }, [])

  // Expose timer function globally so boards can access it
  useEffect(() => {
    window.openTimerWithClient = openTimerWithClient
    return () => {
      delete window.openTimerWithClient
    }
  }, [openTimerWithClient])

  // Handle command actions
  const handleCommandAction = useCallback((actionId) => {
    switch (actionId) {
      case 'start-timer':
        setTimerVisible(true)
        break
      case 'stop-timer':
        setTimerVisible(true)
        break
      case 'logout':
        // Handle in context
        break
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar - hidden on mobile */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onCollapse={setSidebarCollapsed}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenActivity={() => setActivityOpen(true)}
          onOpenTimer={() => setTimerVisible(true)}
        />
      </div>

      {/* Mobile Header */}
      <div className="lg:hidden">
        <MobileHeader onOpenSearch={() => setCommandPaletteOpen(true)} />
      </div>
      
      {/* Main content */}
      {/* Mobile: full width with padding for header/tab bar */}
      {/* Desktop: sidebar margin with animation */}
      <main className="min-h-screen pt-14 pb-20 lg:pt-0 lg:pb-0">
        {/* Desktop layout with sidebar margin */}
        <motion.div
          initial={false}
          animate={{ marginLeft: sidebarCollapsed ? 72 : 240 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="hidden lg:block min-h-screen"
        >
          {children}
        </motion.div>
        {/* Mobile layout - no sidebar margin */}
        <div className="lg:hidden">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar
        onOpenTimer={() => setTimerVisible(true)}
        onOpenActivity={() => setActivityOpen(true)}
      />

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

      {/* Floating Timer - Toggl-style */}
      <FloatingTimer
        isVisible={timerVisible}
        onClose={() => {
          setTimerVisible(false)
          setTimerInitialClient(null)
          setTimerInitialDescription('')
        }}
        initialClient={timerInitialClient}
        initialDescription={timerInitialDescription}
      />

      {/* Quick Actions FAB - Desktop only */}
      <QuickActionsFAB
        onStartTimer={() => setTimerVisible(true)}
        onNewTicket={() => {}} // Navigate to create ticket
        onOpenSearch={() => setCommandPaletteOpen(true)}
        onShowShortcuts={() => setShortcutsOpen(true)}
      />

      {/* Keyboard Shortcuts Panel */}
      <ShortcutsPanel
        isOpen={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  )
}

function App() {
  const { user, loading, authError, retryAuth } = useAuth()
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
    return <LoadingScreen onRetry={retryAuth} error={authError} />
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
      <EasterEggs />
      {user ? (
        <FocusModeProvider>
        <GamificationProvider>
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
              <Route
                path="/team"
                element={
                  <TeamRoute>
                    <TeamHub />
                  </TeamRoute>
                }
              />
              <Route
                path="/team/:memberId"
                element={
                  <TeamRoute>
                    <TeamMemberDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/leaderboard"
                element={
                  <TeamRoute>
                    <LeaderboardPage />
                  </TeamRoute>
                }
              />
              <Route
                path="/time"
                element={
                  <TeamRoute>
                    <TimeTracking />
                  </TeamRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <TeamRoute>
                    <Reports />
                  </TeamRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <TeamRoute>
                    <ClientManagement />
                  </TeamRoute>
                }
              />
              <Route
                path="/clients/:clientId"
                element={
                  <TeamRoute>
                    <ClientDetail />
                  </TeamRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <AdminRoute>
                    <JiraImport />
                  </AdminRoute>
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

              {/* Admin route */}
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Admin />
                  </AdminRoute>
                }
              />

              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </AnimatePresence>
          </MainLayout>
        </GamificationProvider>
        </FocusModeProvider>
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
