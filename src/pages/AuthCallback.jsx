import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - PKCE Flow
 * 
 * PKCE uses ?code= query param instead of hash tokens.
 * detectSessionInUrl: true automatically exchanges code for session.
 * We just call getSession() to trigger the exchange.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const processed = useRef(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Completing sign-in...')

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] PKCE flow - processing callback...')
        console.log('[AuthCallback] URL:', window.location.href)
        
        // Check for error in URL
        const urlParams = new URLSearchParams(window.location.search)
        const errorCode = urlParams.get('error')
        const errorDesc = urlParams.get('error_description')
        
        if (errorCode) {
          console.error('[AuthCallback] OAuth error:', errorCode, errorDesc)
          throw new Error(errorDesc || errorCode)
        }
        
        // Check for code (PKCE) or hash tokens (fallback)
        const code = urlParams.get('code')
        const hashHasTokens = window.location.hash?.includes('access_token')
        
        console.log('[AuthCallback] Code present:', !!code)
        console.log('[AuthCallback] Hash tokens present:', hashHasTokens)
        
        if (!code && !hashHasTokens) {
          // Maybe we already have a session
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            console.log('[AuthCallback] Existing session found')
            navigate('/dashboard', { replace: true })
            return
          }
          throw new Error('No authorization code received')
        }
        
        setStatus('Exchanging authorization code...')
        
        // For PKCE: getSession() triggers the code exchange automatically
        // (detectSessionInUrl: true handles this)
        console.log('[AuthCallback] Calling getSession to exchange code...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthCallback] getSession error:', sessionError)
          throw sessionError
        }
        
        if (!session) {
          // Try one more time after a short delay
          console.log('[AuthCallback] No session yet, waiting and retrying...')
          await new Promise(r => setTimeout(r, 500))
          
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (!retrySession) {
            throw new Error('Failed to establish session')
          }
          
          console.log('[AuthCallback] Session established on retry:', retrySession.user.email)
          window.history.replaceState({}, document.title, '/dashboard')
          navigate('/dashboard', { replace: true })
          return
        }
        
        console.log('[AuthCallback] Session established:', session.user.email)
        
        // Clean URL and navigate
        window.history.replaceState({}, document.title, '/dashboard')
        navigate('/dashboard', { replace: true })
        
      } catch (err) {
        console.error('[AuthCallback] Error:', err)
        setError(err.message || 'Authentication failed')
      }
    }

    handleCallback()
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
          {status}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          This should only take a moment
        </p>
      </div>
    </div>
  )
}
