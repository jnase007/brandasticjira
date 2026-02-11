import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - PKCE Flow (Fixed)
 * 
 * With detectSessionInUrl: true and flowType: 'pkce':
 * 1. Call getSession() ONCE - this triggers the code exchange
 * 2. Wait for onAuthStateChange to confirm session
 * 3. DO NOT retry getSession() - OAuth codes are single-use
 * 
 * See: https://github.com/supabase/supabase/issues/41968
 * See: https://supabase.com/docs/guides/auth/social-login/auth-google
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const processed = useRef(false)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('Completing sign-in...')
  const timeoutRef = useRef(null)
  const subscriptionRef = useRef(null)

  useEffect(() => {
    if (processed.current) return
    processed.current = true

    console.log('[AuthCallback] === PKCE Callback Start ===')
    console.log('[AuthCallback] URL:', window.location.href)
    console.log('[AuthCallback] Search:', window.location.search)
    console.log('[AuthCallback] Hash:', window.location.hash)
    
    // Check for OAuth error in URL first
    const urlParams = new URLSearchParams(window.location.search)
    const errorCode = urlParams.get('error')
    const errorDesc = urlParams.get('error_description')
    
    if (errorCode) {
      console.error('[AuthCallback] OAuth error in URL:', errorCode, errorDesc)
      setError(errorDesc || errorCode)
      return
    }
    
    const hasCode = urlParams.has('code')
    const hasHashTokens = window.location.hash?.includes('access_token')
    
    console.log('[AuthCallback] Has code param:', hasCode)
    console.log('[AuthCallback] Has hash tokens:', hasHashTokens)
    
    // Set up auth state listener FIRST (before calling getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth event:', event, session?.user?.email || 'no user')
      
      if (event === 'SIGNED_IN' && session) {
        // Success! Clean up and navigate
        clearTimeout(timeoutRef.current)
        
        setStatus('Success! Redirecting...')
        console.log('[AuthCallback] ✓ Session established:', session.user.email)
        
        // Clean URL and navigate
        window.history.replaceState({}, document.title, '/dashboard')
        navigate('/dashboard', { replace: true })
      }
      // Don't handle other events - let them pass through
    })
    subscriptionRef.current = subscription
    
    // Now handle the callback
    const handleCallback = async () => {
      if (!hasCode && !hasHashTokens) {
        // No auth params - check if we already have a session
        console.log('[AuthCallback] No auth params, checking for existing session...')
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          console.log('[AuthCallback] Already have session, redirecting...')
          navigate('/dashboard', { replace: true })
        } else {
          setError('No authorization received. Please try logging in again.')
        }
        return
      }
      
      setStatus('Exchanging authorization code...')
      
      try {
        // Call getSession() ONCE to trigger the PKCE code exchange
        // With detectSessionInUrl: true, this will:
        // 1. Detect the ?code= param
        // 2. Exchange it for a session using the code_verifier from sessionStorage
        // 3. Store the session and trigger onAuthStateChange
        console.log('[AuthCallback] Calling getSession() to trigger code exchange...')
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('[AuthCallback] getSession result:', {
          hasSession: !!session,
          user: session?.user?.email,
          error: sessionError?.message
        })
        
        if (sessionError) {
          // Log the full error for debugging
          console.error('[AuthCallback] getSession error:', sessionError)
          
          // Check if it's the abort error - this might mean the exchange is in progress
          if (sessionError.message?.includes('abort')) {
            console.log('[AuthCallback] Abort error - waiting for auth state change...')
            // Don't set error yet, wait for the listener
            return
          }
          
          throw sessionError
        }
        
        if (session) {
          // Session was returned directly (rare, usually comes via onAuthStateChange)
          console.log('[AuthCallback] Session returned directly:', session.user.email)
          clearTimeout(timeoutRef.current)
          window.history.replaceState({}, document.title, '/dashboard')
          navigate('/dashboard', { replace: true })
          return
        }
        
        // No session yet - wait for onAuthStateChange (already listening)
        console.log('[AuthCallback] No immediate session, waiting for auth event...')
        
      } catch (err) {
        console.error('[AuthCallback] Error during code exchange:', err)
        
        // Don't immediately fail - the onAuthStateChange might still fire
        // Set a shorter timeout to show error
        setTimeout(() => {
          // Check one more time if session exists
          supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
            if (finalSession) {
              console.log('[AuthCallback] Session found on final check')
              window.history.replaceState({}, document.title, '/dashboard')
              navigate('/dashboard', { replace: true })
            } else {
              setError(err.message || 'Authentication failed. Please try again.')
            }
          })
        }, 2000)
      }
    }
    
    handleCallback()
    
    // Safety timeout - if no auth event after 20 seconds, show error
    timeoutRef.current = setTimeout(() => {
      console.warn('[AuthCallback] Timeout waiting for auth event')
      
      // Final check for session
      supabase.auth.getSession().then(({ data: { session: finalSession } }) => {
        if (finalSession) {
          console.log('[AuthCallback] Found session after timeout')
          window.history.replaceState({}, document.title, '/dashboard')
          navigate('/dashboard', { replace: true })
        } else {
          setError('Authentication timed out. Please try again.')
        }
      })
    }, 20000)
    
    return () => {
      clearTimeout(timeoutRef.current)
      subscriptionRef.current?.unsubscribe()
    }
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
                // Only clear our app's auth data, not sessionStorage (PKCE needs it)
                try {
                  localStorage.removeItem('brandastic-auth')
                } catch (e) { /* ignore */ }
                window.location.href = '/login'
              }}
              className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Clear Cache & Retry
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-6">
            If this keeps happening, try using an incognito/private window.
          </p>
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
