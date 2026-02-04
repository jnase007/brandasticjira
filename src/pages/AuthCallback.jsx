import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Handler
 * Handles the redirect from Google OAuth and establishes the session.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Processing login...')

  useEffect(() => {
    let mounted = true

    const handleCallback = async () => {
      try {
        // Check for OAuth error in URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        
        const errorParam = hashParams.get('error') || queryParams.get('error')
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description')
        
        if (errorParam) {
          console.error('[AuthCallback] OAuth error:', errorParam)
          if (mounted) setError(errorDescription || errorParam)
          return
        }

        // Get tokens from URL hash
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        if (accessToken) {
          console.log('[AuthCallback] Found tokens in URL, setting session...')
          if (mounted) setStatus('Establishing session...')
          
          // Manually set the session with tokens from URL
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })

          if (sessionError) {
            console.error('[AuthCallback] setSession error:', sessionError)
            if (mounted) setError(sessionError.message)
            return
          }

          if (data?.session?.user) {
            console.log('[AuthCallback] Session established for:', data.session.user.email)
            // Clean up URL
            window.history.replaceState(null, '', '/dashboard')
            if (mounted) navigate('/dashboard', { replace: true })
            return
          }
        }

        // No tokens in URL - check if session already exists
        console.log('[AuthCallback] No tokens in URL, checking existing session...')
        if (mounted) setStatus('Checking session...')
        
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          console.log('[AuthCallback] Existing session found:', session.user.email)
          window.history.replaceState(null, '', '/dashboard')
          if (mounted) navigate('/dashboard', { replace: true })
          return
        }

        // No session found at all - might be a stale callback URL
        console.log('[AuthCallback] No session found, redirecting to login')
        if (mounted) {
          setError('No active session found. Please try logging in again.')
        }

      } catch (err) {
        console.error('[AuthCallback] Error:', err)
        if (mounted) setError(err.message || 'An unexpected error occurred')
      }
    }

    // Small delay to ensure page is fully loaded
    const timer = setTimeout(handleCallback, 100)

    return () => {
      mounted = false
      clearTimeout(timer)
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
          <h2 className="text-xl font-bold mb-2">Sign In Issue</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground mb-6">
            If this keeps happening, try using a regular browser window (not incognito/private).
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                window.history.replaceState(null, '', '/login')
                navigate('/login', { replace: true })
              }}
              className="w-full px-4 py-3 bg-brand-orange text-white rounded-lg hover:opacity-90 font-medium"
            >
              Back to Login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
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
        <p className="text-lg font-medium text-foreground mb-1">{status}</p>
        <p className="text-sm text-muted-foreground">This should only take a moment...</p>
      </div>
    </div>
  )
}
