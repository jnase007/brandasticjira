import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle, AlertCircle, Plus, Calendar, Edit2, Trash2,
  X, Check, User, ChevronDown, Sparkles, ThumbsUp, Download,
  TrendingUp, TrendingDown, Flame, MessageSquare, Clock,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Label } from '../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog'
import { useToast } from '../hooks/useToast'

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20 } }
}

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9, transition: { duration: 0.2 } }
}

// Generate month options
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export default function WorkingNotWorking() {
  const { profile } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [teamMembers, setTeamMembers] = useState([])
  
  // Selected month/year
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    type: 'working', // 'working' or 'not_working'
    description: '',
    responsible: '',
    next_steps: '',
    priority: 'normal', // 'low', 'normal', 'high'
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        handleOpenDialog()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear])

  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch items for selected month
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString()
      const endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59).toISOString()
      
      const { data: itemsData, error } = await supabase
        .from('working_not_working')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })

      if (error) throw error
      setItems(itemsData || [])

      // Fetch team members for assignment
      const { data: teamData } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name')

      setTeamMembers(teamData || [])
    } catch (error) {
      console.log('Error fetching data:', error.message)
      // Table might not exist yet
      setItems([])
    }
    setLoading(false)
  }

  const handleOpenDialog = (item = null) => {
    if (item) {
      setEditingItem(item)
      setFormData({
        type: item.type,
        description: item.description,
        responsible: item.responsible || '',
        next_steps: item.next_steps || '',
      })
    } else {
      setEditingItem(null)
      setFormData({
        type: 'working',
        description: '',
        responsible: '',
        next_steps: '',
      })
    }
    setDialogOpen(true)
  }

  const handleSubmit = async () => {
    if (!formData.description.trim()) {
      toast({ title: 'Please enter a description', variant: 'destructive' })
      return
    }

    try {
      if (editingItem) {
        // Update
        const { error } = await supabase
          .from('working_not_working')
          .update({
            type: formData.type,
            description: formData.description,
            responsible: formData.responsible,
            next_steps: formData.next_steps,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingItem.id)

        if (error) throw error
        toast({ title: '✓ Item updated!', variant: 'success' })
      } else {
        // Insert
        const { error } = await supabase
          .from('working_not_working')
          .insert({
            type: formData.type,
            description: formData.description,
            responsible: formData.responsible,
            next_steps: formData.next_steps,
            created_by: profile?.id,
            month: selectedMonth,
            year: selectedYear,
          })

        if (error) throw error
        toast({ title: '✓ Item added!', variant: 'success' })
      }

      setDialogOpen(false)
      fetchData()
    } catch (error) {
      toast({ title: 'Error saving item', description: error.message, variant: 'destructive' })
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this item?')) return

    try {
      const { error } = await supabase
        .from('working_not_working')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast({ title: '✓ Item deleted', variant: 'success' })
      fetchData()
    } catch (error) {
      toast({ title: 'Error deleting item', description: error.message, variant: 'destructive' })
    }
  }

  const handleResolve = async (id) => {
    try {
      const { error } = await supabase
        .from('working_not_working')
        .update({ is_resolved: true, resolved_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error
      toast({ title: '✓ Marked as resolved!', variant: 'success' })
      fetchData()
    } catch (error) {
      toast({ title: 'Error resolving item', description: error.message, variant: 'destructive' })
    }
  }

  // Filter items by type
  const workingItems = items.filter(i => i.type === 'working')
  const notWorkingItems = items.filter(i => i.type === 'not_working')
  const resolvedItems = items.filter(i => i.is_resolved)
  const unresolvedChallenges = notWorkingItems.filter(i => !i.is_resolved)

  // Handle upvote
  const handleUpvote = async (id) => {
    try {
      const item = items.find(i => i.id === id)
      const currentVotes = item?.votes || 0
      
      const { error } = await supabase
        .from('working_not_working')
        .update({ votes: currentVotes + 1 })
        .eq('id', id)

      if (error) throw error
      
      // Optimistic update
      setItems(prev => prev.map(i => i.id === id ? { ...i, votes: currentVotes + 1 } : i))
    } catch (error) {
      console.log('Error upvoting:', error.message)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-[#0d1d35]/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Working / Not Working</h1>
              <p className="text-white/50 mt-1">
                Monthly review of successes and opportunities
                <span className="ml-2 text-white/30 text-sm">(Press N to add new)</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-white/50" />
                <Select 
                  value={`${selectedMonth}-${selectedYear}`}
                  onValueChange={(v) => {
                    const [m, y] = v.split('-')
                    setSelectedMonth(parseInt(m))
                    setSelectedYear(parseInt(y))
                  }}
                >
                  <SelectTrigger className="w-48 bg-[#0d1d35] border-white/20">
                    <SelectValue>{MONTHS[selectedMonth]} {selectedYear}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1d35] border-white/20">
                    {[selectedYear - 1, selectedYear, selectedYear + 1].map(year => (
                      MONTHS.map((month, idx) => (
                        <SelectItem 
                          key={`${idx}-${year}`} 
                          value={`${idx}-${year}`}
                          className="text-white hover:bg-white/10"
                        >
                          {month} {year}
                        </SelectItem>
                      ))
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={() => handleOpenDialog()}
                className="bg-gradient-to-r from-brand-orange to-brand-coral text-white shadow-lg shadow-brand-orange/20 hover:shadow-brand-orange/40 transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Item
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-4 mt-6">
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-green-500/10 border border-green-500/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-green-400/60 text-sm">Successes</span>
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
              <p className="text-3xl font-bold text-green-400 mt-1">{workingItems.length}</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-amber-400/60 text-sm">Open Challenges</span>
                <AlertCircle className="h-4 w-4 text-amber-400" />
              </div>
              <p className="text-3xl font-bold text-amber-400 mt-1">{unresolvedChallenges.length}</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-purple-400/60 text-sm">Resolved</span>
                <CheckCircle className="h-4 w-4 text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-purple-400 mt-1">{resolvedItems.length}</p>
            </motion.div>
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-cyan-400/60 text-sm">Resolution Rate</span>
                <Flame className="h-4 w-4 text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-cyan-400 mt-1">
                {notWorkingItems.length > 0 
                  ? Math.round((resolvedItems.length / notWorkingItems.length) * 100) 
                  : 100}%
              </p>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div 
        className="max-w-7xl mx-auto px-6 py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="grid md:grid-cols-2 gap-8">
          {/* What's Working */}
          <motion.div variants={itemVariants}>
            <Card className="bg-[#0d1d35] border-white/10 overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-400" />
                    <CardTitle className="text-white text-xl">What's Working</CardTitle>
                  </div>
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    {workingItems.length}
                  </Badge>
                </div>
                <p className="text-white/40 text-sm mt-1">Successes</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence>
                  {workingItems.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <Sparkles className="h-12 w-12 text-green-400/30 mx-auto mb-4" />
                      <p className="text-white/40">No successes recorded this month</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4 border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={() => {
                          setFormData(f => ({ ...f, type: 'working' }))
                          handleOpenDialog()
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Success
                      </Button>
                    </motion.div>
                  ) : (
                    workingItems.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ delay: idx * 0.05 }}
                        className="group relative p-4 rounded-xl bg-white/5 border border-green-500/20 hover:border-green-500/40 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-white/90 leading-relaxed">{item.description}</p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-white/50 hover:text-white"
                              onClick={() => handleOpenDialog(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-white/50 hover:text-red-400"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                          {item.responsible && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <User className="h-3.5 w-3.5" />
                              <span>Responsible: <span className="text-white/70">{item.responsible}</span></span>
                            </div>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleUpvote(item.id)}
                            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-green-400 transition-colors ml-auto"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>{item.votes || 0}</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>

          {/* What's Not Working */}
          <motion.div variants={itemVariants}>
            <Card className="bg-[#0d1d35] border-white/10 overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-400" />
                    <CardTitle className="text-white text-xl">What's Not Working</CardTitle>
                  </div>
                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                    {notWorkingItems.length}
                  </Badge>
                </div>
                <p className="text-white/40 text-sm mt-1">Opportunities</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <AnimatePresence>
                  {notWorkingItems.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-12"
                    >
                      <CheckCircle className="h-12 w-12 text-amber-400/30 mx-auto mb-4" />
                      <p className="text-white/40">No challenges recorded this month</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-4 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => {
                          setFormData(f => ({ ...f, type: 'not_working' }))
                          handleOpenDialog()
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Challenge
                      </Button>
                    </motion.div>
                  ) : (
                    notWorkingItems.map((item, idx) => (
                      <motion.div
                        key={item.id}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={{ delay: idx * 0.05 }}
                        className={cn(
                          "group relative p-4 rounded-xl border transition-all",
                          item.is_resolved 
                            ? "bg-green-500/10 border-green-500/30 opacity-60"
                            : "bg-white/5 border-amber-500/20 hover:border-amber-500/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <p className={cn(
                            "leading-relaxed",
                            item.is_resolved ? "text-white/60 line-through" : "text-white/90"
                          )}>
                            {item.description}
                          </p>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!item.is_resolved && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-white/50 hover:text-green-400"
                                onClick={() => handleResolve(item.id)}
                                title="Mark as resolved"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-white/50 hover:text-white"
                              onClick={() => handleOpenDialog(item)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-white/50 hover:text-red-400"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {item.next_steps && (
                          <div className="mt-3 pt-3 border-t border-white/10">
                            <p className="text-sm text-white/50 mb-1">Next Steps:</p>
                            <p className="text-white/70 text-sm">{item.next_steps}</p>
                          </div>
                        )}
                        
                        <div className="mt-3 flex items-center justify-between">
                          {item.responsible && (
                            <div className="flex items-center gap-2 text-sm text-white/50">
                              <User className="h-3.5 w-3.5" />
                              <span>Responsible: <span className="text-white/70">{item.responsible}</span></span>
                            </div>
                          )}
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => handleUpvote(item.id)}
                            className="flex items-center gap-1.5 text-xs text-white/50 hover:text-amber-400 transition-colors ml-auto"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                            <span>{item.votes || 0}</span>
                          </motion.button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-[#0d1d35] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Type Selection */}
            <div>
              <Label className="text-white/70 mb-3 block">Type *</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: 'working' }))}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    formData.type === 'working'
                      ? "border-green-500 bg-green-500/10"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  )}
                >
                  <CheckCircle className={cn(
                    "h-6 w-6",
                    formData.type === 'working' ? "text-green-400" : "text-white/50"
                  )} />
                  <span className={cn(
                    "font-medium",
                    formData.type === 'working' ? "text-green-400" : "text-white/70"
                  )}>
                    What's Working
                  </span>
                </button>
                
                <button
                  type="button"
                  onClick={() => setFormData(f => ({ ...f, type: 'not_working' }))}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2",
                    formData.type === 'not_working'
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-white/20 bg-white/5 hover:border-white/40"
                  )}
                >
                  <AlertCircle className={cn(
                    "h-6 w-6",
                    formData.type === 'not_working' ? "text-amber-400" : "text-white/50"
                  )} />
                  <span className={cn(
                    "font-medium",
                    formData.type === 'not_working' ? "text-amber-400" : "text-white/70"
                  )}>
                    What's Not Working
                  </span>
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <Label className="text-white/70">
                {formData.type === 'working' ? 'Success' : 'Challenge'} *
              </Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData(f => ({ ...f, description: e.target.value }))}
                placeholder={formData.type === 'working' ? 'Describe what went well...' : 'Describe the challenge...'}
                className="mt-1.5 bg-[#0a1628] border-white/20 text-white min-h-[100px]"
              />
            </div>

            {/* Next Steps (only for not working) */}
            {formData.type === 'not_working' && (
              <div>
                <Label className="text-white/70">Next Steps</Label>
                <Textarea
                  value={formData.next_steps}
                  onChange={(e) => setFormData(f => ({ ...f, next_steps: e.target.value }))}
                  placeholder="What actions will address this?"
                  className="mt-1.5 bg-[#0a1628] border-white/20 text-white min-h-[80px]"
                />
              </div>
            )}

            {/* Responsible */}
            <div>
              <Label className="text-white/70">Responsible</Label>
              <Input
                value={formData.responsible}
                onChange={(e) => setFormData(f => ({ ...f, responsible: e.target.value }))}
                placeholder="Who is responsible?"
                className="mt-1.5 bg-[#0a1628] border-white/20 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="bg-gradient-to-r from-brand-orange to-brand-coral text-white"
            >
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
