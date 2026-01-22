import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target, Plus, Check, X, Trash2, Edit2, Sparkles,
  Trophy, Flame, Calendar, ChevronRight, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Progress } from './ui/progress'
import { useToast } from '../hooks/useToast'
import { useConfetti } from './Confetti'

// Get current week's start (Monday) and end (Sunday)
function getCurrentWeek() {
  const now = new Date()
  const dayOfWeek = now.getDay()
  const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  return { start: monday, end: sunday }
}

export function WeeklyGoals({ compact = false }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const { fire: fireConfetti } = useConfetti()
  
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [newGoal, setNewGoal] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  const week = getCurrentWeek()
  const completedCount = goals.filter(g => g.completed).length
  const progressPercent = goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0

  // Fetch goals
  useEffect(() => {
    const fetchGoals = async () => {
      if (!user) return
      
      const { data } = await supabase
        .from('weekly_goals')
        .select('*')
        .eq('user_id', user.id)
        .gte('week_start', week.start.toISOString())
        .lte('week_start', week.end.toISOString())
        .order('created_at', { ascending: true })
      
      setGoals(data || [])
      setLoading(false)
    }

    fetchGoals()
  }, [user])

  const handleAddGoal = async () => {
    if (!newGoal.trim()) return

    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('weekly_goals')
        .insert({
          user_id: user.id,
          title: newGoal.trim(),
          week_start: week.start.toISOString(),
          completed: false,
        })
        .select()
        .single()

      if (error) throw error

      setGoals([...goals, data])
      setNewGoal('')
      setShowAddForm(false)
      
      toast({
        title: '🎯 Goal added!',
        description: 'Crush it this week!',
      })
    } catch (error) {
      toast({
        title: 'Failed to add goal',
        variant: 'destructive',
      })
    } finally {
      setAdding(false)
    }
  }

  const handleToggleGoal = async (goal) => {
    const newCompleted = !goal.completed
    
    // Optimistic update
    setGoals(goals.map(g => 
      g.id === goal.id ? { ...g, completed: newCompleted } : g
    ))

    try {
      await supabase
        .from('weekly_goals')
        .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
        .eq('id', goal.id)

      if (newCompleted) {
        // Check if all goals are now complete
        const allComplete = goals.every(g => g.id === goal.id ? true : g.completed)
        
        if (allComplete && goals.length > 0) {
          fireConfetti()
          toast({
            title: '🏆 ALL GOALS COMPLETE!',
            description: 'You crushed your weekly goals! 🎉',
            variant: 'success',
          })
        } else {
          toast({
            title: '✓ Goal complete!',
            description: `${completedCount + 1}/${goals.length} goals done`,
          })
        }
      }
    } catch (error) {
      // Revert on error
      setGoals(goals.map(g => 
        g.id === goal.id ? { ...g, completed: goal.completed } : g
      ))
    }
  }

  const handleDeleteGoal = async (goalId) => {
    setGoals(goals.filter(g => g.id !== goalId))
    
    await supabase.from('weekly_goals').delete().eq('id', goalId)
    
    toast({ title: 'Goal removed' })
  }

  if (compact) {
    return (
      <div className="p-3 rounded-xl border bg-gradient-to-br from-brand-orange/5 to-yellow-500/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-brand-orange" />
            <span className="text-sm font-medium">Weekly Goals</span>
          </div>
          <span className="text-xs font-bold text-brand-orange">
            {completedCount}/{goals.length}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        <p className="text-xs text-muted-foreground mt-2">
          {progressPercent === 100 
            ? '🎉 All goals complete!'
            : `${goals.length - completedCount} goals left`}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-brand-orange" />
          <h3 className="font-semibold">Weekly Goals</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {formatDate(week.start, 'MMM d')} - {formatDate(week.end, 'MMM d')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-brand-orange/10 to-yellow-500/10 border border-brand-orange/20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progress</span>
          <span className="text-sm font-bold text-brand-orange">
            {progressPercent}%
          </span>
        </div>
        <Progress value={progressPercent} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          {completedCount} of {goals.length} goals completed
        </p>
      </div>

      {/* Add Goal Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 p-3 rounded-xl border bg-muted/30">
              <Input
                value={newGoal}
                onChange={(e) => setNewGoal(e.target.value)}
                placeholder="What do you want to achieve?"
                onKeyDown={(e) => e.key === 'Enter' && handleAddGoal()}
                autoFocus
              />
              <Button onClick={handleAddGoal} disabled={adding || !newGoal.trim()}>
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Goals List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="mb-2">No goals set for this week</p>
          <Button variant="outline" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add your first goal
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {goals.map((goal, index) => (
            <motion.div
              key={goal.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "group flex items-center gap-3 p-3 rounded-xl border transition-all",
                goal.completed 
                  ? "bg-green-500/5 border-green-500/30" 
                  : "hover:bg-muted/50"
              )}
            >
              <button
                onClick={() => handleToggleGoal(goal)}
                className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0",
                  goal.completed
                    ? "bg-green-500 border-green-500 text-white"
                    : "border-muted-foreground/30 hover:border-brand-orange"
                )}
              >
                {goal.completed && <Check className="h-4 w-4" />}
              </button>
              
              <span className={cn(
                "flex-1 text-sm font-medium transition-all",
                goal.completed && "line-through text-muted-foreground"
              )}>
                {goal.title}
              </span>
              
              <button
                onClick={() => handleDeleteGoal(goal.id)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-red-500 transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Motivation */}
      {goals.length > 0 && progressPercent < 100 && (
        <div className="p-3 rounded-xl bg-muted/50 text-center">
          <p className="text-sm text-muted-foreground">
            {progressPercent >= 75 
              ? "🔥 Almost there! Keep pushing!"
              : progressPercent >= 50
                ? "💪 Halfway there! You got this!"
                : progressPercent >= 25
                  ? "🚀 Great start! Keep the momentum!"
                  : "🎯 Let's crush these goals!"}
          </p>
        </div>
      )}
    </div>
  )
}

export default WeeklyGoals
