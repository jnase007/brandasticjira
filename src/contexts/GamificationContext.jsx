import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import { 
  Trophy, Zap, Target, Flame, Star, Award, Crown, Rocket, 
  CheckCircle, Clock, MessageSquare, Users, TrendingUp, Calendar,
  Coffee, Moon, Sun, Sparkles, Heart, ThumbsUp, Medal
} from 'lucide-react'

const GamificationContext = createContext({})

// XP required for each level (exponential growth)
const LEVEL_XP = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000, 15000, 20000, 30000, 50000]

// Achievement definitions
const ACHIEVEMENTS = [
  // Getting Started
  { id: 'first_login', name: 'Welcome!', desc: 'Log in for the first time', icon: Star, xp: 10, category: 'starter' },
  { id: 'first_ticket', name: 'Task Master', desc: 'Create your first ticket', icon: CheckCircle, xp: 25, category: 'starter' },
  { id: 'first_complete', name: 'Done Deal', desc: 'Complete your first ticket', icon: Trophy, xp: 50, category: 'starter' },
  { id: 'first_time_log', name: 'Time Keeper', desc: 'Log time for the first time', icon: Clock, xp: 25, category: 'starter' },
  { id: 'first_comment', name: 'Communicator', desc: 'Leave your first comment', icon: MessageSquare, xp: 15, category: 'starter' },
  
  // Productivity
  { id: 'tickets_10', name: 'Getting Started', desc: 'Complete 10 tickets', icon: Target, xp: 100, category: 'productivity' },
  { id: 'tickets_50', name: 'Productive', desc: 'Complete 50 tickets', icon: Zap, xp: 250, category: 'productivity' },
  { id: 'tickets_100', name: 'Machine', desc: 'Complete 100 tickets', icon: Rocket, xp: 500, category: 'productivity' },
  { id: 'tickets_500', name: 'Legend', desc: 'Complete 500 tickets', icon: Crown, xp: 1000, category: 'productivity' },
  
  // Streaks
  { id: 'streak_3', name: 'On a Roll', desc: '3-day completion streak', icon: Flame, xp: 50, category: 'streaks' },
  { id: 'streak_7', name: 'Week Warrior', desc: '7-day completion streak', icon: Flame, xp: 150, category: 'streaks' },
  { id: 'streak_14', name: 'Unstoppable', desc: '14-day completion streak', icon: Flame, xp: 300, category: 'streaks' },
  { id: 'streak_30', name: 'On Fire!', desc: '30-day completion streak', icon: Flame, xp: 750, category: 'streaks' },
  
  // Time Tracking
  { id: 'hours_10', name: 'Clocking In', desc: 'Log 10 hours total', icon: Clock, xp: 50, category: 'time' },
  { id: 'hours_50', name: 'Dedicated', desc: 'Log 50 hours total', icon: Clock, xp: 150, category: 'time' },
  { id: 'hours_100', name: 'Committed', desc: 'Log 100 hours total', icon: Clock, xp: 300, category: 'time' },
  { id: 'hours_500', name: 'Time Lord', desc: 'Log 500 hours total', icon: Clock, xp: 750, category: 'time' },
  
  // Social
  { id: 'comments_10', name: 'Chatty', desc: 'Leave 10 comments', icon: MessageSquare, xp: 50, category: 'social' },
  { id: 'comments_50', name: 'Collaborator', desc: 'Leave 50 comments', icon: MessageSquare, xp: 150, category: 'social' },
  { id: 'help_teammate', name: 'Team Player', desc: 'Complete a ticket assigned to someone else', icon: Users, xp: 75, category: 'social' },
  
  // Special
  { id: 'early_bird', name: 'Early Bird', desc: 'Complete a ticket before 7 AM', icon: Sun, xp: 50, category: 'special' },
  { id: 'night_owl', name: 'Night Owl', desc: 'Complete a ticket after 10 PM', icon: Moon, xp: 50, category: 'special' },
  { id: 'speed_demon', name: 'Speed Demon', desc: 'Complete a ticket in under 5 minutes', icon: Zap, xp: 100, category: 'special' },
  { id: 'perfectionist', name: 'Perfectionist', desc: 'Complete 10 tickets without reopening any', icon: Award, xp: 200, category: 'special' },
  { id: 'marathon', name: 'Marathon', desc: 'Log 8+ hours in a single day', icon: Coffee, xp: 150, category: 'special' },
]

// Rank titles based on level
const RANKS = [
  { level: 1, title: 'Rookie', color: '#6B7280' },
  { level: 3, title: 'Associate', color: '#10B981' },
  { level: 5, title: 'Specialist', color: '#3B82F6' },
  { level: 7, title: 'Expert', color: '#8B5CF6' },
  { level: 10, title: 'Master', color: '#F59E0B' },
  { level: 12, title: 'Champion', color: '#EF4444' },
  { level: 15, title: 'Legend', color: '#EC4899' },
]

export function useGamification() {
  const context = useContext(GamificationContext)
  if (!context) {
    throw new Error('useGamification must be used within a GamificationProvider')
  }
  return context
}

export function GamificationProvider({ children }) {
  const { user, profile } = useAuth()
  const [stats, setStats] = useState({
    xp: 0,
    level: 1,
    ticketsCompleted: 0,
    hoursLogged: 0,
    commentsCount: 0,
    currentStreak: 0,
    longestStreak: 0,
    achievements: [],
  })
  const [showAchievement, setShowAchievement] = useState(null)
  const [showLevelUp, setShowLevelUp] = useState(null)
  const [loading, setLoading] = useState(true)

  // Calculate level from XP
  const getLevel = (xp) => {
    for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
      if (xp >= LEVEL_XP[i]) return i + 1
    }
    return 1
  }

  // Get XP progress within current level
  const getLevelProgress = (xp) => {
    const level = getLevel(xp)
    const currentLevelXP = LEVEL_XP[level - 1] || 0
    const nextLevelXP = LEVEL_XP[level] || LEVEL_XP[LEVEL_XP.length - 1]
    const progress = ((xp - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100
    return Math.min(100, Math.max(0, progress))
  }

  // Get rank based on level
  const getRank = (level) => {
    for (let i = RANKS.length - 1; i >= 0; i--) {
      if (level >= RANKS[i].level) return RANKS[i]
    }
    return RANKS[0]
  }

  // Fetch user stats
  const fetchStats = useCallback(async () => {
    if (!user) return

    try {
      // Get user's gamification data
      const { data: gamData } = await supabase
        .from('user_gamification')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (gamData) {
        setStats({
          xp: gamData.xp || 0,
          level: getLevel(gamData.xp || 0),
          ticketsCompleted: gamData.tickets_completed || 0,
          hoursLogged: gamData.hours_logged || 0,
          commentsCount: gamData.comments_count || 0,
          currentStreak: gamData.current_streak || 0,
          longestStreak: gamData.longest_streak || 0,
          achievements: gamData.achievements || [],
        })
      }
    } catch (error) {
      // Table might not exist yet, that's ok
      console.log('Gamification not initialized yet')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Award XP
  const awardXP = useCallback(async (amount, reason) => {
    if (!user) return

    const newXP = stats.xp + amount
    const oldLevel = stats.level
    const newLevel = getLevel(newXP)

    // Check for level up
    if (newLevel > oldLevel) {
      setShowLevelUp({ oldLevel, newLevel, rank: getRank(newLevel) })
      setTimeout(() => setShowLevelUp(null), 4000)
    }

    setStats(prev => ({ ...prev, xp: newXP, level: newLevel }))

    // Update in database
    try {
      await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          xp: newXP,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error saving XP:', error)
    }
  }, [user, stats])

  // Unlock achievement
  const unlockAchievement = useCallback(async (achievementId) => {
    if (!user) return
    if (stats.achievements.includes(achievementId)) return // Already unlocked

    const achievement = ACHIEVEMENTS.find(a => a.id === achievementId)
    if (!achievement) return

    const newAchievements = [...stats.achievements, achievementId]
    
    // Show achievement popup
    setShowAchievement(achievement)
    setTimeout(() => setShowAchievement(null), 4000)

    // Award XP
    await awardXP(achievement.xp, `Achievement: ${achievement.name}`)

    setStats(prev => ({ ...prev, achievements: newAchievements }))

    // Update in database
    try {
      await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          achievements: newAchievements,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error saving achievement:', error)
    }
  }, [user, stats, awardXP])

  // Track ticket completion
  const trackTicketComplete = useCallback(async () => {
    const newCount = stats.ticketsCompleted + 1
    setStats(prev => ({ ...prev, ticketsCompleted: newCount }))

    // Award base XP
    await awardXP(10, 'Completed ticket')

    // Check for first ticket
    if (newCount === 1) await unlockAchievement('first_complete')

    // Check milestone achievements
    if (newCount === 10) await unlockAchievement('tickets_10')
    if (newCount === 50) await unlockAchievement('tickets_50')
    if (newCount === 100) await unlockAchievement('tickets_100')
    if (newCount === 500) await unlockAchievement('tickets_500')

    // Check time-based achievements
    const hour = new Date().getHours()
    if (hour < 7) await unlockAchievement('early_bird')
    if (hour >= 22) await unlockAchievement('night_owl')

    // Update database
    try {
      await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          tickets_completed: newCount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error tracking ticket:', error)
    }
  }, [user, stats, awardXP, unlockAchievement])

  // Track time logged
  const trackTimeLogged = useCallback(async (minutes) => {
    const hours = minutes / 60
    const newTotal = stats.hoursLogged + hours
    setStats(prev => ({ ...prev, hoursLogged: newTotal }))

    // Award XP (1 XP per 5 minutes)
    await awardXP(Math.floor(minutes / 5), 'Time logged')

    // Check for first time log
    if (stats.hoursLogged === 0) await unlockAchievement('first_time_log')

    // Check milestone achievements
    if (newTotal >= 10 && stats.hoursLogged < 10) await unlockAchievement('hours_10')
    if (newTotal >= 50 && stats.hoursLogged < 50) await unlockAchievement('hours_50')
    if (newTotal >= 100 && stats.hoursLogged < 100) await unlockAchievement('hours_100')
    if (newTotal >= 500 && stats.hoursLogged < 500) await unlockAchievement('hours_500')

    // Check marathon achievement (8+ hours in a day)
    if (hours >= 8) await unlockAchievement('marathon')

    // Update database
    try {
      await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          hours_logged: newTotal,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error tracking time:', error)
    }
  }, [user, stats, awardXP, unlockAchievement])

  // Track comment
  const trackComment = useCallback(async () => {
    const newCount = stats.commentsCount + 1
    setStats(prev => ({ ...prev, commentsCount: newCount }))

    // Award XP
    await awardXP(5, 'Comment added')

    // Check first comment
    if (newCount === 1) await unlockAchievement('first_comment')

    // Check milestones
    if (newCount === 10) await unlockAchievement('comments_10')
    if (newCount === 50) await unlockAchievement('comments_50')

    // Update database
    try {
      await supabase
        .from('user_gamification')
        .upsert({
          user_id: user.id,
          comments_count: newCount,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
    } catch (error) {
      console.error('Error tracking comment:', error)
    }
  }, [user, stats, awardXP, unlockAchievement])

  const value = {
    stats,
    loading,
    achievements: ACHIEVEMENTS,
    ranks: RANKS,
    getLevel,
    getLevelProgress,
    getRank,
    awardXP,
    unlockAchievement,
    trackTicketComplete,
    trackTimeLogged,
    trackComment,
    refreshStats: fetchStats,
  }

  return (
    <GamificationContext.Provider value={value}>
      {children}

      {/* Achievement Popup */}
      <AnimatePresence>
        {showAchievement && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.8 }}
            className="fixed bottom-8 right-8 z-[100] pointer-events-none"
          >
            <div className="bg-gradient-to-r from-brand-purple to-brand-blue p-1 rounded-2xl shadow-2xl">
              <div className="bg-background rounded-xl p-4 flex items-center gap-4">
                <motion.div
                  initial={{ rotate: -180, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center"
                >
                  <showAchievement.icon className="h-7 w-7 text-white" />
                </motion.div>
                <div>
                  <p className="text-xs text-brand-purple font-semibold uppercase tracking-wide">
                    Achievement Unlocked!
                  </p>
                  <p className="font-bold text-lg">{showAchievement.name}</p>
                  <p className="text-sm text-muted-foreground">{showAchievement.desc}</p>
                </div>
                <div className="text-right">
                  <motion.p
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: 'spring' }}
                    className="text-2xl font-bold text-brand-orange"
                  >
                    +{showAchievement.xp}
                  </motion.p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level Up Popup */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 10 }}
              transition={{ type: 'spring', damping: 15 }}
              className="text-center p-8"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: showLevelUp.rank.color }}
              >
                <Crown className="h-16 w-16 text-white" />
              </motion.div>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-white/80 text-lg mb-2"
              >
                LEVEL UP!
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white text-5xl font-bold mb-2"
              >
                Level {showLevelUp.newLevel}
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-2xl font-semibold"
                style={{ color: showLevelUp.rank.color }}
              >
                {showLevelUp.rank.title}
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </GamificationContext.Provider>
  )
}
