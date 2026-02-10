import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - Grok's Recommended Implementation
 * 
 * Key points:
 * - detectSessionInUrl is DISABLED in client
 * - This is the ONLY place that touches the hash
 * - Manual parsing + setSession() + getSession() verification
 * - Timeout fallback with retry
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const processed = useRef(false)
  const [status, setStatus] = useState('Completing Google login...')
  const [error, setError] = useState(null)

  useEffect(() => {
    // Prevent double processing (React strict mode)
    if (processed.current) return
    processed.current = true

    let timeoutId = null

    const processTokens = async () => {
      try {
        const hash = window.location.hash.substring(1)
        
        console.log('[AuthCallback] Processing callback...')
        console.log('[AuthCallback] Hash length:', hash.length)
        
        if (!hash) {
          console.warn('[AuthCallback] No hash found on callback')
          // Check if we already have a session
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('[AuthCallback] Existing session found, redirecting...')
            navigate('/dashboard', { replace: true })
            return
          }
          navigate('/login')
          return
        }

        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        
        // Check for OAuth errors
        const errorCode = params.get('error')
        const errorDesc = params.get('error_description')
        if (errorCode) {
          throw new Error(errorDesc || errorCode)
        }

        if (!access_token) {
          throw new Error('Missing access_token in hash')
        }

        console.log('[AuthCallback] Tokens found, setting session...')
        setStatus('Setting up your session...')

        // Set up timeout fallback (8 seconds)
        timeoutId = setTimeout(async () => {
          console.warn('[AuthCallback] setSession timeout → retrying getSession')
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (session) {
              console.log('[AuthCallback] Session found on retry')
              window.history.replaceState({}, document.title, '/dashboard')
              navigate('/dashboard', { replace: true })
            } else {
              setError('Login timeout. Please try again.')
            }
          } catch (e) {
            setError('Login timeout. Please try again.')
          }
        }, 8000)

        // Set the session
        const { data, error: setSessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token: refresh_token || '',
        })

        if (setSessionError) {
          throw setSessionError
        }

        console.log('[AuthCallback] setSession completed')
        setStatus('Verifying session...')

        // Clean URL immediately
        window.history.replaceState({}, document.title, '/dashboard')

        // Wait briefly for listener to catch up (Grok's recommendation)
        await new Promise(r => setTimeout(r, 300))

        // Force session check to verify it worked
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session) {
          console.log('[AuthCallback] Session verified:', session.user.email)
          clearTimeout(timeoutId)
          navigate('/dashboard', { replace: true })
        } else {
          throw new Error('Session not set after setSession')
        }

      } catch (err) {
        console.error('[AuthCallback] Error:', err)
        clearTimeout(timeoutId)
        setError(err.message || 'Authentication failed')
      }
    }

    processTokens()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
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
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                // Clear all auth storage and retry
                try {
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-') || key.includes('supabase') || key.includes('brandastic')) {
                      localStorage.removeItem(key)
                    }
                  })
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
      </div>
    </div>
  )
}
