import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * OAuth Callback Handler - Minimal and robust
 * 
 * This component handles the redirect from Google OAuth.
 * With flowType: 'implicit' and detectSessionInUrl: true,
 * Supabase auto-processes hash tokens.
 * 
 * Strategy:
 * 1. Show loading state immediately
 * 2. Force getSession() to process hash tokens
 * 3. Listen for auth state changes
 * 4. Only show error after timeout (not immediately)
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Completing Google login...')
  const [showError, setShowError] = useState(false)
  const [debugInfo, setDebugInfo] = useState('')

  useEffect(() => {
    let mounted = true
    let errorTimeout = null

    // Debug: Log what's in the URL
    console.log('[AuthCallback] Mounted. URL:', window.location.href)
    console.log('[AuthCallback] Hash:', window.location.hash)
    console.log('[AuthCallback] Search:', window.location.search)

    // Check for tokens in hash
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const hasTokens = hashParams.has('access_token')
    
    if (hasTokens) {
      console.log('[AuthCallback] Tokens detected in hash, processing...')
      setDebugInfo('Tokens found in URL')
    }

    // Check for OAuth error in URL
    const errorParam = hashParams.get('error') || new URLSearchParams(window.location.search).get('error')
    const errorDescription = hashParams.get('error_description') || new URLSearchParams(window.location.search).get('error_description')
    
    if (errorParam) {
      console.error('[AuthCallback] OAuth error in URL:', errorParam, errorDescription)
      setStatus('Sign in failed')
      setDebugInfo(`OAuth error: ${errorDescription || errorParam}`)
      setShowError(true)
      return
    }

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[AuthCallback] Auth event:', event, session?.user?.email || 'no session')
      
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('[AuthCallback] SIGNED_IN - redirecting to dashboard')
        // Clean hash from URL
        if (window.location.hash) {
          window.history.replaceState({}, document.title, '/dashboard')
        }
        if (mounted) {
          navigate('/dashboard', { replace: true })
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[AuthCallback] TOKEN_REFRESHED - redirecting to dashboard')
        if (mounted) {
          navigate('/dashboard', { replace: true })
        }
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        console.log('[AuthCallback] INITIAL_SESSION with user - redirecting to dashboard')
        if (mounted) {
          navigate('/dashboard', { replace: true })
        }
      }
    })

    // Force getSession to process hash tokens
    const processSession = async () => {
      try {
        setStatus('Establishing session...')
        console.log('[AuthCallback] Calling getSession()...')
        
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('[AuthCallback] getSession result:', {
          hasSession: !!session,
          userEmail: session?.user?.email,
          error: error?.message
        })

        if (error) {
          console.error('[AuthCallback] getSession error:', error)
          setDebugInfo(`getSession error: ${error.message}`)
          // Don't show error immediately - wait for auth listener
        }

        if (session?.user) {
          console.log('[AuthCallback] Session already exists, redirecting...')
          window.history.replaceState({}, document.title, '/dashboard')
          if (mounted) {
            navigate('/dashboard', { replace: true })
          }
          return
        }

        // If we have tokens but no session yet, try setSession manually
        if (hasTokens && !session) {
          console.log('[AuthCallback] Tokens present but no session, trying manual setSession...')
          setStatus('Finalizing login...')
          
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken) {
            const { data, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || ''
            })
            
            console.log('[AuthCallback] setSession result:', {
              hasSession: !!data?.session,
              userEmail: data?.session?.user?.email,
              error: setError?.message
            })
            
            if (data?.session?.user) {
              window.history.replaceState({}, document.title, '/dashboard')
              if (mounted) {
                navigate('/dashboard', { replace: true })
              }
              return
            }
          }
        }
      } catch (err) {
        console.error('[AuthCallback] processSession error:', err)
        setDebugInfo(`Error: ${err.message}`)
      }
    }

    // Start processing after a brief delay to let Supabase initialize
    const initTimeout = setTimeout(processSession, 100)

    // Only show error after 10 seconds (give plenty of time)
    errorTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthCallback] Timeout - showing error UI')
        setShowError(true)
        setStatus('Sign in taking longer than expected')
      }
    }, 10000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(initTimeout)
      if (errorTimeout) clearTimeout(errorTimeout)
    }
  }, [navigate])

  // Error state - only shown after timeout
  if (showError) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ textAlign: 'center', padding: '20px', maxWidth: '400px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', color: '#1e293b' }}>
            Sign In Issue
          </h2>
          <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
            {status}
          </p>
          {debugInfo && (
            <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px', fontFamily: 'monospace' }}>
              Debug: {debugInfo}
            </p>
          )}
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '24px' }}>
            If this keeps happening, try using a regular browser window (not incognito/private).
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => {
                window.history.replaceState({}, document.title, '/login')
                navigate('/login', { replace: true })
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Back to Login
            </button>
            <button
              onClick={() => {
                // Clear all auth cache and retry
                try {
                  localStorage.removeItem('brandastic-auth')
                  Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('sb-') || key.includes('supabase')) {
                      localStorage.removeItem(key)
                    }
                  })
                } catch (e) {}
                window.location.reload()
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: '#475569',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Clear Cache & Retry
            </button>
            <button
              onClick={async () => {
                // Debug button - manually try getSession
                console.log('[Debug] Manual getSession attempt...')
                console.log('[Debug] Current hash:', window.location.hash)
                const { data, error } = await supabase.auth.getSession()
                console.log('[Debug] getSession result:', data, error)
                alert(`Session: ${data?.session?.user?.email || 'none'}\nError: ${error?.message || 'none'}`)
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                border: 'none',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Debug: Check Session
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state - shown while processing
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
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
        <p style={{ fontSize: '16px', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>
          {status}
        </p>
        <p style={{ fontSize: '14px', color: '#64748b' }}>
          This should only take a moment...
        </p>
        {debugInfo && (
          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px', fontFamily: 'monospace' }}>
            {debugInfo}
          </p>
        )}
      </div>
    </div>
  )
}
