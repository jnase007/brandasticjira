import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  User, Bell, Shield, Palette, Save, Upload, Camera, Check, 
  Sparkles, Mail, Clock, Calendar, Trophy, X, Loader2,
  Sun, Moon, Monitor
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useGamification } from '../contexts/GamificationContext'
import { cn, getInitials, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import { useToast } from '../hooks/useToast'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Settings() {
  const { user, profile, updateUserProfile, uploadAvatar, justLoggedIn, profileSynced, clearLoginState } = useAuth()
  const { stats, getRank, getLevelProgress, achievements } = useGamification()
  const { toast } = useToast()
  const fileInputRef = useRef(null)

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [tagline, setTagline] = useState(profile?.tagline || '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  
  // Theme state
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'system'
  })

  // Show welcome toast when profile is synced from Google
  useEffect(() => {
    if (justLoggedIn && profileSynced && profile) {
      setShowWelcome(true)
      toast({
        title: '👋 Welcome!',
        description: `Your profile has been synced from Google. Looking good, ${profile.full_name?.split(' ')[0]}!`,
        variant: 'success',
      })
      
      // Clear the login state after showing
      setTimeout(() => {
        clearLoginState()
        setShowWelcome(false)
      }, 3000)
    }
  }, [justLoggedIn, profileSynced, profile, clearLoginState, toast])

  // Sync profile data when it loads
  useEffect(() => {
    if (profile?.full_name) {
      setFullName(profile.full_name)
    }
    if (profile?.tagline !== undefined) {
      setTagline(profile.tagline || '')
    }
  }, [profile])

  // Apply theme when it changes
  useEffect(() => {
    const applyTheme = (themeName) => {
      const root = document.documentElement
      
      if (themeName === 'system') {
        // Check system preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        if (prefersDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
      } else if (themeName === 'dark') {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)

    // Listen for system theme changes when in system mode
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const handleChange = () => applyTheme('system')
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  // Handle theme change
  const handleThemeChange = (newTheme) => {
    setTheme(newTheme)
    toast({
      title: `🎨 Theme updated`,
      description: `Switched to ${newTheme === 'system' ? 'system' : newTheme} mode`,
    })
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const { error } = await updateUserProfile({ 
        full_name: fullName,
        tagline: tagline 
      })
      if (error) throw error

      toast({
        title: '✅ Profile updated',
        description: 'Your changes have been saved successfully.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please select an image file.',
        variant: 'destructive',
      })
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 2MB.',
        variant: 'destructive',
      })
      return
    }

    setUploadingAvatar(true)
    try {
      const { error, url } = await uploadAvatar(file)
      if (error) throw error

      toast({
        title: '📸 Avatar updated!',
        description: 'Your new profile picture looks great!',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        description: 'Could not upload your avatar. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const rank = getRank(stats?.level || 1)
  const progress = getLevelProgress(stats?.xp || 0)
  const unlockedAchievements = stats?.achievements?.length || 0
  const totalAchievements = achievements?.length || 0

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 max-w-4xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-3xl font-display font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </motion.div>

      {/* Profile Synced Banner */}
      <AnimatePresence>
        {showWelcome && profile && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-r from-green-500/10 to-emerald-500/5 border-green-500/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-green-700 dark:text-green-400">
                    Profile synced from Google!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Your name and picture have been imported. You can update them anytime.
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setShowWelcome(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="stats">
            <Trophy className="mr-2 h-4 w-4" />
            Stats
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <motion.div variants={itemVariants} className="space-y-6">
            {/* Profile Card */}
            <Card className="overflow-hidden">
              {/* Header Banner */}
              <div className="h-24 bg-gradient-to-r from-brand-orange via-brand-coral to-brand-purple relative">
                <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
              </div>
              
              <CardContent className="relative pt-0 pb-6 px-6">
                {/* Avatar Section */}
                <div className="flex flex-col sm:flex-row items-start gap-6">
                  <div className="-mt-12 relative group">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      className="hidden"
                    />
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAvatarClick}
                      className="relative cursor-pointer"
                    >
                      <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="text-3xl bg-brand-orange text-white">
                          {getInitials(profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Upload Overlay */}
                      <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        {uploadingAvatar ? (
                          <Loader2 className="h-8 w-8 text-white animate-spin" />
                        ) : (
                          <Camera className="h-8 w-8 text-white" />
                        )}
                      </div>
                      
                      {/* Online indicator */}
                      <div className="absolute bottom-1 right-1 w-5 h-5 bg-green-500 border-2 border-background rounded-full" />
                    </motion.div>
                    <p className="text-xs text-center text-muted-foreground mt-2">
                      Click to change
                    </p>
                  </div>

                  <div className="flex-1 pt-2 sm:pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold">{profile?.full_name || 'Your Name'}</h2>
                        {profile?.tagline && (
                          <p className="text-sm text-muted-foreground italic mt-0.5">
                            "{profile.tagline}"
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{profile?.email}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                          <Badge 
                            className="capitalize"
                            style={{ backgroundColor: rank?.color || '#F7931E' }}
                          >
                            {rank?.title || 'Rookie'} • Level {stats?.level || 1}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {profile?.role || 'team'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile Form */}
            <Card>
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
                <CardDescription>
                  Update your personal information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="email"
                        value={profile?.email || ''}
                        disabled
                        className="pr-10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Check className="h-4 w-4 text-green-500" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verified via Google
                    </p>
                  </div>
                </div>

                <div>
                  <Label htmlFor="tagline">Tagline / Fun Quote ✨</Label>
                  <Input
                    id="tagline"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    placeholder="e.g., Coffee-powered marketing wizard ☕"
                    className="mt-1.5"
                    maxLength={100}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    A fun line that shows up on your profile ({tagline.length}/100)
                  </p>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-brand-blue" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Member since</p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.created_at ? formatDate(profile.created_at) : 'Recently joined'}
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={handleSaveProfile} 
                    disabled={saving || (fullName === profile?.full_name && tagline === (profile?.tagline || ''))}
                    className="min-w-[140px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats">
          <motion.div variants={itemVariants} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Your Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Level Progress */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-brand-orange/10 to-brand-coral/5 border border-brand-orange/20">
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        className="w-16 h-16 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                        style={{ backgroundColor: rank?.color || '#F7931E' }}
                      >
                        {stats?.level || 1}
                      </div>
                      <div>
                        <p className="font-bold text-lg">{rank?.title || 'Rookie'}</p>
                        <p className="text-sm text-muted-foreground">
                          {(stats?.xp || 0).toLocaleString()} XP Total
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress to Level {(stats?.level || 1) + 1}</span>
                        <span className="font-medium">{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  </div>

                  {/* Achievements */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-orange-500/5 border border-yellow-500/20">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold">Achievements</h4>
                      <Badge variant="outline">
                        {unlockedAchievements}/{totalAchievements}
                      </Badge>
                    </div>
                    <Progress 
                      value={(unlockedAchievements / totalAchievements) * 100} 
                      className="h-2 mb-4" 
                    />
                    <div className="flex flex-wrap gap-2">
                      {stats?.achievements?.slice(0, 6).map((achId) => {
                        const ach = achievements?.find(a => a.id === achId)
                        if (!ach) return null
                        return (
                          <div
                            key={achId}
                            className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                            title={ach.name}
                          >
                            <ach.icon className="h-4 w-4 text-white" />
                          </div>
                        )
                      })}
                      {unlockedAchievements > 6 && (
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-xs font-medium">
                          +{unlockedAchievements - 6}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats?.ticketsCompleted || 0}</p>
                    <p className="text-sm text-muted-foreground">Tickets Completed</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{Math.round(stats?.hoursLogged || 0)}</p>
                    <p className="text-sm text-muted-foreground">Hours Logged</p>
                  </div>
                  <div className="text-center p-4 rounded-lg bg-muted/50">
                    <p className="text-3xl font-bold">{stats?.currentStreak || 0}</p>
                    <p className="text-sm text-muted-foreground">Day Streak 🔥</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Choose what notifications you want to receive
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { 
                      label: 'Email notifications for new tickets', 
                      desc: 'Get notified when tickets are assigned to you',
                      default: true
                    },
                    { 
                      label: 'Email notifications for comments', 
                      desc: 'Get notified when someone comments on your tickets',
                      default: true
                    },
                    { 
                      label: 'Achievement notifications', 
                      desc: 'Get notified when you unlock new achievements',
                      default: true
                    },
                    { 
                      label: 'Weekly summary', 
                      desc: 'Receive a weekly summary of your activity',
                      default: false
                    },
                  ].map((item, index) => (
                    <div key={index} className="flex items-start justify-between p-4 rounded-lg border">
                      <div>
                        <p className="font-medium text-sm">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked={item.default} />
                        <div className="w-11 h-6 bg-muted peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-orange"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Appearance Tab */}
        <TabsContent value="appearance">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                  Customize how Brandastic PM looks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <Label className="mb-3 block">Theme</Label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { id: 'light', label: 'Light', icon: Sun, bg: 'bg-white', preview: 'bg-gray-100' },
                        { id: 'dark', label: 'Dark', icon: Moon, bg: 'bg-gray-900', preview: 'bg-gray-800' },
                        { id: 'system', label: 'System', icon: Monitor, bg: 'bg-gradient-to-r from-white to-gray-900', preview: 'bg-gradient-to-r from-gray-100 to-gray-800' },
                      ].map((themeOption) => (
                        <button
                          key={themeOption.id}
                          onClick={() => handleThemeChange(themeOption.id)}
                          className={cn(
                            "p-4 rounded-xl border-2 text-center transition-all hover:border-brand-orange/50 hover:shadow-lg group",
                            theme === themeOption.id 
                              ? "border-brand-orange bg-brand-orange/5 shadow-md" 
                              : "border-border"
                          )}
                        >
                          <div className={cn(
                            "w-full h-14 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden",
                            themeOption.bg
                          )}>
                            <themeOption.icon className={cn(
                              "h-6 w-6 relative z-10",
                              themeOption.id === 'light' ? 'text-yellow-500' : 
                              themeOption.id === 'dark' ? 'text-blue-400' : 'text-purple-500'
                            )} />
                            {theme === themeOption.id && (
                              <motion.div
                                layoutId="themeCheck"
                                className="absolute top-1 right-1 w-5 h-5 bg-brand-orange rounded-full flex items-center justify-center"
                              >
                                <Check className="h-3 w-3 text-white" />
                              </motion.div>
                            )}
                          </div>
                          <span className={cn(
                            "text-sm font-medium",
                            theme === themeOption.id && "text-brand-orange"
                          )}>
                            {themeOption.label}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">
                      {theme === 'system' 
                        ? '🖥️ Following your system preference' 
                        : theme === 'dark' 
                          ? '🌙 Dark mode is easier on the eyes' 
                          : '☀️ Light mode for bright workspaces'}
                    </p>
                  </div>

                  {/* Keyboard Shortcut hint */}
                  <div className="p-4 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-brand-orange/10">
                        <Palette className="h-5 w-5 text-brand-orange" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">Quick Toggle</p>
                        <p className="text-xs text-muted-foreground">
                          Press <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⌘</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">⇧</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs font-mono">D</kbd> to toggle dark mode
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
