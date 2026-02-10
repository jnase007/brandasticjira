import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler
 * 
 * CRITICAL: This component is the ONLY handler for OAuth callbacks.
 * AuthContext defers completely when on this route.
 * 
 * Flow:
 * 1. Parse URL for tokens/errors immediately
 * 2. Call getSession() ONCE to process tokens
 * 3. Listen for SIGNED_IN event as backup
 * 4. Navigate to dashboard on success
 * 5. Show error only after timeout or explicit error
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing sign in...')
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')
  
  // Refs to prevent double processing and track mounted state
  const processedRef = useRef(false)
  const mountedRef = useRef(true)
  const navigationRef = useRef(false)

  useEffect(() => {
    mountedRef.current = true
    
    // Log initial state
    console.log('[AuthCallback] === INIT ===')
    console.log('[AuthCallback] URL:', window.location.href)
    console.log('[AuthCallback] Hash length:', window.location.hash.length)
    
    // Parse URL immediately
    const hash = window.location.hash.substring(1)
    const hashParams = new URLSearchParams(hash)
    const searchParams = new URLSearchParams(window.location.search)
    
    // Check for OAuth errors first
    const errorCode = hashParams.get('error') || searchParams.get('error')
    const errorDesc = hashParams.get('error_description') || searchParams.get('error_description')
    
    if (errorCode) {
      console.error('[AuthCallback] OAuth error:', errorCode, errorDesc)
      setError(errorDesc || errorCode)
      setDebugInfo(`Error code: ${errorCode}`)
      return
    }
    
    // Check for tokens
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')
    const hasTokens = !!accessToken
    
    console.log('[AuthCallback] Has tokens:', hasTokens)
    if (hasTokens) {
      setDebugInfo('Processing tokens...')
    }
    
    // Helper to navigate safely (only once)
    const safeNavigate = (path) => {
      if (!navigationRef.current && mountedRef.current) {
        navigationRef.current = true
        console.log('[AuthCallback] Navigating to:', path)
        // Clean URL before navigating
        window.history.replaceState({}, document.title, path)
        navigate(path, { replace: true })
      }
    }
    
    // Set up auth listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth event:', event, session?.user?.email || 'no session')
      
      // Handle successful sign in
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
        setStatus('Success! Redirecting...')
        safeNavigate('/dashboard')
      }
    })
    
    // Process session - this is the main handler
    const processSession = async () => {
      // Prevent double processing
      if (processedRef.current) {
        console.log('[AuthCallback] Already processed, skipping')
        return
      }
      processedRef.current = true
      
      try {
        console.log('[AuthCallback] Processing session...')
        setStatus('Establishing session...')
        
        // If we have tokens, try to set session manually first
        // This is more reliable than relying on auto-detection
        if (hasTokens && accessToken) {
          console.log('[AuthCallback] Setting session from tokens...')
          
          const { data, error: setError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          })
          
          if (setError) {
            console.error('[AuthCallback] setSession error:', setError)
            // Don't fail yet - try getSession as fallback
          } else if (data?.session?.user) {
            console.log('[AuthCallback] setSession success:', data.session.user.email)
            setStatus('Success! Redirecting...')
            safeNavigate('/dashboard')
            return
          }
        }
        
        // Fallback: call getSession to check/process
        console.log('[AuthCallback] Calling getSession...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthCallback] getSession error:', sessionError)
          setDebugInfo(`Session error: ${sessionError.message}`)
        }
        
        if (session?.user) {
          console.log('[AuthCallback] Session found:', session.user.email)
          setStatus('Success! Redirecting...')
          safeNavigate('/dashboard')
          return
        }
        
        // No session yet - the auth listener might still fire
        console.log('[AuthCallback] No session yet, waiting for auth event...')
        setDebugInfo('Waiting for authentication...')
        
      } catch (err) {
        console.error('[AuthCallback] Process error:', err)
        setDebugInfo(`Error: ${err.message}`)
      }
    }
    
    // Start processing immediately (no delay needed)
    processSession()
    
    // Timeout: show error UI if nothing happens after 12 seconds
    const timeout = setTimeout(() => {
      if (mountedRef.current && !navigationRef.current) {
        console.warn('[AuthCallback] Timeout reached')
        setError('Sign in is taking too long. Please try again.')
        setDebugInfo('Timeout after 12 seconds')
      }
    }, 12000)
    
    // Cleanup
    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  // Error UI
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Sign In Issue
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {error}
          </p>
          {debugInfo && (
            <p className="text-xs text-gray-400 font-mono mb-6">
              {debugInfo}
            </p>
          )}
          <div className="space-y-3">
            <button
              onClick={() => {
                window.history.replaceState({}, document.title, '/login')
                navigate('/login', { replace: true })
              }}
              className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                // Clear all auth data and retry
                try {
                  localStorage.removeItem('brandastic-auth')
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-') || key.includes('supabase')) {
                      localStorage.removeItem(key)
                    }
                  })
                  sessionStorage.clear()
                } catch (e) {
                  console.warn('Failed to clear storage:', e)
                }
                window.location.href = '/login'
              }}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Clear Cache & Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-gray-700 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          {status}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          This should only take a moment
        </p>
        {debugInfo && (
          <p className="text-xs text-gray-400 font-mono mt-4">
            {debugInfo}
          </p>
        )}
      </div>
    </div>
  )
}
