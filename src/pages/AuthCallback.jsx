import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Handler
 * This page handles the redirect from Google OAuth.
 * Supabase automatically processes tokens via detectSessionInUrl.
 * This component just waits for the session to be ready and redirects.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Processing...')

  useEffect(() => {
    let mounted = true
    let retryCount = 0
    const maxRetries = 10
    
    const checkSession = async () => {
      try {
        console.log('[AuthCallback] Checking session... (attempt', retryCount + 1, ')')
        
        // Check for error in URL
        const params = new URLSearchParams(window.location.search)
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')
        
        if (errorParam) {
          console.error('[AuthCallback] OAuth error in URL:', errorParam)
          if (mounted) {
            setError(errorDescription || errorParam)
          }
          return
        }
        
        // Check if session exists (Supabase should have processed tokens automatically)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('[AuthCallback] Session error:', sessionError.message)
          if (mounted) {
            setError(sessionError.message)
          }
          return
        }
        
        if (session?.user) {
          console.log('[AuthCallback] Session found for:', session.user.email)
          // Clear hash from URL
          if (window.location.hash) {
            window.history.replaceState(null, '', window.location.pathname)
          }
          if (mounted) {
            navigate('/dashboard', { replace: true })
          }
          return
        }
        
        // No session yet - if we have tokens in URL, Supabase might still be processing
        const hash = window.location.hash
        if (hash && hash.includes('access_token')) {
          retryCount++
          if (retryCount < maxRetries) {
            console.log('[AuthCallback] Tokens in URL but no session yet, waiting...')
            if (mounted) {
              setStatus(`Establishing session... (${retryCount}/${maxRetries})`)
            }
            setTimeout(checkSession, 500)
            return
          } else {
            console.error('[AuthCallback] Max retries reached, tokens not processed')
            if (mounted) {
              setError('Unable to process authentication. Please try again.')
            }
            return
          }
        }
        
        // No tokens and no session - redirect to login
        console.log('[AuthCallback] No session or tokens, redirecting to login')
        if (mounted) {
          navigate('/login', { replace: true })
        }
        
      } catch (err) {
        console.error('[AuthCallback] Error:', err)
        if (mounted) {
          setError(err.message || 'An unexpected error occurred')
        }
      }
    }

    // Small delay to let Supabase process tokens first
    const timer = setTimeout(checkSession, 300)
    
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
          <h2 className="text-xl font-bold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <p className="text-sm text-muted-foreground mb-4">
            This may happen in incognito/private browsing mode due to cookie restrictions.
          </p>
          <div className="space-y-2">
            <button
              onClick={() => {
                // Clear URL and try login again
                window.history.replaceState(null, '', '/login')
                navigate('/login', { replace: true })
              }}
              className="w-full px-4 py-2 bg-brand-orange text-white rounded-lg hover:opacity-90"
            >
              Back to Login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
