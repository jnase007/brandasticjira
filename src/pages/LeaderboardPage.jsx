import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Target, Flame, Zap, Award, Star } from 'lucide-react'
import { useGamification } from '../contexts/GamificationContext'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import Leaderboard from '../components/Leaderboard'
import AchievementShowcase from '../components/AchievementShowcase'
import DailyChallenges from '../components/DailyChallenges'
import AnimatedCounter from '../components/AnimatedCounter'

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

export default function LeaderboardPage() {
  const { stats, getRank, getLevelProgress } = useGamification()
  const rank = getRank(stats.level)
  const progress = getLevelProgress(stats.xp)

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
            <Trophy className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold">Leaderboard & Achievements</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Compete with your team, unlock achievements, and climb the ranks!
        </p>
      </motion.div>

      {/* Your Stats Banner */}
      <motion.div variants={itemVariants} className="mb-8">
        <Card className="bg-gradient-to-r from-brand-purple/10 via-brand-blue/10 to-brand-teal/10 border-brand-purple/20 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-8">
              {/* Level Badge */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', delay: 0.2 }}
                  className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-2xl"
                  style={{ backgroundColor: rank.color }}
                >
                  {stats.level}
                </motion.div>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 }}
                  className="absolute -bottom-2 -right-2 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full"
                >
                  {rank.title}
                </motion.div>
              </div>

              {/* XP Progress */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Total XP</p>
                    <p className="text-3xl font-bold">
                      {stats.xp}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Next Level</p>
                    <p className="text-lg font-medium">Level {stats.level + 1}</p>
                  </div>
                </div>
                <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ 
                      background: `linear-gradient(90deg, ${rank.color}, #F59E0B)` 
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  />
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{Math.round(progress)}% to next level</p>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center mx-auto mb-2">
                    <Target className="h-6 w-6 text-green-500" />
                  </div>
                  <p className="text-2xl font-bold">{stats.ticketsCompleted}</p>
                  <p className="text-xs text-muted-foreground">Tickets Done</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-2">
                    <Flame className="h-6 w-6 text-orange-500" />
                  </div>
                  <p className="text-2xl font-bold">{stats.currentStreak}</p>
                  <p className="text-xs text-muted-foreground">Day Streak</p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center mx-auto mb-2">
                    <Award className="h-6 w-6 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold">{stats.achievements?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Achievements</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="leaderboard" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="leaderboard" className="gap-2">
            <Trophy className="h-4 w-4" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2">
            <Award className="h-4 w-4" />
            Achievements
          </TabsTrigger>
          <TabsTrigger value="challenges" className="gap-2">
            <Target className="h-4 w-4" />
            Daily Challenges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="leaderboard">
          <motion.div variants={itemVariants}>
            <Leaderboard />
          </motion.div>
        </TabsContent>

        <TabsContent value="achievements">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-500" />
                  Your Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <AchievementShowcase />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="challenges">
          <motion.div variants={itemVariants}>
            <DailyChallenges />
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
