import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Loader2 } from 'lucide-react'

/**
 * OAuth Callback Handler
 * This page handles the redirect from Google OAuth.
 * It explicitly processes the tokens from the URL hash before navigating.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[AuthCallback] Processing OAuth callback...')
        console.log('[AuthCallback] URL hash:', window.location.hash ? 'present' : 'empty')
        console.log('[AuthCallback] URL search:', window.location.search ? 'present' : 'empty')
        
        // Check for error in URL (OAuth error)
        const params = new URLSearchParams(window.location.search)
        const errorParam = params.get('error')
        const errorDescription = params.get('error_description')
        
        if (errorParam) {
          console.error('[AuthCallback] OAuth error:', errorParam, errorDescription)
          setError(errorDescription || errorParam)
          setProcessing(false)
          return
        }

        // Check for tokens in hash (implicit flow)
        const hash = window.location.hash
        if (hash && (hash.includes('access_token') || hash.includes('refresh_token'))) {
          console.log('[AuthCallback] Tokens found in URL hash')
          
          // Supabase should automatically pick these up via detectSessionInUrl
          // But let's give it a moment and verify
          await new Promise(resolve => setTimeout(resolve, 500))
          
          const { data: { session }, error: sessionError } = await supabase.auth.getSession()
          
          if (sessionError) {
            console.error('[AuthCallback] Session error:', sessionError)
            setError(sessionError.message)
            setProcessing(false)
            return
          }
          
          if (session?.user) {
            console.log('[AuthCallback] Session established for:', session.user.email)
            // Clear the hash from URL for cleanliness
            window.history.replaceState(null, '', window.location.pathname)
            navigate('/dashboard', { replace: true })
            return
          }
          
          console.log('[AuthCallback] No session after hash processing, trying manual extraction...')
          
          // Manual token extraction as fallback
          const hashParams = new URLSearchParams(hash.substring(1))
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token')
          
          if (accessToken && refreshToken) {
            console.log('[AuthCallback] Manually setting session from tokens...')
            const { data, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            
            if (setError) {
              console.error('[AuthCallback] setSession error:', setError)
              setError(setError.message)
              setProcessing(false)
              return
            }
            
            if (data?.session?.user) {
              console.log('[AuthCallback] Session manually established for:', data.session.user.email)
              window.history.replaceState(null, '', window.location.pathname)
              navigate('/dashboard', { replace: true })
              return
            }
          }
        }
        
        // Check for code in query params (PKCE flow)
        const code = params.get('code')
        if (code) {
          console.log('[AuthCallback] Authorization code found, exchanging...')
          
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
          
          if (exchangeError) {
            console.error('[AuthCallback] Code exchange error:', exchangeError)
            setError(exchangeError.message)
            setProcessing(false)
            return
          }
          
          if (data?.session?.user) {
            console.log('[AuthCallback] Session established via code exchange:', data.session.user.email)
            navigate('/dashboard', { replace: true })
            return
          }
        }
        
        // No tokens or codes found - check if user is already logged in
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          console.log('[AuthCallback] User already logged in:', session.user.email)
          navigate('/dashboard', { replace: true })
          return
        }
        
        // Nothing worked - redirect to login
        console.log('[AuthCallback] No auth data found, redirecting to login')
        navigate('/login', { replace: true })
        
      } catch (err) {
        console.error('[AuthCallback] Unexpected error:', err)
        setError(err.message || 'An unexpected error occurred')
        setProcessing(false)
      }
    }

    handleCallback()
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
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 bg-brand-orange text-white rounded-lg hover:opacity-90"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-brand-orange mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
