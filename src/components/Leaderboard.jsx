import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, Crown, Flame, TrendingUp, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, getInitials } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'

const RANKS = [
  { level: 1, title: 'Rookie', color: '#6B7280' },
  { level: 3, title: 'Associate', color: '#10B981' },
  { level: 5, title: 'Specialist', color: '#3B82F6' },
  { level: 7, title: 'Expert', color: '#8B5CF6' },
  { level: 10, title: 'Master', color: '#F59E0B' },
  { level: 12, title: 'Champion', color: '#EF4444' },
  { level: 15, title: 'Legend', color: '#EC4899' },
]

const LEVEL_XP = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000, 15000, 20000, 30000, 50000]

function getLevel(xp) {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i + 1
  }
  return 1
}

function getRank(level) {
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (level >= RANKS[i].level) return RANKS[i]
  }
  return RANKS[0]
}

function getRankIcon(position) {
  switch (position) {
    case 1:
      return <Crown className="h-5 w-5 text-yellow-500" />
    case 2:
      return <Medal className="h-5 w-5 text-gray-400" />
    case 3:
      return <Medal className="h-5 w-5 text-amber-600" />
    default:
      return <span className="text-sm font-bold text-muted-foreground">{position}</span>
  }
}

export default function Leaderboard() {
  const { user } = useAuth()
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('all')

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true)
      try {
        const { data } = await supabase
          .from('user_gamification')
          .select(`
            *,
            profile:profiles(full_name, avatar_url)
          `)
          .order('xp', { ascending: false })
          .limit(20)

        setLeaderboard(data || [])
      } catch (error) {
        console.error('Error fetching leaderboard:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [timeframe])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Leaderboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-muted" />
                <div className="w-10 h-10 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-3 w-16 bg-muted rounded mt-1" />
                </div>
                <div className="h-6 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Team Leaderboard
          </CardTitle>
          <Badge variant="outline" className="font-normal">
            <Zap className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {/* Top 3 Podium */}
        {leaderboard.length >= 3 && (
          <div className="flex items-end justify-center gap-4 p-6 pb-4 bg-gradient-to-b from-muted/50 to-transparent">
            {/* 2nd Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-center"
            >
              <Avatar className="w-14 h-14 mx-auto border-4 border-gray-300 shadow-lg">
                <AvatarImage src={leaderboard[1]?.profile?.avatar_url} />
                <AvatarFallback>{getInitials(leaderboard[1]?.profile?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="mt-2 bg-gray-200 rounded-t-lg px-4 py-3 w-20">
                <Medal className="h-5 w-5 text-gray-500 mx-auto" />
                <p className="text-xs font-medium truncate">{leaderboard[1]?.profile?.full_name?.split(' ')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{leaderboard[1]?.xp?.toLocaleString()} XP</p>
              </div>
            </motion.div>

            {/* 1st Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center -mt-4"
            >
              <div className="relative">
                <Crown className="h-6 w-6 text-yellow-500 absolute -top-6 left-1/2 -translate-x-1/2" />
                <Avatar className="w-18 h-18 mx-auto border-4 border-yellow-400 shadow-lg" style={{ width: 72, height: 72 }}>
                  <AvatarImage src={leaderboard[0]?.profile?.avatar_url} />
                  <AvatarFallback className="text-lg">{getInitials(leaderboard[0]?.profile?.full_name)}</AvatarFallback>
                </Avatar>
              </div>
              <div className="mt-2 bg-gradient-to-b from-yellow-200 to-yellow-300 rounded-t-lg px-4 py-4 w-24">
                <Trophy className="h-6 w-6 text-yellow-600 mx-auto" />
                <p className="text-sm font-bold truncate">{leaderboard[0]?.profile?.full_name?.split(' ')[0]}</p>
                <p className="text-xs text-yellow-700">{leaderboard[0]?.xp?.toLocaleString()} XP</p>
              </div>
            </motion.div>

            {/* 3rd Place */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <Avatar className="w-14 h-14 mx-auto border-4 border-amber-600 shadow-lg">
                <AvatarImage src={leaderboard[2]?.profile?.avatar_url} />
                <AvatarFallback>{getInitials(leaderboard[2]?.profile?.full_name)}</AvatarFallback>
              </Avatar>
              <div className="mt-2 bg-amber-100 rounded-t-lg px-4 py-2 w-20">
                <Medal className="h-5 w-5 text-amber-600 mx-auto" />
                <p className="text-xs font-medium truncate">{leaderboard[2]?.profile?.full_name?.split(' ')[0]}</p>
                <p className="text-[10px] text-muted-foreground">{leaderboard[2]?.xp?.toLocaleString()} XP</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* Full List */}
        <div className="divide-y">
          {leaderboard.map((entry, index) => {
            const level = getLevel(entry.xp || 0)
            const rank = getRank(level)
            const isCurrentUser = entry.user_id === user?.id

            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  "flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors",
                  isCurrentUser && "bg-brand-orange/5"
                )}
              >
                {/* Position */}
                <div className="w-8 flex justify-center">
                  {getRankIcon(index + 1)}
                </div>

                {/* Avatar */}
                <Avatar className="w-10 h-10">
                  <AvatarImage src={entry.profile?.avatar_url} />
                  <AvatarFallback
                    className="text-white text-xs"
                    style={{ backgroundColor: rank.color }}
                  >
                    {getInitials(entry.profile?.full_name)}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("font-medium truncate", isCurrentUser && "text-brand-orange")}>
                      {entry.profile?.full_name}
                      {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
                    </p>
                    {entry.current_streak > 0 && (
                      <span className="flex items-center gap-0.5 text-orange-500 text-xs">
                        <Flame className="h-3 w-3" />
                        {entry.current_streak}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span style={{ color: rank.color }}>{rank.title}</span>
                    <span>•</span>
                    <span>Lvl {level}</span>
                    <span>•</span>
                    <span>{entry.tickets_completed || 0} tickets</span>
                  </div>
                </div>

                {/* XP */}
                <div className="text-right">
                  <p className="font-bold text-lg">{(entry.xp || 0).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">XP</p>
                </div>
              </motion.div>
            )
          })}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No leaderboard data yet</p>
            <p className="text-sm">Complete tickets to earn XP!</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
