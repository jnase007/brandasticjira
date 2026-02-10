import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - Manual Token Processing
 * 
 * Based on Grok's recommendation:
 * - detectSessionInUrl is DISABLED in supabase client
 * - We manually parse hash tokens and call setSession()
 * - This avoids AbortController race conditions
 * - AuthContext's onAuthStateChange handles state updates
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing sign in...')
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')
  
  const processedRef = useRef(false)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    
    const processOAuthCallback = async () => {
      // Prevent double processing
      if (processedRef.current) {
        console.log('[AuthCallback] Already processed, skipping')
        return
      }
      processedRef.current = true
      
      console.log('[AuthCallback] === Processing OAuth Callback ===')
      console.log('[AuthCallback] URL:', window.location.href)
      
      // Parse hash tokens
      const hash = window.location.hash.substring(1)
      const hashParams = new URLSearchParams(hash)
      const searchParams = new URLSearchParams(window.location.search)
      
      // Check for OAuth errors first
      const errorCode = hashParams.get('error') || searchParams.get('error')
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description')
      
      if (errorCode) {
        console.error('[AuthCallback] OAuth error:', errorCode, errorDesc)
        setError(errorDesc || errorCode || 'Authentication failed')
        return
      }
      
      // Extract tokens
      const access_token = hashParams.get('access_token')
      const refresh_token = hashParams.get('refresh_token')
      const expires_in = hashParams.get('expires_in')
      const token_type = hashParams.get('token_type')
      
      console.log('[AuthCallback] Tokens found:', {
        hasAccessToken: !!access_token,
        hasRefreshToken: !!refresh_token,
        expiresIn: expires_in,
        tokenType: token_type
      })
      
      if (!access_token) {
        // No tokens in URL - check if we already have a session
        console.log('[AuthCallback] No tokens in URL, checking existing session...')
        setDebugInfo('Checking session...')
        
        try {
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('[AuthCallback] getSession error:', sessionError)
            setError('Failed to verify session')
            return
          }
          
          if (session?.user) {
            console.log('[AuthCallback] Existing session found:', session.user.email)
            if (mountedRef.current) {
              navigate('/dashboard', { replace: true })
            }
            return
          }
          
          // No session, no tokens - redirect to login
          console.log('[AuthCallback] No session or tokens, redirecting to login')
          setError('No authentication data received')
        } catch (err) {
          console.error('[AuthCallback] Session check failed:', err)
          setError('Session verification failed')
        }
        return
      }
      
      // We have tokens - clear any stale auth data first
      console.log('[AuthCallback] Clearing stale auth data...')
      setDebugInfo('Preparing session...')
      
      try {
        // Clear existing storage to prevent conflicts
        localStorage.removeItem('brandastic-auth')
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('sb-') || key.includes('supabase')) {
            localStorage.removeItem(key)
          }
        })
      } catch (e) {
        console.warn('[AuthCallback] Failed to clear storage:', e)
      }
      
      // Set the session manually
      console.log('[AuthCallback] Setting session with tokens...')
      setStatus('Establishing session...')
      setDebugInfo('Setting session...')
      
      try {
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || ''
        })
        
        if (setSessionError) {
          console.error('[AuthCallback] setSession error:', setSessionError)
          setError(setSessionError.message || 'Failed to establish session')
          setDebugInfo(`Error: ${setSessionError.message}`)
          return
        }
        
        if (!data?.session?.user) {
          console.error('[AuthCallback] setSession returned no session')
          setError('Session creation failed')
          return
        }
        
        console.log('[AuthCallback] Session established:', data.session.user.email)
        setStatus('Success! Redirecting...')
        setDebugInfo(`Logged in as ${data.session.user.email}`)
        
        // Clean hash from URL and navigate
        window.history.replaceState({}, document.title, '/dashboard')
        
        if (mountedRef.current) {
          // Small delay to let AuthContext's onAuthStateChange process
          setTimeout(() => {
            if (mountedRef.current) {
              navigate('/dashboard', { replace: true })
            }
          }, 100)
        }
        
      } catch (err) {
        console.error('[AuthCallback] setSession exception:', err)
        setError(err.message || 'An unexpected error occurred')
        setDebugInfo(`Exception: ${err.message}`)
      }
    }
    
    // Process immediately
    processOAuthCallback()
    
    // Timeout fallback
    const timeout = setTimeout(() => {
      if (mountedRef.current && !error) {
        console.warn('[AuthCallback] Timeout reached')
        setError('Sign in is taking too long. Please try again.')
      }
    }, 15000)
    
    return () => {
      mountedRef.current = false
      clearTimeout(timeout)
    }
  }, [navigate, error])

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
                window.location.href = '/login'
              }}
              className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                try {
                  localStorage.clear()
                  sessionStorage.clear()
                  if ('caches' in window) {
                    caches.keys().then(keys => keys.forEach(key => caches.delete(key)))
                  }
                } catch (e) {}
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
