import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase, getProfile, onSessionHealthChange, forceSessionRefresh, onTabSync } from '../lib/supabase'

const AuthContext = createContext({})

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
    return localStorage.getItem('viewMode') || 'default'
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
    // Safety timeout - if loading takes too long, show retry option
    const safetyTimeout = setTimeout(() => {
      console.warn('Auth loading timeout - forcing complete')
      setLoading(false)
    }, 8000) // 8 second max wait (increased for slow connections)

    // Get initial session
    const initAuth = async () => {
      try {
        // Use getUser() for secure server-side validation (recommended by Supabase)
        // This validates the JWT with Supabase servers, unlike getSession() which only reads local storage
        const { data: { user: validatedUser }, error } = await supabase.auth.getUser()
        
        if (error) {
          // AuthSessionMissingError is expected when not logged in, don't treat as error
          if (error.name !== 'AuthSessionMissingError') {
            console.error('Auth validation error:', error)
            setAuthError(error.message)
          }
          setLoading(false)
          clearTimeout(safetyTimeout)
          return
        }
        
        if (validatedUser) {
          console.log('User validated for:', validatedUser.email)
          setUser(validatedUser)
          
          // Fetch user profile - try multiple times if needed
          let profileData = null
          let retries = 0
          const maxRetries = 3
          
          while (!profileData && retries < maxRetries) {
            try {
              const { data, error: profileError } = await getProfile(validatedUser.id)
              if (data) {
                profileData = data
              } else if (profileError) {
                console.log(`Profile fetch attempt ${retries + 1} failed:`, profileError.message)
              }
              
              // If no profile exists, try to create one
              if (!profileData && retries === 0) {
                console.log('No profile found, attempting to create one...')
                const { error: createError } = await supabase
                  .from('profiles')
                  .upsert({
                    id: validatedUser.id,
                    email: validatedUser.email,
                    full_name: validatedUser.user_metadata?.full_name || 
                               validatedUser.user_metadata?.name || 
                               validatedUser.email?.split('@')[0] || 'User',
                    role: 'team',
                    avatar_url: validatedUser.user_metadata?.avatar_url || 
                                validatedUser.user_metadata?.picture || null,
                  }, { onConflict: 'id' })
                
                if (createError) {
                  console.error('Profile creation error:', createError.message)
                } else {
                  // Fetch the newly created profile
                  const { data: newProfile } = await getProfile(validatedUser.id)
                  if (newProfile) {
                    profileData = newProfile
                  }
                }
              }
            } catch (profileErr) {
              console.log(`Profile fetch attempt ${retries + 1} exception:`, profileErr)
            }
            retries++
            
            // Wait a bit before retrying
            if (!profileData && retries < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 500))
            }
          }
          
          if (profileData) {
            setProfile(profileData)
          } else {
            console.warn('Could not load profile after retries, continuing without profile')
            // Set a minimal profile so the app can still function
            setProfile({
              id: validatedUser.id,
              email: validatedUser.email,
              full_name: validatedUser.user_metadata?.full_name || validatedUser.email?.split('@')[0] || 'User',
              role: 'team',
            })
          }
        } else {
          console.log('No session found')
        }
      } catch (error) {
        console.error('Auth init error:', error)
        setAuthError(error.message)
      } finally {
        setLoading(false)
        clearTimeout(safetyTimeout)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        
        if (session?.user) {
          setUser(session.user)
          
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
        redirectTo: `${window.location.origin}/dashboard`,
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
      localStorage.removeItem('viewMode')
      
      // Call Supabase signOut with global scope to clear all sessions
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      
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

  // Minimal event listeners - Supabase's autoRefreshToken handles token refresh
  // We only refresh profile data, not auth, to avoid hammering Supabase
  useEffect(() => {
    // Only refresh profile when user comes back online after being offline
    const handleOnline = () => {
      console.log('[Auth] Back online')
      refreshSessionAndProfile('online')
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [refreshSessionAndProfile])

  // Retry auth (for when stuck on loading) - refreshes session and reloads
  const retryAuth = useCallback(async () => {
    setLoading(true)
    setAuthError(null)
    try {
      // Simple refresh using local session
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session?.user) {
        setUser(session.user)
        const { data: profileData } = await getProfile(session.user.id)
        setProfile(profileData)
        setSessionHealthy(true)
      }
    } catch (error) {
      setAuthError(error.message)
    } finally {
      setLoading(false)
    }
  }, [])

  // Toggle view mode (for admins to see team view)
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const newMode = prev === 'team' ? 'default' : 'team'
      localStorage.setItem('viewMode', newMode)
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
      const success = await forceSessionRefresh()
      
      if (success) {
        // Re-fetch user and profile after refresh
        const { data: { user: refreshedUser } } = await supabase.auth.getUser()
        if (refreshedUser) {
          setUser(refreshedUser)
          const { data: profileData } = await getProfile(refreshedUser.id)
          if (profileData) {
            setProfile(profileData)
          }
        }
        setSessionHealthy(true)
        return true
      } else {
        setSessionHealthy(false)
        setAuthError('Unable to refresh session. Please sign in again.')
        return false
      }
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
