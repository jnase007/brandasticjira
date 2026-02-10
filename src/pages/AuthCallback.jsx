import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - Ultra-Minimal (Grok's Bug Workaround)
 * 
 * Known issue: supabase-js #41968 causes AbortError in getSession()/refreshSession()
 * 
 * Solution: ONLY use setSession() with parsed tokens - no other auth calls
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const processed = useRef(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    // Clear conflicting storage first (Grok's recommendation)
    try {
      localStorage.removeItem('brandastic-auth')
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key)
        }
      })
    } catch (e) {
      console.warn('[AuthCallback] Storage clear failed:', e)
    }

    const hash = window.location.hash.substring(1)
    
    console.log('[AuthCallback] Processing...')
    console.log('[AuthCallback] Hash present:', !!hash)
    
    if (!hash) {
      console.warn('[AuthCallback] No hash found')
      navigate('/login?error=no_tokens')
      return
    }

    const params = new URLSearchParams(hash)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    
    // Check for OAuth error
    const errorCode = params.get('error')
    if (errorCode) {
      const errorDesc = params.get('error_description')
      console.error('[AuthCallback] OAuth error:', errorCode, errorDesc)
      setError(errorDesc || errorCode)
      return
    }

    if (!access_token) {
      console.error('[AuthCallback] No access_token in hash')
      navigate('/login?error=missing_tokens')
      return
    }

    console.log('[AuthCallback] Tokens found, calling setSession...')

    // ONLY use setSession - no getSession() call (avoids AbortError bug)
    supabase.auth.setSession({ 
      access_token, 
      refresh_token: refresh_token || '' 
    })
      .then(({ data, error: setError }) => {
        if (setError) {
          console.error('[AuthCallback] setSession error:', setError)
          throw setError
        }
        
        console.log('[AuthCallback] setSession success:', data?.user?.email)
        
        // Clean hash and navigate immediately
        window.history.replaceState({}, document.title, '/dashboard')
        navigate('/dashboard', { replace: true })
      })
      .catch(err => {
        console.error('[AuthCallback] Failed:', err)
        setError(err.message || 'Session creation failed')
      })

  }, [navigate])

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
          <div className="space-y-3 mt-6">
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                localStorage.clear()
                sessionStorage.clear()
                window.location.href = '/login'
              }}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100"
            >
              Clear Cache & Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-900 dark:text-white">
          Completing Google sign-in...
        </p>
      </div>
    </div>
  )
}
