import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
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
import Navbar from './components/Navbar'
import LoadingScreen from './components/LoadingScreen'

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

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  return (
    <div className="min-h-screen bg-background">
      {user && <Navbar />}
      
      <AnimatePresence mode="wait">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={user ? <Navigate to="/dashboard" replace /> : <Login />} 
          />
          <Route path="/demo" element={<Demo />} />

          {/* Team routes */}
          <Route
            path="/dashboard"
            element={
              <TeamRoute>
                <Dashboard />
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
    </div>
  )
}

export default App
