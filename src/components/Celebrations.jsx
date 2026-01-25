import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Cake, PartyPopper, Gift, Star, Sparkles, X,
  Calendar, Trophy, Crown, Heart, Flame, Award,
  ChevronRight, Bell, Users,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { useConfetti } from './Confetti'

// Celebration emojis and messages
const BIRTHDAY_MESSAGES = [
  "🎂 Happy Birthday! Time to party!",
  "🎉 It's your special day! Celebrate big!",
  "🥳 Another year of awesomeness!",
  "🎈 Birthday vibes only today!",
  "🍰 Cake time! Happy Birthday!",
]

const ANNIVERSARY_MESSAGES = [
  "🎊 Happy Work Anniversary!",
  "🏆 Another amazing year with the team!",
  "⭐ Celebrating your journey with us!",
  "🚀 Here's to another great year!",
  "💪 Thank you for being awesome!",
]

const ANNIVERSARY_MILESTONES = {
  1: { emoji: '🥉', title: 'Bronze Year', color: 'text-amber-600' },
  2: { emoji: '🥈', title: 'Silver Start', color: 'text-gray-400' },
  3: { emoji: '🥇', title: 'Gold Member', color: 'text-yellow-500' },
  5: { emoji: '💎', title: 'Diamond Team', color: 'text-cyan-400' },
  10: { emoji: '👑', title: 'Decade Legend', color: 'text-purple-500' },
}

// Main celebration banner that shows when someone has a birthday/anniversary today
export function CelebrationBanner() {
  const { user } = useAuth()
  const { fire: fireConfetti } = useConfetti()
  const [celebrations, setCelebrations] = useState([])
  const [dismissed, setDismissed] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTodayCelebrations = async () => {
      // Check localStorage for dismissed celebrations today
      const today = new Date().toDateString()
      const dismissedKey = `dismissed_celebrations_${today}`
      let dismissedList = []
      try {
        dismissedList = JSON.parse(localStorage.getItem(dismissedKey) || '[]')
      } catch (e) {
        console.warn('Invalid dismissed celebrations data, resetting...')
        localStorage.removeItem(dismissedKey)
      }
      setDismissed(dismissedList)

      const { data, error } = await supabase
        .from('upcoming_celebrations')
        .select('*')
        .or('is_birthday_today.eq.true,is_anniversary_today.eq.true')

      if (error) {
        console.log('Celebrations view not ready:', error.message)
        // View might not exist yet, that's okay
      }
      
      setCelebrations(data || [])
      setLoading(false)

      // Fire confetti if there are celebrations!
      if (data && data.length > 0 && dismissedList.length === 0) {
        setTimeout(() => fireConfetti(), 500)
      }
    }

    fetchTodayCelebrations()
  }, [user])

  const dismissCelebration = (userId) => {
    const today = new Date().toDateString()
    const dismissedKey = `dismissed_celebrations_${today}`
    const newDismissed = [...dismissed, userId]
    localStorage.setItem(dismissedKey, JSON.stringify(newDismissed))
    setDismissed(newDismissed)
  }

  const activeCelebrations = celebrations.filter(c => !dismissed.includes(c.user_id))

  if (loading || activeCelebrations.length === 0) return null

  return (
    <AnimatePresence>
      {activeCelebrations.map((celebration, index) => (
        <motion.div
          key={celebration.user_id}
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.9 }}
          transition={{ delay: index * 0.1 }}
          className={cn(
            "relative overflow-hidden rounded-2xl p-6 mb-4",
            celebration.is_birthday_today 
              ? "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"
              : "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"
          )}
        >
          {/* Animated background elements */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: '100%', x: Math.random() * 100 + '%' }}
                animate={{ 
                  y: '-100%',
                  rotate: Math.random() * 360,
                }}
                transition={{
                  duration: 3 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
                className="absolute text-2xl"
                style={{ left: `${Math.random() * 100}%` }}
              >
                {celebration.is_birthday_today 
                  ? ['🎂', '🎈', '🎁', '🎉', '⭐', '✨'][Math.floor(Math.random() * 6)]
                  : ['🏆', '⭐', '🎊', '💎', '🚀', '✨'][Math.floor(Math.random() * 6)]}
              </motion.div>
            ))}
          </div>

          <div className="relative z-10 flex items-center gap-6">
            {/* Avatar with glow */}
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="relative"
            >
              <div className="absolute inset-0 bg-white/30 rounded-full blur-xl" />
              <Avatar className="h-20 w-20 border-4 border-white shadow-2xl">
                <AvatarImage src={celebration.avatar_url} />
                <AvatarFallback className="bg-white text-2xl font-bold text-gray-800">
                  {getInitials(celebration.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute -bottom-2 -right-2 text-3xl">
                {celebration.is_birthday_today ? '🎂' : '🏆'}
              </div>
            </motion.div>

            {/* Content */}
            <div className="flex-1 text-white">
              <motion.h2 
                className="text-2xl font-bold mb-1"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                {celebration.is_birthday_today 
                  ? `🎉 Happy Birthday, ${celebration.full_name?.split(' ')[0]}!`
                  : `🎊 Happy ${celebration.years_at_company + 1} Year Anniversary!`}
              </motion.h2>
              <p className="text-white/90 text-lg">
                {celebration.is_birthday_today
                  ? BIRTHDAY_MESSAGES[Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)]
                  : `${celebration.full_name} has been rocking it for ${celebration.years_at_company + 1} year${celebration.years_at_company > 0 ? 's' : ''}!`}
              </p>
              {celebration.is_anniversary_today && ANNIVERSARY_MILESTONES[celebration.years_at_company + 1] && (
                <Badge className="mt-2 bg-white/20 text-white border-white/30">
                  {ANNIVERSARY_MILESTONES[celebration.years_at_company + 1].emoji} {ANNIVERSARY_MILESTONES[celebration.years_at_company + 1].title}
                </Badge>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => fireConfetti()}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                variant="outline"
              >
                <PartyPopper className="h-4 w-4 mr-2" />
                Celebrate!
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissCelebration(celebration.user_id)}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// Upcoming celebrations widget for dashboard/admin
export function UpcomingCelebrations({ limit = 5, showAll = false }) {
  const [celebrations, setCelebrations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCelebrations = async () => {
      const { data } = await supabase
        .from('upcoming_celebrations')
        .select('*')
        .or('next_birthday.not.is.null,next_anniversary.not.is.null')
        .order('days_until_birthday', { ascending: true, nullsLast: true })
        .limit(showAll ? 50 : limit)

      setCelebrations(data || [])
      setLoading(false)
    }

    fetchCelebrations()
  }, [limit, showAll])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5 text-pink-500" />
            Upcoming Celebrations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  // Combine and sort all upcoming events
  const upcomingEvents = []
  
  celebrations.forEach(person => {
    if (person.next_birthday && person.show_birthday) {
      upcomingEvents.push({
        ...person,
        type: 'birthday',
        date: person.next_birthday,
        daysUntil: person.days_until_birthday,
        isToday: person.is_birthday_today,
      })
    }
    if (person.next_anniversary) {
      upcomingEvents.push({
        ...person,
        type: 'anniversary',
        date: person.next_anniversary,
        daysUntil: person.days_until_anniversary,
        isToday: person.is_anniversary_today,
        yearsCompleting: person.years_at_company + 1,
      })
    }
  })

  // Sort by days until
  upcomingEvents.sort((a, b) => (a.daysUntil || 999) - (b.daysUntil || 999))

  const displayEvents = upcomingEvents.slice(0, showAll ? 50 : limit)

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-orange-500/10">
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-pink-500" />
          Upcoming Celebrations
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {displayEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Cake className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No upcoming celebrations</p>
            <p className="text-sm">Add birthdays in Settings!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayEvents.map((event, index) => (
              <motion.div
                key={`${event.user_id}-${event.type}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all",
                  event.isToday 
                    ? "bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={event.avatar_url} />
                    <AvatarFallback className={cn(
                      "font-bold",
                      event.type === 'birthday' ? "bg-pink-500 text-white" : "bg-orange-500 text-white"
                    )}>
                      {getInitials(event.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-1 -right-1 text-lg">
                    {event.type === 'birthday' ? '🎂' : '🏆'}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {event.full_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {event.type === 'birthday' 
                      ? 'Birthday' 
                      : `${event.yearsCompleting} Year Anniversary`}
                    {' • '}
                    {formatDate(new Date(event.date), 'MMM d')}
                  </p>
                </div>

                <div className="text-right">
                  {event.isToday ? (
                    <Badge className="bg-gradient-to-r from-pink-500 to-purple-500 text-white animate-pulse">
                      TODAY! 🎉
                    </Badge>
                  ) : event.daysUntil === 1 ? (
                    <Badge variant="outline" className="text-orange-500 border-orange-500">
                      Tomorrow
                    </Badge>
                  ) : event.daysUntil <= 7 ? (
                    <Badge variant="outline" className="text-blue-500 border-blue-500">
                      {event.daysUntil} days
                    </Badge>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {event.daysUntil} days
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for sidebar
export function CelebrationsMini() {
  const [todayCelebrations, setTodayCelebrations] = useState([])
  const [upcomingCount, setUpcomingCount] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('upcoming_celebrations')
        .select('*')
        .or('is_birthday_today.eq.true,is_anniversary_today.eq.true,days_until_birthday.lte.7,days_until_anniversary.lte.7')

      if (data) {
        setTodayCelebrations(data.filter(d => d.is_birthday_today || d.is_anniversary_today))
        setUpcomingCount(data.length)
      }
    }

    fetchData()
  }, [])

  if (todayCelebrations.length === 0 && upcomingCount === 0) return null

  return (
    <div className="p-3 rounded-xl border bg-gradient-to-br from-pink-500/5 to-purple-500/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-4 w-4 text-pink-500" />
          <span className="text-sm font-medium">Celebrations</span>
        </div>
        {upcomingCount > 0 && (
          <Badge className="bg-pink-500 text-white text-xs">
            {upcomingCount}
          </Badge>
        )}
      </div>
      {todayCelebrations.length > 0 ? (
        <p className="text-xs text-pink-600 dark:text-pink-400 font-medium">
          🎉 {todayCelebrations[0].full_name?.split(' ')[0]}'s {todayCelebrations[0].is_birthday_today ? 'Birthday' : 'Anniversary'}!
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {upcomingCount} coming up this week
        </p>
      )}
    </div>
  )
}

// Birthday/Anniversary input component for Settings
export function BirthdayInput({ value, onChange, label = "Birthday" }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Cake className="h-4 w-4 text-pink-500" />
        {label}
      </label>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

export function WorkStartDateInput({ value, onChange, label = "Started at Brandastic" }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        <Trophy className="h-4 w-4 text-orange-500" />
        {label}
      </label>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  )
}

export default CelebrationBanner
