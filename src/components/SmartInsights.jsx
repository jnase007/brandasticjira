import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles, TrendingUp, TrendingDown, Clock, Target,
  Users, Zap, Award, AlertTriangle, CheckCircle,
  ArrowRight, Lightbulb, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

const INSIGHT_TYPES = {
  productivity: { icon: TrendingUp, color: 'text-green-500', bg: 'from-green-500/10 to-emerald-500/5' },
  warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'from-yellow-500/10 to-orange-500/5' },
  achievement: { icon: Award, color: 'text-purple-500', bg: 'from-purple-500/10 to-pink-500/5' },
  tip: { icon: Lightbulb, color: 'text-blue-500', bg: 'from-blue-500/10 to-cyan-500/5' },
  milestone: { icon: Target, color: 'text-brand-orange', bg: 'from-brand-orange/10 to-yellow-500/5' },
}

export function SmartInsights() {
  const { user, profile } = useAuth()
  const [insights, setInsights] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const generateInsights = async () => {
      if (!user) return
      
      const insightsList = []
      
      try {
        // Get user's stats - use maybeSingle to avoid errors when data doesn't exist
        const [ticketsRes, timeRes, streakRes] = await Promise.all([
          supabase
            .from('tickets')
            .select('status, created_at')
            .eq('assigned_to', user.id)
            .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('time_entries')
            .select('duration_minutes')
            .eq('user_id', user.id)
            .gte('start_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase
            .from('user_gamification_stats')
            .select('current_streak, total_xp')
            .eq('user_id', user.id)
            .maybeSingle(), // Use maybeSingle to avoid throwing when no row found
        ])

        const tickets = ticketsRes.data || []
        const timeEntries = timeRes.data || []
        const stats = streakRes.data

        const completedTickets = tickets.filter(t => t.status === 'done').length
        const totalHours = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) / 60

        // Productivity insight
        if (completedTickets > 0) {
          insightsList.push({
            type: 'productivity',
            title: `${completedTickets} tasks completed`,
            description: 'Great momentum this month! Keep crushing it.',
            metric: `${completedTickets}`,
            metricLabel: 'completed',
          })
        }

        // Time tracking insight
        if (totalHours > 0) {
          insightsList.push({
            type: 'milestone',
            title: `${Math.round(totalHours)}h logged this week`,
            description: 'Your time tracking helps optimize team performance.',
            metric: Math.round(totalHours),
            metricLabel: 'hours',
          })
        }

        // Streak insight
        if (stats?.current_streak > 0) {
          insightsList.push({
            type: 'achievement',
            title: `${stats.current_streak} day streak! 🔥`,
            description: 'You\'re on fire! Keep the momentum going.',
            metric: stats.current_streak,
            metricLabel: 'days',
          })
        }

        // XP milestone
        if (stats?.total_xp > 0) {
          const level = Math.floor(stats.total_xp / 1000) + 1
          insightsList.push({
            type: 'achievement',
            title: `Level ${level} achieved`,
            description: `You've earned ${stats.total_xp.toLocaleString()} XP total!`,
            metric: level,
            metricLabel: 'level',
          })
        }

        // Pro tips
        const tips = [
          {
            type: 'tip',
            title: 'Quick tip: Keyboard shortcuts',
            description: 'Press ? anywhere to see all shortcuts. T starts timer!',
          },
          {
            type: 'tip',
            title: 'Focus Mode available',
            description: 'Press F to enter distraction-free focus mode.',
          },
          {
            type: 'tip',
            title: 'Team kudos boost morale',
            description: 'Give kudos to recognize great work from teammates!',
          },
          {
            type: 'tip',
            title: 'Set weekly goals',
            description: 'Track your personal goals to stay focused.',
          },
        ]

        // Add a random tip
        insightsList.push(tips[Math.floor(Math.random() * tips.length)])

        // If no data, show welcome insight
        if (insightsList.length === 0) {
          insightsList.push({
            type: 'tip',
            title: 'Welcome to Brandastic! 👋',
            description: 'Start by tracking time or completing tasks to see your insights.',
          })
        }

        setInsights(insightsList)
      } catch (error) {
        console.error('Error generating insights:', error)
      } finally {
        setLoading(false)
      }
    }

    generateInsights()
  }, [user])

  // Auto-rotate insights
  useEffect(() => {
    if (insights.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % insights.length)
    }, 8000)
    
    return () => clearInterval(interval)
  }, [insights.length])

  const goToPrev = () => {
    setCurrentIndex(prev => prev === 0 ? insights.length - 1 : prev - 1)
  }

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % insights.length)
  }

  if (loading) {
    return (
      <div className="h-28 rounded-2xl bg-muted animate-pulse" />
    )
  }

  if (insights.length === 0) return null

  const currentInsight = insights[currentIndex]
  const config = INSIGHT_TYPES[currentInsight.type] || INSIGHT_TYPES.tip
  const Icon = config.icon

  return (
    <div className={cn(
      "relative rounded-2xl p-4 bg-gradient-to-br border overflow-hidden",
      config.bg
    )}>
      {/* Decorative sparkle */}
      <Sparkles className="absolute top-3 right-3 h-5 w-5 text-muted-foreground/20" />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="flex items-start gap-4"
        >
          <div className={cn("p-2.5 rounded-xl bg-background/50 flex-shrink-0")}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">{currentInsight.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {currentInsight.description}
            </p>
          </div>

          {currentInsight.metric && (
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold">{currentInsight.metric}</div>
              <div className="text-xs text-muted-foreground">{currentInsight.metricLabel}</div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation dots */}
      {insights.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {insights.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                i === currentIndex 
                  ? "bg-foreground w-4" 
                  : "bg-foreground/20 hover:bg-foreground/40"
              )}
            />
          ))}
        </div>
      )}

      {/* Navigation arrows (hover) */}
      {insights.length > 1 && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/50 opacity-0 hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-full bg-background/50 opacity-0 hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

export default SmartInsights
