import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, getProfile, onSessionHealthChange, onTabSync } from '../lib/supabase'

const AuthContext = createContext({})

// Safe localStorage wrapper for Safari private mode
const safeLocalStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key)
    } catch (e) {
      console.warn('[Auth] localStorage.getItem failed:', e)
      return null
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value)
    } catch (e) {
      console.warn('[Auth] localStorage.setItem failed:', e)
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key)
    } catch (e) {
      console.warn('[Auth] localStorage.removeItem failed:', e)
    }
  },
}

// Event for profile sync notification
const profileSyncEvent = new CustomEvent('profileSynced', { detail: {} })

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [justLoggedIn, setJustLoggedIn] = useState(false)
  const [profileSynced, setProfileSynced] = useState(false)
  const [authError, setAuthError] = useState(null)
  const [sessionRefreshing, setSessionRefreshing] = useState(false)
  const [sessionHealthy, setSessionHealthy] = useState(true)
  const refreshInFlightRef = useRef(false)
  const lastRefreshRef = useRef(0)
  
  // View mode toggle (admin can switch between admin and team view)
  const [viewMode, setViewMode] = useState(() => {
    return safeLocalStorage.getItem('viewMode') || 'default'
  })
  
  // Listen for session health changes from the Supabase module
  useEffect(() => {
    const unsubscribe = onSessionHealthChange((healthy, reason) => {
      console.log(`[Auth] Session health changed: ${healthy ? 'healthy' : 'unhealthy'} - ${reason}`)
      
      // Only update state if it actually changed to avoid re-renders
      setSessionHealthy(prev => {
        if (prev === healthy) return prev
        return healthy
      })
      
      // Only show error for actual session expiry, not transient issues
      if (!healthy && reason?.includes('expired')) {
        setAuthError('Your session has expired. Please sign in again.')
      }
    })
    
    return unsubscribe
  }, [])
  
  // Listen for multi-tab sync events
  useEffect(() => {
    const unsubscribe = onTabSync(async (event, data) => {
      console.log(`[Auth] Tab sync event: ${event}`)
      
      if (event === 'session_synced' && data) {
        // Another tab refreshed the session - update our state
        setUser(data.user)
        if (data.user) {
          const { data: profileData } = await getProfile(data.user.id)
          if (profileData) {
            setProfile(profileData)
          }
        }
        setSessionHealthy(true)
        setAuthError(null)
      } else if (event === 'signed_out') {
        // Another tab signed out - clear our state
        setUser(null)
        setProfile(null)
      }
    })
    
    return unsubscribe
  }, [])

  useEffect(() => {
    // Safety timeout - if loading takes too long, force complete
    const safetyTimeout = setTimeout(() => {
      console.warn('[Auth] Loading timeout - forcing complete')
      setLoading(false)
    }, 8000)

    // SIMPLIFIED AUTH INIT - Let Supabase handle OAuth via detectSessionInUrl
    const initAuth = async () => {
      console.log('[Auth] Initializing...')
      
      // Check if we're on the auth callback route - if so, let AuthCallback handle it
      // This prevents race conditions that cause "signal is aborted" errors
      const isAuthCallback = window.location.pathname === '/auth/callback'
      const hasAuthTokens = window.location.hash?.includes('access_token')
      
      if (isAuthCallback || hasAuthTokens) {
        console.log('[Auth] On auth callback route, deferring to AuthCallback component')
        // Don't call getSession() - let the AuthCallback handle token processing
        // The onAuthStateChange listener below will pick up the session once it's established
        setLoading(false) // CRITICAL: Set loading to false so AuthCallback can render!
        clearTimeout(safetyTimeout)
        return
      }
      
      try {
        // Small delay to let Supabase process any OAuth tokens in URL
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Get session - this triggers onAuthStateChange with INITIAL_SESSION
        const { data: { session }, error } = await supabase.auth.getSession()
        
        console.log('[Auth] getSession result:', session ? session.user.email : 'no session', error?.message || '')
        
        // If no session but we have a storage key, try refresh
        if (!session) {
          const stored = safeLocalStorage.getItem('brandastic-auth')
          if (stored) {
            console.log('[Auth] Found storage, attempting refresh...')
            try {
              const { data: refreshData } = await supabase.auth.refreshSession()
              if (refreshData?.session) {
                console.log('[Auth] Refresh succeeded:', refreshData.session.user.email)
                // Set user and profile directly instead of waiting for onAuthStateChange
                setUser(refreshData.session.user)
                try {
                  const { data: profileData } = await getProfile(refreshData.session.user.id)
                  if (profileData) {
                    setProfile(profileData)
                  } else {
                    setProfile({
                      id: refreshData.session.user.id,
                      email: refreshData.session.user.email,
                      full_name: refreshData.session.user.email?.split('@')[0] || 'User',
                      role: 'team',
                    })
                  }
                } catch (e) {
                  setProfile({
                    id: refreshData.session.user.id,
                    email: refreshData.session.user.email,
                    full_name: refreshData.session.user.email?.split('@')[0] || 'User',
                    role: 'team',
                  })
                }
                setLoading(false)
                clearTimeout(safetyTimeout)
                return
              }
            } catch (e) {
              console.log('[Auth] Refresh failed:', e.message)
            }
          }
          // No session found - finish loading
          console.log('[Auth] No session - finishing')
          setLoading(false)
          clearTimeout(safetyTimeout)
          return
        }
        
        // Session found
        if (session?.user) {
          console.log('[Auth] Session found for:', session.user.email)
          setUser(session.user)
          
          // Fetch profile - single attempt only, don't retry aggressively
          try {
            const { data: profileData, error: profileError } = await getProfile(session.user.id)
            
            if (profileData) {
              setProfile(profileData)
            } else if (!profileError) {
              // No profile exists - create one
              console.log('Creating profile for:', session.user.email)
              const { error: createError } = await supabase
                .from('profiles')
                .upsert({
                  id: session.user.id,
                  email: session.user.email,
                  full_name: session.user.user_metadata?.full_name || 
                             session.user.user_metadata?.name || 
                             session.user.email?.split('@')[0] || 'User',
                  role: 'team',
                  avatar_url: session.user.user_metadata?.avatar_url || 
                              session.user.user_metadata?.picture || null,
                }, { onConflict: 'id' })
              
              if (!createError) {
                const { data: newProfile } = await getProfile(session.user.id)
                setProfile(newProfile)
              }
            }
            
            // If still no profile, create a minimal one for display
            if (!profileData) {
              setProfile({
                id: session.user.id,
                email: session.user.email,
                full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'User',
                role: 'team',
              })
            }
          } catch (profileErr) {
            console.warn('Profile fetch error:', profileErr)
            // Set minimal profile so app can function
            setProfile({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.email?.split('@')[0] || 'User',
              role: 'team',
            })
          }
        } else {
          console.log('No session found')
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
        clearTimeout(safetyTimeout)
      }
    }

    initAuth()

    // Listen for auth changes - CRITICAL for handling token refresh
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Auth event:', event, session?.user?.email || 'no user')
        
        // Handle TOKEN_REFRESHED - this is key for tab switch recovery
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('[Auth] Token refreshed - updating user state')
          setUser(session.user)
          setSessionHealthy(true)
          setAuthError(null)
          return // Don't need to do profile check for refresh
        }
        
        if (session?.user) {
          setUser(session.user)
          setSessionHealthy(true)
          setAuthError(null)
          
          // For new signups or OAuth logins, ensure profile exists
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
            // Check and create profile if needed
            const { data: existingProfile } = await getProfile(session.user.id)
            
            // Get Google metadata
            const googleName = session.user.user_metadata?.full_name || 
                               session.user.user_metadata?.name || ''
            const googleAvatar = session.user.user_metadata?.avatar_url || 
                                 session.user.user_metadata?.picture || null
            
            if (!existingProfile) {
              // Create profile for OAuth users or if somehow missing
              await supabase
                .from('profiles')
                .upsert({
                  id: session.user.id,
                  email: session.user.email,
                  full_name: googleName,
                  role: 'team',
                  avatar_url: googleAvatar,
                }, { onConflict: 'id' })
              
              // Fetch the newly created profile
              const { data: newProfile } = await getProfile(session.user.id)
              setProfile(newProfile)
              setJustLoggedIn(true)
              setProfileSynced(true)
            } else {
              // Update existing profile with latest Google data if they're using OAuth
              // but only if the existing fields are empty
              const updates = {}
              if (!existingProfile.full_name && googleName) {
                updates.full_name = googleName
              }
              if (!existingProfile.avatar_url && googleAvatar) {
                updates.avatar_url = googleAvatar
              }
              
              if (Object.keys(updates).length > 0) {
                await supabase
                  .from('profiles')
                  .update(updates)
                  .eq('id', session.user.id)
                
                // Fetch updated profile
                const { data: updatedProfile } = await getProfile(session.user.id)
                setProfile(updatedProfile)
                setProfileSynced(true)
              } else {
                setProfile(existingProfile)
              }
              setJustLoggedIn(true)
            }
          } else {
            // Just fetch existing profile
            const { data: profileData } = await getProfile(session.user.id)
            setProfile(profileData)
          }
        } else {
          setUser(null)
          setProfile(null)
        }
        
        setLoading(false)
      }
    )

    return () => {
      clearTimeout(safetyTimeout)
      subscription.unsubscribe()
    }
  }, [])

  // Sign in with email
  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  // Sign up with email
  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    
    // If signup successful, create profile
    if (data?.user && !error) {
      await createProfileIfNotExists(data.user, metadata)
    }
    
    return { data, error }
  }
  
  // Create profile if it doesn't exist
  const createProfileIfNotExists = async (user, metadata = {}) => {
    try {
      // Check if profile exists - use maybeSingle to avoid error when not found
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (!existingProfile) {
        // Create new profile with upsert to handle race conditions
        const { error: insertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            full_name: metadata.full_name || user.user_metadata?.full_name || '',
            role: 'team', // Default role
            avatar_url: user.user_metadata?.avatar_url || null,
          }, { onConflict: 'id' })
        
        if (insertError) {
          console.error('Error creating profile:', insertError)
        }
      }
    } catch (err) {
      console.error('Error checking/creating profile:', err)
    }
  }

  // Sign in with Google
  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { data, error }
  }

  // Sign out
  const signOut = async () => {
    try {
      // Clear React state first
      setUser(null)
      setProfile(null)
      setLoading(false)
      
      // Clear all custom cached data
      safeLocalStorage.removeItem('viewMode')
      
      // Call Supabase signOut with local scope (only this browser)
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      
      if (error) {
        console.error('Supabase signOut error:', error)
      }
      
      return { error }
    } catch (err) {
      console.error('Sign out error:', err)
      // Still clear state on error
      setUser(null)
      setProfile(null)
      return { error: err }
    }
  }

  // Update profile - uses upsert to create if doesn't exist
  const updateUserProfile = async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }
    
    try {
      // Filter out undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      )
      
      if (Object.keys(cleanUpdates).length === 0) {
        return { data: profile, error: null }
      }

      // First try to update
      const { data: updateData, error: updateError } = await supabase
        .from('profiles')
        .update(cleanUpdates)
        .eq('id', user.id)
        .select()

      // If update returned data, use it
      if (updateData && updateData.length > 0) {
        setProfile(updateData[0])
        return { data: updateData[0], error: null }
      }

      // If no rows updated (profile doesn't exist), try upsert
      if (!updateData || updateData.length === 0) {
        console.log('Profile not found, creating with upsert...')
        const { data: upsertData, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: user.email,
            ...cleanUpdates,
            updated_at: new Date().toISOString()
          })
          .select()

        if (upsertError) {
          console.error('Profile upsert error:', upsertError)
          return { data: null, error: upsertError }
        }

        if (upsertData && upsertData.length > 0) {
          setProfile(upsertData[0])
          return { data: upsertData[0], error: null }
        }
      }

      if (updateError) {
        console.error('Profile update error:', updateError)
        return { data: null, error: updateError }
      }
      
      return { data: profile, error: null }
    } catch (err) {
      console.error('Profile update exception:', err)
      return { data: null, error: err }
    }
  }

  // Upload avatar
  const uploadAvatar = async (file) => {
    if (!user) return { error: new Error('Not authenticated') }

    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      // Update profile with new avatar URL
      const { data, error } = await updateUserProfile({ avatar_url: publicUrl })
      
      return { data, error, url: publicUrl }
    } catch (error) {
      console.error('Avatar upload error:', error)
      return { error }
    }
  }

  // Clear login state (call after showing welcome message)
  const clearLoginState = useCallback(() => {
    setJustLoggedIn(false)
    setProfileSynced(false)
  }, [])

  // Refresh profile
  const refreshProfile = async () => {
    if (!user) return
    const { data } = await getProfile(user.id)
    if (data) {
      setProfile(data)
    }
  }

  // Lightweight profile refresh - only fetches profile, no auth API calls
  // Supabase's autoRefreshToken handles token refresh automatically
  const refreshSessionAndProfile = useCallback(async (source = 'unknown') => {
    if (refreshInFlightRef.current || !user) return
    refreshInFlightRef.current = true
    
    try {
      // Just refresh profile data - don't make auth API calls
      // Supabase handles token refresh automatically via autoRefreshToken
      const { data: profileData } = await getProfile(user.id)
      if (profileData) {
        setProfile(profileData)
      }
    } catch (error) {
      console.warn(`Profile refresh failed (${source}):`, error?.message || error)
    } finally {
      refreshInFlightRef.current = false
    }
  }, [user])

  // NUCLEAR TAB SWITCH FIX with startAutoRefresh/stopAutoRefresh
  // This pattern comes from React Native iOS fixes and applies to web too
  useEffect(() => {
    let lastHiddenTime = 0
    let savedSession = null
    
    // Save the current session when tab is hidden
    const saveSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (data?.session) {
          savedSession = {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          }
          console.log('[Auth] Session saved before tab switch')
        }
      } catch (e) {
        console.error('[Auth] Failed to save session:', e)
      }
    }
    
    // Restore the session using setSession() - bypasses corrupted internal state
    const restoreSession = async () => {
      console.log('[Auth] Attempting session restore...')
      
      // First, try normal getSession
      const { data: currentSession } = await supabase.auth.getSession()
      
      if (currentSession?.session?.user) {
        console.log('[Auth] Session already valid')
        setUser(currentSession.session.user)
        setSessionHealthy(true)
        return true
      }
      
      console.log('[Auth] Session null, attempting manual restore...')
      
      // Try to restore from our saved session
      if (savedSession?.access_token && savedSession?.refresh_token) {
        console.log('[Auth] Using saved tokens to restore session')
        
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: savedSession.access_token,
            refresh_token: savedSession.refresh_token,
          })
          
          if (!error && data?.session?.user) {
            console.log('[Auth] Session restored via setSession!')
            setUser(data.session.user)
            setSessionHealthy(true)
            setAuthError(null)
            return true
          }
          
          console.log('[Auth] setSession failed:', error?.message)
        } catch (e) {
          console.error('[Auth] setSession exception:', e)
        }
      }
      
      // Try to read directly from localStorage and restore
      console.log('[Auth] Trying localStorage restore...')
      try {
        const storageKey = 'brandastic-auth'
        const stored = safeLocalStorage.getItem(storageKey)
        
        if (stored) {
          const parsed = JSON.parse(stored)
          const accessToken = parsed?.access_token || parsed?.currentSession?.access_token
          const refreshToken = parsed?.refresh_token || parsed?.currentSession?.refresh_token
          
          if (accessToken && refreshToken) {
            console.log('[Auth] Found tokens in localStorage, restoring...')
            
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            
            if (!error && data?.session?.user) {
              console.log('[Auth] localStorage restore succeeded!')
              setUser(data.session.user)
              setSessionHealthy(true)
              setAuthError(null)
              return true
            }
          }
        }
      } catch (e) {
        console.error('[Auth] localStorage restore failed:', e)
      }
      
      // Final fallback: refreshSession
      console.log('[Auth] Trying refreshSession as last resort...')
      try {
        const { data, error } = await supabase.auth.refreshSession()
        
        if (!error && data?.session?.user) {
          console.log('[Auth] refreshSession succeeded!')
          setUser(data.session.user)
          setSessionHealthy(true)
          setAuthError(null)
          return true
        }
      } catch (e) {
        console.error('[Auth] refreshSession failed:', e)
      }
      
      console.error('[Auth] ALL restore methods failed')
      return false
    }
    
    // Handle visibility change with startAutoRefresh/stopAutoRefresh
    // This is the KEY fix from React Native iOS patterns
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'hidden') {
        // Tab is being hidden - STOP auto refresh to avoid races
        console.log('[Auth] Tab hidden - stopping auto refresh')
        lastHiddenTime = Date.now()
        saveSession()
        
        try {
          supabase.auth.stopAutoRefresh()
        } catch (e) {
          console.log('[Auth] stopAutoRefresh not available:', e.message)
        }
      } else {
        // Tab is visible - RESTART auto refresh and force a check
        console.log('[Auth] Tab visible - restarting auto refresh')
        
        try {
          supabase.auth.startAutoRefresh()
        } catch (e) {
          console.log('[Auth] startAutoRefresh not available:', e.message)
        }
        
        const timeSinceHidden = lastHiddenTime ? Date.now() - lastHiddenTime : 0
        console.log('[Auth] Tab resumed after', Math.round(timeSinceHidden / 1000), 's')
        
        // Force a session check/restore
        const restored = await restoreSession()
        
        if (!restored && user) {
          console.warn('[Auth] Cannot restore session - showing error instead of reload')
          // Don't reload - just show the error and let user decide
          setAuthError('Session could not be restored. Please sign in again if issues persist.')
          setSessionHealthy(false)
        }
      }
    }
    
    const handleFocus = async () => {
      if (document.visibilityState === 'visible') {
        // Also restart auto refresh on focus (belt and suspenders)
        try {
          supabase.auth.startAutoRefresh()
        } catch {}
        
        await restoreSession()
      }
    }
    
    const handlePageShow = async (e) => {
      if (e.persisted) {
        console.log('[Auth] Page restored from bfcache')
        try {
          supabase.auth.startAutoRefresh()
        } catch {}
        await restoreSession()
      }
    }

    // Initial call to ensure auto refresh is running
    try {
      supabase.auth.startAutoRefresh()
    } catch {}

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('pageshow', handlePageShow)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pageshow', handlePageShow)
    }
  }, [user])
  
  // HEARTBEAT DISABLED - Supabase's autoRefreshToken handles this automatically
  // The previous heartbeat was causing logout issues when it tried to refresh sessions
  // and triggered onAuthStateChange events with no session
  // 
  // If session issues persist, the SessionStatus component will show a retry button

  // Retry auth (for when stuck on loading) - just reload the page for clean state
  const retryAuth = useCallback(() => {
    window.location.reload()
  }, [])

  // Toggle view mode (for admins to see team view)
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const newMode = prev === 'team' ? 'default' : 'team'
      safeLocalStorage.setItem('viewMode', newMode)
      return newMode
    })
  }, [])

  // Client preview mode (for admins to preview client portal)
  const [clientPreviewMode, setClientPreviewMode] = useState(false)
  const [previewClientId, setPreviewClientId] = useState(null)

  const startClientPreview = useCallback((clientId) => {
    setClientPreviewMode(true)
    setPreviewClientId(clientId || null)
  }, [])

  const toggleClientPreview = useCallback((clientId = null) => {
    setClientPreviewMode(prev => !prev)
    setPreviewClientId(clientId)
  }, [])

  const exitClientPreview = useCallback(() => {
    setClientPreviewMode(false)
    setPreviewClientId(null)
  }, [])

  // Admin emails that should always have admin access
  const ADMIN_EMAILS = [
    'justin@brandastic.com',
    'admin@brandastic.com',
  ]

  // Actual role from database
  const actualRole = profile?.role
  const userEmail = user?.email?.toLowerCase() || profile?.email?.toLowerCase()
  
  // Check if user is admin by role OR by email whitelist
  const isEmailAdmin = ADMIN_EMAILS.includes(userEmail)
  const isActualAdmin = actualRole === 'admin' || isEmailAdmin
  
  // Auto-update database if email is in admin list but role isn't set
  useEffect(() => {
    const autoSetAdmin = async () => {
      if (user && profile && isEmailAdmin && actualRole !== 'admin') {
        console.log('Auto-setting admin role for:', userEmail)
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id)
        
        // Refresh profile to get updated role
        const { data } = await getProfile(user.id)
        if (data) setProfile(data)
      }
    }
    autoSetAdmin()
  }, [user, profile, isEmailAdmin, actualRole])
  
  // Effective role (considering view mode toggle)
  const effectiveIsAdmin = isActualAdmin && viewMode !== 'team'
  
  // Force refresh the session - call this when data isn't loading
  const forceRefresh = useCallback(async () => {
    if (sessionRefreshing) return false
    
    setSessionRefreshing(true)
    setAuthError(null)
    
    try {
      // Use refreshSession() which handles token refresh properly
      const { data, error } = await supabase.auth.refreshSession()
      
      if (error) {
        console.error('[Auth] Force refresh error:', error)
        setSessionHealthy(false)
        setAuthError('Unable to refresh session. Please sign in again.')
        return false
      }
      
      if (data?.session?.user) {
        setUser(data.session.user)
        const { data: profileData } = await getProfile(data.session.user.id)
        if (profileData) {
          setProfile(profileData)
        }
        setSessionHealthy(true)
        return true
      }
      
      return false
    } catch (error) {
      console.error('[Auth] Force refresh error:', error)
      setAuthError('Session refresh failed. Please sign in again.')
      return false
    } finally {
      setSessionRefreshing(false)
    }
  }, [sessionRefreshing])
  
  const value = {
    user,
    profile,
    loading,
    authError,
    retryAuth,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    uploadAvatar,
    refreshProfile,
    justLoggedIn,
    profileSynced,
    clearLoginState,
    isTeam: actualRole === 'team' || actualRole === 'admin',
    isAdmin: effectiveIsAdmin, // Respects view mode toggle
    isActualAdmin, // Always true if user is actually admin
    isClient: actualRole === 'client',
    viewMode,
    toggleViewMode,
    // Client preview mode for admins
    clientPreviewMode,
    previewClientId,
    startClientPreview,
    toggleClientPreview,
    exitClientPreview,
    // Session health
    sessionRefreshing,
    sessionHealthy,
    forceRefresh,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
