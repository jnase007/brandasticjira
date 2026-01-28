import React, { Component } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from './components/ui/toaster'
import './index.css'

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered:', registration.scope)
      })
      .catch((error) => {
        console.log('SW registration failed:', error)
      })
  })
}

// Global Error Boundary to catch any crashes
class GlobalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('App crashed:', error, errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white'
        }}>
          <div style={{ maxWidth: '600px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>😅 Oops! Something went wrong</h1>
            <p style={{ color: '#aaa', marginBottom: '1.5rem' }}>
              The app crashed. Here's what happened:
            </p>
            <div style={{
              background: 'rgba(255,0,0,0.1)',
              border: '1px solid rgba(255,0,0,0.3)',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'left',
              fontSize: '0.875rem',
              marginBottom: '1.5rem',
              overflowX: 'auto'
            }}>
              <code style={{ color: '#ff6b6b' }}>
                {this.state.error?.toString()}
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#F7931E',
                color: 'white',
                border: 'none',
                padding: '0.75rem 2rem',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              🔄 Refresh Page
            </button>
            <p style={{ color: '#666', marginTop: '1rem', fontSize: '0.75rem' }}>
              If this keeps happening, check the browser console for more details.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <Toaster />
        </AuthProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </React.StrictMode>,
)
