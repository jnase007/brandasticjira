import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lightbulb, Plus, ThumbsUp, ThumbsDown, MessageCircle, Filter,
  TrendingUp, Clock, CheckCircle, XCircle, Loader2, Search,
  Sparkles, Target, Zap, Bug, Megaphone, LayoutGrid, ChevronDown,
  MoreHorizontal, Edit, Trash2, ArrowUp, ArrowDown, Paperclip,
  Image, FileText, X, Upload, ExternalLink
} from 'lucide-react'
import { useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Textarea } from '../components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { useToast } from '../hooks/useToast'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const CATEGORIES = [
  { value: 'feature', label: 'New Feature', icon: Sparkles, color: 'text-purple-500 bg-purple-500/10' },
  { value: 'improvement', label: 'Improvement', icon: TrendingUp, color: 'text-blue-500 bg-blue-500/10' },
  { value: 'bug-fix', label: 'Bug Fix', icon: Bug, color: 'text-red-500 bg-red-500/10' },
  { value: 'process', label: 'Process', icon: Target, color: 'text-green-500 bg-green-500/10' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'text-orange-500 bg-orange-500/10' },
  { value: 'general', label: 'General', icon: LayoutGrid, color: 'text-gray-500 bg-gray-500/10' },
]

const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
]

const STATUSES = [
  { value: 'new', label: 'New', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  { value: 'reviewing', label: 'Reviewing', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { value: 'planned', label: 'Planned', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'in-progress', label: 'In Progress', color: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
]

export default function Ideas() {
  const { user, profile, isAdmin } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [ideas, setIdeas] = useState([])
  const [userVotes, setUserVotes] = useState({}) // { ideaId: 'up' | 'down' }
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [sortBy, setSortBy] = useState('votes') // 'votes', 'newest', 'oldest'

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingIdea, setEditingIdea] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form states
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formCategory, setFormCategory] = useState('feature')
  const [formPriority, setFormPriority] = useState('medium')
  
  // Attachment states
  const [formAttachments, setFormAttachments] = useState([]) // Files to upload
  const [existingAttachments, setExistingAttachments] = useState([]) // Already uploaded
  const [uploadingFile, setUploadingFile] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)
  const dropZoneRef = useRef(null)

  // Fetch ideas
  const fetchIdeas = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('ideas')
        .select(`
          *,
          submitter:submitted_by(id, full_name, avatar_url),
          attachments:idea_attachments(id, file_name, file_url, file_type)
        `)
        .order('votes', { ascending: false })

      if (error) throw error
      setIdeas(data || [])

      // Fetch user's votes
      if (user) {
        const { data: votes } = await supabase
          .from('idea_votes')
          .select('idea_id, vote_type')
          .eq('user_id', user.id)

        const votesMap = {}
        votes?.forEach(v => {
          votesMap[v.idea_id] = v.vote_type
        })
        setUserVotes(votesMap)
      }
    } catch (error) {
      console.error('Error fetching ideas:', error)
      toast({
        title: 'Error loading ideas',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIdeas()
  }, [user])

  // Handle vote
  const handleVote = async (ideaId, voteType) => {
    if (!user) return

    const currentVote = userVotes[ideaId]

    try {
      if (currentVote === voteType) {
        // Remove vote
        await supabase
          .from('idea_votes')
          .delete()
          .eq('idea_id', ideaId)
          .eq('user_id', user.id)

        setUserVotes(prev => {
          const newVotes = { ...prev }
          delete newVotes[ideaId]
          return newVotes
        })

        // Update local idea votes
        setIdeas(prev => prev.map(idea => 
          idea.id === ideaId 
            ? { ...idea, votes: idea.votes - (voteType === 'up' ? 1 : -1) }
            : idea
        ))
      } else if (currentVote) {
        // Change vote
        await supabase
          .from('idea_votes')
          .update({ vote_type: voteType })
          .eq('idea_id', ideaId)
          .eq('user_id', user.id)

        setUserVotes(prev => ({ ...prev, [ideaId]: voteType }))

        // Update local idea votes (change of 2: remove old, add new)
        setIdeas(prev => prev.map(idea => 
          idea.id === ideaId 
            ? { ...idea, votes: idea.votes + (voteType === 'up' ? 2 : -2) }
            : idea
        ))
      } else {
        // New vote
        await supabase
          .from('idea_votes')
          .insert({ idea_id: ideaId, user_id: user.id, vote_type: voteType })

        setUserVotes(prev => ({ ...prev, [ideaId]: voteType }))

        // Update local idea votes
        setIdeas(prev => prev.map(idea => 
          idea.id === ideaId 
            ? { ...idea, votes: idea.votes + (voteType === 'up' ? 1 : -1) }
            : idea
        ))
      }
    } catch (error) {
      console.error('Error voting:', error)
      toast({
        title: 'Error voting',
        description: error.message,
        variant: 'destructive',
      })
    }
  }

  // Handle submit idea
  const handleSubmit = async () => {
    if (!formTitle.trim()) {
      toast({ title: 'Please enter a title', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      let ideaId = editingIdea?.id
      
      if (editingIdea) {
        // Update existing
        const { error } = await supabase
          .from('ideas')
          .update({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            category: formCategory,
            priority: formPriority,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingIdea.id)

        if (error) throw error
      } else {
        // Create new
        const { data, error } = await supabase
          .from('ideas')
          .insert({
            title: formTitle.trim(),
            description: formDescription.trim() || null,
            category: formCategory,
            priority: formPriority,
            submitted_by: user.id,
          })
          .select()
          .single()

        if (error) throw error
        ideaId = data.id
      }

      // Upload any new attachments
      if (formAttachments.length > 0 && ideaId) {
        await uploadAttachments(ideaId, formAttachments)
      }

      toast({ title: editingIdea ? '✅ Idea updated!' : '💡 Idea submitted!', variant: 'success' })

      resetForm()
      setAddDialogOpen(false)
      setEditingIdea(null)
      fetchIdeas()
    } catch (error) {
      console.error('Error saving idea:', error)
      toast({
        title: 'Error saving idea',
        description: error.message,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  // Handle status change (admin only)
  const handleStatusChange = async (ideaId, newStatus) => {
    try {
      const { error } = await supabase
        .from('ideas')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ideaId)

      if (error) throw error

      setIdeas(prev => prev.map(idea => 
        idea.id === ideaId ? { ...idea, status: newStatus } : idea
      ))

      toast({ title: `Status updated to ${newStatus}`, variant: 'success' })
    } catch (error) {
      console.error('Error updating status:', error)
      toast({ title: 'Error updating status', variant: 'destructive' })
    }
  }

  // Handle delete (admin only)
  const handleDelete = async (ideaId) => {
    if (!confirm('Are you sure you want to delete this idea?')) return

    try {
      const { error } = await supabase
        .from('ideas')
        .delete()
        .eq('id', ideaId)

      if (error) throw error

      setIdeas(prev => prev.filter(idea => idea.id !== ideaId))
      toast({ title: 'Idea deleted', variant: 'success' })
    } catch (error) {
      console.error('Error deleting idea:', error)
      toast({ title: 'Error deleting idea', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setFormTitle('')
    setFormDescription('')
    setFormCategory('feature')
    setFormPriority('medium')
    setFormAttachments([])
    setExistingAttachments([])
  }

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    // Add files to form attachments
    setFormAttachments(prev => [...prev, ...files])
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if we're leaving the drop zone entirely
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length === 0) return
    
    // Filter to accepted file types
    const acceptedTypes = ['image/', 'application/pdf', 'application/msword', 'application/vnd.', 'text/']
    const validFiles = files.filter(file => 
      acceptedTypes.some(type => file.type.startsWith(type)) || 
      file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i)
    )
    
    if (validFiles.length > 0) {
      setFormAttachments(prev => [...prev, ...validFiles])
    }
  }

  // Remove pending file
  const removeFormAttachment = (index) => {
    setFormAttachments(prev => prev.filter((_, i) => i !== index))
  }

  // Remove existing attachment
  const removeExistingAttachment = async (attachmentId) => {
    try {
      const { error } = await supabase
        .from('idea_attachments')
        .delete()
        .eq('id', attachmentId)
      
      if (error) throw error
      
      setExistingAttachments(prev => prev.filter(a => a.id !== attachmentId))
      toast({ title: 'Attachment removed', variant: 'success' })
    } catch (error) {
      console.error('Error removing attachment:', error)
      toast({ title: 'Error removing attachment', variant: 'destructive' })
    }
  }

  // Upload attachments for an idea
  const uploadAttachments = async (ideaId, files) => {
    const uploadedAttachments = []
    
    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()
        const fileName = `${ideaId}/${Date.now()}-${file.name}`
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('idea-attachments')
          .upload(fileName, file)
        
        if (uploadError) {
          console.error('Upload error:', uploadError)
          continue
        }
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('idea-attachments')
          .getPublicUrl(fileName)
        
        // Determine file type
        const isImage = file.type.startsWith('image/')
        const fileType = isImage ? 'image' : 'document'
        
        // Save attachment record
        const { data, error } = await supabase
          .from('idea_attachments')
          .insert({
            idea_id: ideaId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: fileType,
            file_size: file.size,
            uploaded_by: user.id
          })
          .select()
          .single()
        
        if (!error && data) {
          uploadedAttachments.push(data)
        }
      } catch (err) {
        console.error('Error uploading file:', err)
      }
    }
    
    return uploadedAttachments
  }

  // Get file type icon
  const getFileIcon = (fileType) => {
    if (fileType === 'image') return Image
    return FileText
  }

  const openEditDialog = (idea) => {
    setEditingIdea(idea)
    setFormTitle(idea.title)
    setFormDescription(idea.description || '')
    setExistingAttachments(idea.attachments || [])
    setFormCategory(idea.category)
    setFormPriority(idea.priority)
    setAddDialogOpen(true)
  }

  // Filter and sort ideas
  const filteredIdeas = ideas
    .filter(idea => {
      const matchesSearch = idea.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        idea.description?.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = filterCategory === 'all' || idea.category === filterCategory
      const matchesStatus = filterStatus === 'all' || idea.status === filterStatus
      return matchesSearch && matchesCategory && matchesStatus
    })
    .sort((a, b) => {
      if (sortBy === 'votes') return b.votes - a.votes
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at)
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at)
      return 0
    })

  const getCategoryInfo = (category) => CATEGORIES.find(c => c.value === category) || CATEGORIES[5]
  const getPriorityInfo = (priority) => PRIORITIES.find(p => p.value === priority) || PRIORITIES[1]
  const getStatusInfo = (status) => STATUSES.find(s => s.value === status) || STATUSES[0]

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-brand-orange" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 text-white">
                <Lightbulb className="h-6 w-6" />
              </div>
              Ideas Board
            </h1>
            <p className="text-muted-foreground mt-1">
              Share ideas, vote on priorities, and help shape what we build next
            </p>
          </div>
          <Button 
            onClick={() => {
              resetForm()
              setEditingIdea(null)
              setAddDialogOpen(true)
            }}
            className="bg-gradient-to-r from-brand-orange to-brand-coral hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Submit Idea
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-500/10">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ideas.length}</p>
              <p className="text-xs text-muted-foreground">Total Ideas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ideas.filter(i => i.status === 'planned').length}</p>
              <p className="text-xs text-muted-foreground">Planned</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Zap className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ideas.filter(i => i.status === 'in-progress').length}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{ideas.filter(i => i.status === 'completed').length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search ideas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map(status => (
              <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="votes">Most Votes</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Ideas List */}
      <motion.div variants={containerVariants} className="space-y-4">
        {filteredIdeas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">
                {searchQuery || filterCategory !== 'all' || filterStatus !== 'all'
                  ? 'No ideas match your filters'
                  : 'No ideas yet. Be the first to submit one!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <AnimatePresence>
            {filteredIdeas.map((idea, index) => {
              const categoryInfo = getCategoryInfo(idea.category)
              const priorityInfo = getPriorityInfo(idea.priority)
              const statusInfo = getStatusInfo(idea.status)
              const CategoryIcon = categoryInfo.icon
              const userVote = userVotes[idea.id]

              return (
                <motion.div
                  key={idea.id}
                  variants={itemVariants}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex gap-4">
                        {/* Vote buttons */}
                        <div className="flex flex-col items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVote(idea.id, 'up')}
                            className={cn(
                              "h-8 w-8 p-0",
                              userVote === 'up' && "text-green-500 bg-green-500/10"
                            )}
                          >
                            <ArrowUp className="h-5 w-5" />
                          </Button>
                          <span className={cn(
                            "font-bold text-lg",
                            idea.votes > 0 && "text-green-500",
                            idea.votes < 0 && "text-red-500"
                          )}>
                            {idea.votes}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleVote(idea.id, 'down')}
                            className={cn(
                              "h-8 w-8 p-0",
                              userVote === 'down' && "text-red-500 bg-red-500/10"
                            )}
                          >
                            <ArrowDown className="h-5 w-5" />
                          </Button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg">{idea.title}</h3>
                              {idea.description && (
                                <p className="text-muted-foreground mt-1 line-clamp-2">
                                  {idea.description}
                                </p>
                              )}
                            </div>

                            {/* Actions dropdown */}
                            {(idea.submitted_by === user?.id || isAdmin) && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => openEditDialog(idea)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  {isAdmin && (
                                    <>
                                      <DropdownMenuSeparator />
                                      {STATUSES.map(status => (
                                        <DropdownMenuItem
                                          key={status.value}
                                          onClick={() => handleStatusChange(idea.id, status.value)}
                                          disabled={idea.status === status.value}
                                        >
                                          Set as {status.label}
                                        </DropdownMenuItem>
                                      ))}
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => handleDelete(idea.id)}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          {/* Attachments */}
                          {idea.attachments && idea.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {idea.attachments.map((attachment) => {
                                const FileIcon = getFileIcon(attachment.file_type)
                                const isImage = attachment.file_type === 'image'
                                
                                return (
                                  <a
                                    key={attachment.id}
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group relative"
                                  >
                                    {isImage ? (
                                      <div className="w-16 h-16 rounded-lg overflow-hidden border hover:border-brand-orange transition-colors">
                                        <img 
                                          src={attachment.file_url} 
                                          alt={attachment.file_name}
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 hover:border-brand-orange transition-colors">
                                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-xs truncate max-w-[100px]">{attachment.file_name}</span>
                                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    )}
                                  </a>
                                )
                              })}
                            </div>
                          )}

                          {/* Meta info */}
                          <div className="flex flex-wrap items-center gap-2 mt-3">
                            <Badge className={categoryInfo.color}>
                              <CategoryIcon className="h-3 w-3 mr-1" />
                              {categoryInfo.label}
                            </Badge>
                            <Badge className={priorityInfo.color}>
                              {priorityInfo.label}
                            </Badge>
                            <Badge className={statusInfo.color}>
                              {statusInfo.label}
                            </Badge>
                            {idea.attachments && idea.attachments.length > 0 && (
                              <Badge variant="outline" className="gap-1">
                                <Paperclip className="h-3 w-3" />
                                {idea.attachments.length}
                              </Badge>
                            )}
                            
                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-2">
                              {idea.submitter && (
                                <>
                                  <Avatar className="h-5 w-5">
                                    <AvatarImage src={idea.submitter.avatar_url} referrerPolicy="no-referrer" />
                                    <AvatarFallback className="text-[10px]">
                                      {idea.submitter.full_name?.[0] || '?'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span>{idea.submitter.full_name}</span>
                                  <span>•</span>
                                </>
                              )}
                              {formatDate(idea.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => {
        setAddDialogOpen(open)
        if (!open) {
          setEditingIdea(null)
          resetForm()
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-500" />
              {editingIdea ? 'Edit Idea' : 'Submit New Idea'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="What's your idea?"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Describe your idea in more detail..."
                className="mt-1.5 min-h-[100px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <cat.icon className="h-4 w-4" />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Priority</Label>
                <Select value={formPriority} onValueChange={setFormPriority}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Attachments */}
            <div>
              <Label className="flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments
              </Label>
              
              {/* Existing attachments (when editing) */}
              {existingAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {existingAttachments.map((attachment) => {
                    const FileIcon = getFileIcon(attachment.file_type)
                    return (
                      <div key={attachment.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-muted/50 group">
                        <FileIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs truncate max-w-[120px]">{attachment.file_name}</span>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(attachment.id)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              
              {/* Pending uploads */}
              {formAttachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2 mb-2">
                  {formAttachments.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-brand-orange/50 bg-brand-orange/5">
                      {file.type.startsWith('image/') ? (
                        <Image className="h-4 w-4 text-brand-orange" />
                      ) : (
                        <FileText className="h-4 w-4 text-brand-orange" />
                      )}
                      <span className="text-xs truncate max-w-[120px]">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => removeFormAttachment(index)}
                        className="text-muted-foreground hover:text-red-500 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Drop zone */}
              <div
                ref={dropZoneRef}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "mt-2 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all",
                  isDragging 
                    ? "border-brand-orange bg-brand-orange/10 scale-[1.02]" 
                    : "border-muted-foreground/25 hover:border-brand-orange/50 hover:bg-muted/50"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "p-3 rounded-full transition-colors",
                    isDragging ? "bg-brand-orange/20" : "bg-muted"
                  )}>
                    <Upload className={cn(
                      "h-6 w-6 transition-colors",
                      isDragging ? "text-brand-orange" : "text-muted-foreground"
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      "font-medium transition-colors",
                      isDragging ? "text-brand-orange" : "text-foreground"
                    )}>
                      {isDragging ? "Drop files here!" : "Drag & drop files here"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse • Images, PDFs, and documents
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Lightbulb className="h-4 w-4 mr-2" />
                  {editingIdea ? 'Update Idea' : 'Submit Idea'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
