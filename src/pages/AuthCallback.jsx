import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Handler
 * Handles the redirect from Google OAuth.
 * 
 * With flowType: 'implicit' and detectSessionInUrl: true, 
 * Supabase auto-processes hash tokens. This component waits for
 * the auth state change event rather than polling getSession().
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Processing login...')
  const hasProcessedRef = useRef(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    let mounted = true
    let subscription = null
    let initTimer = null
    
    // Get URL params outside try block so they're accessible throughout
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const queryParams = new URLSearchParams(window.location.search)
    
    console.log('[AuthCallback] Component mounted, URL:', window.location.href)
    
    try {
      // Check for OAuth error in URL first
      
      const errorParam = hashParams.get('error') || queryParams.get('error')
      const errorDescription = hashParams.get('error_description') || queryParams.get('error_description')
      
      if (errorParam) {
        console.error('[AuthCallback] OAuth error:', errorParam)
        setError(errorDescription || errorParam)
        return
      }

      // Listen for auth state changes - Supabase emits SIGNED_IN or INITIAL_SESSION when tokens are processed
      const authListener = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[AuthCallback] Auth event:', event, session?.user?.email || 'no user')
        
        if (hasProcessedRef.current) return // Prevent double processing
        
        // Handle both SIGNED_IN and INITIAL_SESSION events (Supabase can emit either)
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
          hasProcessedRef.current = true
          console.log('[AuthCallback] Session established for:', session.user.email)
          
          // Clear timeout since we got the session
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
          }
          
          // Clean URL and redirect
          window.history.replaceState(null, '', '/dashboard')
          if (mounted) navigate('/dashboard', { replace: true })
        }
      })
      subscription = authListener.data.subscription

    // Also check if session already exists (user might already be logged in)
    const checkExistingSession = async () => {
      if (hasProcessedRef.current) return
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user && !hasProcessedRef.current) {
          hasProcessedRef.current = true
          console.log('[AuthCallback] Existing session found:', session.user.email)
          window.history.replaceState(null, '', '/dashboard')
          if (mounted) navigate('/dashboard', { replace: true })
        }
      } catch (err) {
        // Ignore errors here - the auth state listener will handle it
        console.warn('[AuthCallback] Initial session check warning:', err.message)
      }
    }

    // Try manual token extraction as fallback if Supabase doesn't process automatically
    const tryManualTokenExtraction = async () => {
      if (hasProcessedRef.current) return
      
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      
      if (accessToken) {
        console.log('[AuthCallback] Attempting manual session set...')
        if (mounted) setStatus('Finalizing login...')
        
        try {
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          })

          if (!sessionError && data?.session?.user && !hasProcessedRef.current) {
            hasProcessedRef.current = true
            console.log('[AuthCallback] Manual session established:', data.session.user.email)
            window.history.replaceState(null, '', '/dashboard')
            if (mounted) navigate('/dashboard', { replace: true })
            return true
          }
        } catch (e) {
          console.error('[AuthCallback] Manual session failed:', e)
        }
      }
      return false
    }

    // Start checking after a brief delay to let Supabase initialize
    initTimer = setTimeout(async () => {
      if (mounted) setStatus('Establishing session...')
      await checkExistingSession()
    }, 100)

    // Set a timeout - if no session after 8 seconds, try manual extraction then show error
    timeoutRef.current = setTimeout(async () => {
      if (hasProcessedRef.current) return
      
      console.warn('[AuthCallback] Timeout reached, trying manual extraction...')
      const success = await tryManualTokenExtraction()
      
      if (!success && mounted && !hasProcessedRef.current) {
        setError('Unable to complete sign in. Please try again.')
      }
    }, 8000)

    } catch (err) {
      console.error('[AuthCallback] Setup error:', err)
      if (mounted) setError('An error occurred during sign in. Please try again.')
    }

    return () => {
      mounted = false
      if (subscription) subscription.unsubscribe()
      if (initTimer) clearTimeout(initTimer)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
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
              onClick={() => {
                hasProcessedRef.current = false
                setError(null)
                setStatus('Retrying...')
                window.location.reload()
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Use inline styles as fallback in case CSS doesn't load
  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-background"
      style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}
    >
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <div 
          style={{ 
            width: '48px', 
            height: '48px', 
            border: '4px solid #e2e8f0',
            borderTopColor: '#f97316',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} 
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ fontSize: '18px', fontWeight: '500', marginBottom: '4px', color: '#1e293b' }}>{status}</p>
        <p style={{ fontSize: '14px', color: '#64748b' }}>This should only take a moment...</p>
      </div>
    </div>
  )
}
