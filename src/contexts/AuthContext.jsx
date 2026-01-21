import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, getProfile } from '../lib/supabase'

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

  useEffect(() => {
    // Get initial session
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user) {
          setUser(session.user)
          // Fetch user profile
          const { data: profileData } = await getProfile(session.user.id)
          setProfile(profileData)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        setLoading(false)
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
      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single()
      
      if (!existingProfile) {
        // Create new profile
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: metadata.full_name || user.user_metadata?.full_name || '',
            role: 'team', // Default role
            avatar_url: user.user_metadata?.avatar_url || null,
          })
        
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
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setProfile(null)
    }
    return { error }
  }

  // Update profile
  const updateUserProfile = async (updates) => {
    if (!user) return { error: new Error('Not authenticated') }
    
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single()

    if (data) {
      setProfile(data)
    }
    return { data, error }
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

  const value = {
    user,
    profile,
    loading,
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
    isTeam: profile?.role === 'team' || profile?.role === 'admin',
    isAdmin: profile?.role === 'admin',
    isClient: profile?.role === 'client',
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
