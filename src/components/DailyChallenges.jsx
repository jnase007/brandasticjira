import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Target, Zap, Clock, CheckCircle, Gift, Sparkles, 
  RefreshCw, Trophy, Flame
} from 'lucide-react'
import { useGamification } from '../contexts/GamificationContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Progress } from './ui/progress'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

// Daily challenge definitions (rotate based on day of week)
const CHALLENGES = [
  [
    { id: 'tickets_3', name: 'Triple Threat', desc: 'Complete 3 tickets today', target: 3, type: 'tickets', xp: 30 },
    { id: 'hours_2', name: 'Clock In', desc: 'Log 2 hours today', target: 2, type: 'hours', xp: 20 },
    { id: 'comment_1', name: 'Speak Up', desc: 'Leave a comment on any ticket', target: 1, type: 'comments', xp: 10 },
  ],
  [
    { id: 'tickets_5', name: 'High Five', desc: 'Complete 5 tickets today', target: 5, type: 'tickets', xp: 50 },
    { id: 'hours_4', name: 'Half Day Hero', desc: 'Log 4 hours today', target: 4, type: 'hours', xp: 40 },
    { id: 'streak_maintain', name: 'Keep It Up', desc: 'Maintain your streak', target: 1, type: 'streak', xp: 25 },
  ],
  [
    { id: 'tickets_2', name: 'Duo Done', desc: 'Complete 2 tickets today', target: 2, type: 'tickets', xp: 20 },
    { id: 'hours_3', name: 'Time Well Spent', desc: 'Log 3 hours today', target: 3, type: 'hours', xp: 30 },
    { id: 'comments_3', name: 'Collaborator', desc: 'Leave 3 comments today', target: 3, type: 'comments', xp: 25 },
  ],
  [
    { id: 'tickets_4', name: 'Fantastic Four', desc: 'Complete 4 tickets today', target: 4, type: 'tickets', xp: 40 },
    { id: 'hours_6', name: 'Full Day Focus', desc: 'Log 6 hours today', target: 6, type: 'hours', xp: 60 },
    { id: 'early_start', name: 'Early Start', desc: 'Complete a ticket before noon', target: 1, type: 'early', xp: 15 },
  ],
  [
    { id: 'tickets_10', name: 'Perfect 10', desc: 'Complete 10 tickets today', target: 10, type: 'tickets', xp: 100 },
    { id: 'hours_8', name: 'Marathon', desc: 'Log 8 hours today', target: 8, type: 'hours', xp: 80 },
    { id: 'comments_5', name: 'Chatterbox', desc: 'Leave 5 comments today', target: 5, type: 'comments', xp: 40 },
  ],
]

function ChallengeCard({ challenge, progress, completed }) {
  const progressPercent = Math.min(100, (progress / challenge.target) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 rounded-xl border transition-all",
        completed
          ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 dark:from-green-950/20 dark:to-emerald-950/20 dark:border-green-800"
          : "bg-background border-border hover:border-brand-orange/50"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            completed
              ? "bg-green-500"
              : "bg-gradient-to-br from-brand-orange to-brand-coral"
          )}>
            {completed ? (
              <CheckCircle className="h-5 w-5 text-white" />
            ) : (
              <Target className="h-5 w-5 text-white" />
            )}
          </div>
          <div>
            <h4 className="font-semibold">{challenge.name}</h4>
            <p className="text-sm text-muted-foreground">{challenge.desc}</p>
          </div>
        </div>
        <Badge className={cn(
          "shrink-0",
          completed ? "bg-green-500" : "bg-brand-orange"
        )}>
          <Zap className="h-3 w-3 mr-1" />
          +{challenge.xp} XP
        </Badge>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className={cn(
            "font-medium",
            completed ? "text-green-500" : "text-foreground"
          )}>
            {progress} / {challenge.target}
          </span>
        </div>
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <motion.div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              completed
                ? "bg-green-500"
                : "bg-gradient-to-r from-brand-orange to-brand-coral"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {completed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-3 flex items-center gap-2 text-green-600"
        >
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">Challenge Complete!</span>
        </motion.div>
      )}
    </motion.div>
  )
}

export default function DailyChallenges({ compact = false }) {
  const { stats } = useGamification()
  const [todayChallenges, setTodayChallenges] = useState([])
  const [progress, setProgress] = useState({})

  useEffect(() => {
    // Get today's challenges based on day of week
    const dayOfWeek = new Date().getDay()
    const challengeSet = CHALLENGES[dayOfWeek % CHALLENGES.length]
    setTodayChallenges(challengeSet)

    // Mock progress (in real app, would track from today's activity)
    setProgress({
      tickets: Math.min(stats.ticketsCompleted || 0, 10),
      hours: Math.min(stats.hoursLogged || 0, 8),
      comments: Math.min(stats.commentsCount || 0, 5),
      streak: stats.currentStreak > 0 ? 1 : 0,
      early: new Date().getHours() < 12 ? 1 : 0,
    })
  }, [stats])

  const getProgress = (type) => progress[type] || 0
  const isCompleted = (challenge) => getProgress(challenge.type) >= challenge.target
  const completedCount = todayChallenges.filter(isCompleted).length
  const totalXP = todayChallenges.filter(isCompleted).reduce((sum, c) => sum + c.xp, 0)

  if (compact) {
    return (
      <div className="p-3 rounded-xl bg-gradient-to-r from-brand-purple/10 to-brand-blue/5 border border-brand-purple/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-purple" />
            <span className="text-sm font-medium">Daily Challenges</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {completedCount}/{todayChallenges.length}
          </span>
        </div>
        <Progress value={(completedCount / todayChallenges.length) * 100} className="h-1.5" />
        {completedCount > 0 && (
          <p className="text-xs text-brand-purple mt-1">
            +{totalXP} XP earned today!
          </p>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-brand-purple" />
            Daily Challenges
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              <Flame className="h-3 w-3 mr-1 text-orange-500" />
              Day {stats.currentStreak || 1}
            </Badge>
            <Badge variant="outline" className="text-green-500 border-green-200">
              {completedCount}/{todayChallenges.length} Done
            </Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Complete challenges to earn bonus XP. Resets daily at midnight.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {todayChallenges.map((challenge) => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            progress={getProgress(challenge.type)}
            completed={isCompleted(challenge)}
          />
        ))}

        {completedCount === todayChallenges.length && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-center"
          >
            <Trophy className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
            <p className="font-bold text-lg">All Challenges Complete!</p>
            <p className="text-sm text-muted-foreground">
              You earned <span className="text-yellow-500 font-bold">+{totalXP} XP</span> today!
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  )
}
