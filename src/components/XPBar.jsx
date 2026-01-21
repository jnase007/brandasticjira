import { motion } from 'framer-motion'
import { Zap, Crown, Flame } from 'lucide-react'
import { useGamification } from '../contexts/GamificationContext'
import { cn } from '../lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip'

export default function XPBar({ collapsed = false }) {
  const { stats, getLevelProgress, getRank, loading } = useGamification()

  if (loading) return null

  const progress = getLevelProgress(stats.xp)
  const rank = getRank(stats.level)

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1 p-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: rank.color }}
              >
                {stats.level}
              </div>
              <div className="w-8 h-1 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-brand-orange"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p className="font-bold">{rank.title} - Level {stats.level}</p>
            <p className="text-xs">{stats.xp} XP</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="p-3 mx-2 rounded-xl bg-gradient-to-r from-brand-orange/10 to-brand-coral/5 border border-brand-orange/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-lg"
            style={{ backgroundColor: rank.color }}
          >
            {stats.level}
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: rank.color }}>
              {rank.title}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {stats.xp.toLocaleString()} XP
            </p>
          </div>
        </div>
        {stats.currentStreak > 0 && (
          <div className="flex items-center gap-1 text-orange-500">
            <Flame className="h-4 w-4" />
            <span className="text-xs font-bold">{stats.currentStreak}</span>
          </div>
        )}
      </div>

      {/* XP Progress Bar */}
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-orange to-brand-coral"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {/* Shine effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '200%' }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        />
      </div>

      {/* Quick Stats */}
      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
        <span>🎯 {stats.ticketsCompleted} done</span>
        <span>⏱️ {Math.round(stats.hoursLogged)}h logged</span>
      </div>
    </div>
  )
}
