import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Handler
 * This page handles the redirect from Google OAuth.
 * It waits for Supabase to process the tokens and establish a session.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Completing sign in...')

  useEffect(() => {
    let mounted = true
    let checkCount = 0
    const maxChecks = 20
    let checkInterval = null

    // Check for OAuth error in URL params
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const errorParam = params.get('error') || hashParams.get('error')
    const errorDescription = params.get('error_description') || hashParams.get('error_description')
    
    if (errorParam) {
      console.error('[AuthCallback] OAuth error:', errorParam, errorDescription)
      setError(errorDescription || errorParam)
      return
    }

    // Listen for auth state changes - this is the most reliable way
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth state change:', event, session?.user?.email)
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[AuthCallback] Signed in, redirecting to dashboard')
        // Clean up URL
        if (window.location.hash || window.location.search.includes('code=')) {
          window.history.replaceState(null, '', '/dashboard')
        }
        if (mounted) {
          clearInterval(checkInterval)
          navigate('/dashboard', { replace: true })
        }
      }
    })

    // Also poll for session in case onAuthStateChange doesn't fire
    checkInterval = setInterval(async () => {
      checkCount++
      
      if (!mounted) {
        clearInterval(checkInterval)
        return
      }
      
      if (checkCount > maxChecks) {
        clearInterval(checkInterval)
        console.error('[AuthCallback] Timed out waiting for session')
        setError('Sign in timed out. Please try again.')
        return
      }

      try {
        setStatus(`Verifying session... (${checkCount}/${maxChecks})`)
        
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          console.log('[AuthCallback] Session found via polling:', session.user.email)
          clearInterval(checkInterval)
          // Clean up URL
          window.history.replaceState(null, '', '/dashboard')
          navigate('/dashboard', { replace: true })
        }
      } catch (err) {
        // Ignore errors during polling - they're usually just timing issues
        console.log('[AuthCallback] Poll check error (ignoring):', err.message)
      }
    }, 500)

    return () => {
      mounted = false
      clearInterval(checkInterval)
      subscription.unsubscribe()
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center p-8 max-w-md">
          <div className="text-red-500 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground mb-4">
            This may happen in incognito/private browsing mode due to cookie restrictions.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="w-full px-4 py-2 bg-brand-orange text-white rounded-lg hover:opacity-90"
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                setError(null)
                setStatus('Retrying...')
                window.location.href = '/auth/callback' + window.location.hash
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand-orange mx-auto mb-4" />
        <p className="text-muted-foreground">{status}</p>
        <p className="text-xs text-muted-foreground mt-2">Please wait...</p>
      </div>
    </div>
  )
}
