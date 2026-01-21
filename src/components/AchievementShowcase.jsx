import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Trophy, Star, Lock, CheckCircle, Zap, Target, Flame, 
  Award, Crown, Rocket, Clock, MessageSquare, Users, TrendingUp,
  Coffee, Moon, Sun, Sparkles
} from 'lucide-react'
import { useGamification } from '../contexts/GamificationContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Progress } from './ui/progress'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog'

const ICON_MAP = {
  Trophy, Star, CheckCircle, Zap, Target, Flame, Award, Crown, Rocket,
  Clock, MessageSquare, Users, TrendingUp, Coffee, Moon, Sun, Sparkles
}

const CATEGORY_LABELS = {
  starter: { label: 'Getting Started', icon: Star, color: 'from-green-400 to-emerald-600' },
  productivity: { label: 'Productivity', icon: Target, color: 'from-blue-400 to-indigo-600' },
  streaks: { label: 'Streaks', icon: Flame, color: 'from-orange-400 to-red-600' },
  time: { label: 'Time Tracking', icon: Clock, color: 'from-purple-400 to-violet-600' },
  social: { label: 'Collaboration', icon: MessageSquare, color: 'from-pink-400 to-rose-600' },
  special: { label: 'Special', icon: Crown, color: 'from-yellow-400 to-amber-600' },
}

function AchievementCard({ achievement, unlocked, showDetails = false }) {
  const IconComponent = achievement.icon

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative p-4 rounded-xl border transition-all cursor-pointer",
        unlocked
          ? "bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200 dark:from-yellow-950/20 dark:to-orange-950/20 dark:border-yellow-800"
          : "bg-muted/30 border-border opacity-60 grayscale"
      )}
    >
      {/* Glow effect for unlocked */}
      {unlocked && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-yellow-400/10 to-orange-400/10 animate-pulse" />
      )}

      <div className="relative flex items-start gap-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
            unlocked
              ? "bg-gradient-to-br from-yellow-400 to-orange-500 shadow-lg shadow-orange-500/30"
              : "bg-muted"
          )}
        >
          {unlocked ? (
            <IconComponent className="h-6 w-6 text-white" />
          ) : (
            <Lock className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-semibold truncate",
              unlocked ? "text-foreground" : "text-muted-foreground"
            )}>
              {achievement.name}
            </h4>
            {unlocked && (
              <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {achievement.desc}
          </p>
          {showDetails && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <Zap className="h-3 w-3 mr-1 text-yellow-500" />
                +{achievement.xp} XP
              </Badge>
              <Badge variant="outline" className="text-xs capitalize">
                {achievement.category}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function AchievementMini({ className }) {
  const { stats, achievements } = useGamification()
  const unlockedCount = stats.achievements?.length || 0
  const totalCount = achievements?.length || 0
  const progress = (unlockedCount / totalCount) * 100

  // Get 3 most recent unlocked achievements
  const recentUnlocked = achievements
    ?.filter(a => stats.achievements?.includes(a.id))
    .slice(0, 3) || []

  return (
    <Dialog>
      <DialogTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={cn(
            "p-3 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/5 border border-yellow-500/20 cursor-pointer",
            className
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Achievements</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {unlockedCount}/{totalCount}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
          {recentUnlocked.length > 0 && (
            <div className="flex -space-x-2 mt-2">
              {recentUnlocked.map((a, i) => (
                <div
                  key={a.id}
                  className="w-6 h-6 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center border-2 border-background"
                  style={{ zIndex: 3 - i }}
                >
                  <a.icon className="h-3 w-3 text-white" />
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Achievements
            <Badge variant="outline" className="ml-2">
              {unlockedCount}/{totalCount} Unlocked
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <AchievementShowcase />
      </DialogContent>
    </Dialog>
  )
}

export default function AchievementShowcase() {
  const { stats, achievements } = useGamification()
  const [selectedCategory, setSelectedCategory] = useState('all')

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)]

  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory)

  const unlockedCount = stats.achievements?.length || 0
  const totalCount = achievements?.length || 0

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-orange-500/10 border border-yellow-500/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Progress</p>
              <p className="text-2xl font-bold">{unlockedCount} / {totalCount}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-yellow-500">
              {Math.round((unlockedCount / totalCount) * 100)}%
            </p>
            <p className="text-xs text-muted-foreground">Complete</p>
          </div>
        </div>
        <Progress value={(unlockedCount / totalCount) * 100} className="h-2" />
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const CategoryIcon = cat === 'all' ? Star : CATEGORY_LABELS[cat]?.icon
          const isActive = selectedCategory === cat
          
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                isActive
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              <CategoryIcon className="h-4 w-4" />
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat].label}
            </button>
          )
        })}
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {filteredAchievements.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ delay: index * 0.05 }}
            >
              <AchievementCard
                achievement={achievement}
                unlocked={stats.achievements?.includes(achievement.id)}
                showDetails
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
