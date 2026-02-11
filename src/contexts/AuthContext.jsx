import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

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

  // View mode toggle (admin can switch between admin and team view)
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('viewMode') || 'default'
  })

  // Client preview mode (for admins to preview client portal)
  const [clientPreviewMode, setClientPreviewMode] = useState(false)
  const [previewClientId, setPreviewClientId] = useState(null)

  // Fetch profile helper
  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (data) {
        setProfile(data)
        return data
      }
      return null
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }

  // Create profile if it doesn't exist (for new OAuth users)
  const createProfileIfNeeded = async (user) => {
    if (!user) return null

    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle()

    if (existing) {
      return fetchProfile(user.id)
    }

    // Create new profile
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || 
                   user.user_metadata?.name || 
                   user.email?.split('@')[0] || 'User',
        role: 'team',
        avatar_url: user.user_metadata?.avatar_url || 
                    user.user_metadata?.picture || null,
      }, { onConflict: 'id' })

    if (error) {
      console.error('Error creating profile:', error)
    }

    return fetchProfile(user.id)
  }

  // Initialize auth - simple and clean
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()

        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          await createProfileIfNeeded(session.user)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes - this is the single source of truth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] Event:', event)

        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          
          // On sign in, ensure profile exists
          if (event === 'SIGNED_IN') {
            await createProfileIfNeeded(session.user)
          } else {
            await fetchProfile(session.user.id)
          }
        } else {
          setUser(null)
          setProfile(null)
        }

        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Sign in with Google (primary auth method for team)
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
      setUser(null)
      setProfile(null)
      localStorage.removeItem('viewMode')
      
      const { error } = await supabase.auth.signOut({ scope: 'global' })
      return { error }
    } catch (err) {
      console.error('Sign out error:', err)
      return { error: err }
    }
  }

  // Update profile
  const updateUserProfile = async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }

    try {
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, v]) => v !== undefined)
      )

      if (Object.keys(cleanUpdates).length === 0) {
        return { data: profile, error: null }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({ ...cleanUpdates, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()

      if (data && data.length > 0) {
        setProfile(data[0])
        return { data: data[0], error: null }
      }

      return { data: null, error }
    } catch (err) {
      console.error('Profile update error:', err)
      return { data: null, error: err }
    }
  }

  // Upload avatar
  const uploadAvatar = async (file) => {
    if (!user) return { error: new Error('Not authenticated') }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const filePath = `avatars/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath)

      const { data, error } = await updateUserProfile({ avatar_url: publicUrl })
      return { data, error, url: publicUrl }
    } catch (error) {
      console.error('Avatar upload error:', error)
      return { error }
    }
  }

  // Refresh profile
  const refreshProfile = async () => {
    if (!user) return
    await fetchProfile(user.id)
  }

  // Toggle view mode (for admins to see team view)
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => {
      const newMode = prev === 'team' ? 'default' : 'team'
      localStorage.setItem('viewMode', newMode)
      return newMode
    })
  }, [])

  // Client preview mode functions
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

  // Admin emails whitelist
  const ADMIN_EMAILS = [
    'justin@brandastic.com',
    'admin@brandastic.com',
  ]

  // Role calculations
  const actualRole = profile?.role
  const userEmail = user?.email?.toLowerCase() || profile?.email?.toLowerCase()
  const isEmailAdmin = ADMIN_EMAILS.includes(userEmail)
  const isActualAdmin = actualRole === 'admin' || isEmailAdmin

  // Auto-set admin role if email is in whitelist
  useEffect(() => {
    const autoSetAdmin = async () => {
      if (user && profile && isEmailAdmin && actualRole !== 'admin') {
        console.log('Auto-setting admin role for:', userEmail)
        await supabase
          .from('profiles')
          .update({ role: 'admin' })
          .eq('id', user.id)
        await fetchProfile(user.id)
      }
    }
    autoSetAdmin()
  }, [user, profile, isEmailAdmin, actualRole, userEmail])

  // Effective role (considering view mode toggle)
  const effectiveIsAdmin = isActualAdmin && viewMode !== 'team'

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    updateUserProfile,
    uploadAvatar,
    refreshProfile,
    // Role helpers
    isTeam: actualRole === 'team' || actualRole === 'admin',
    isAdmin: effectiveIsAdmin,
    isActualAdmin,
    isClient: actualRole === 'client',
    // View mode
    viewMode,
    toggleViewMode,
    // Client preview
    clientPreviewMode,
    previewClientId,
    startClientPreview,
    toggleClientPreview,
    exitClientPreview,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
