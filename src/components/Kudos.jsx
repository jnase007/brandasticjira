import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart, Star, Zap, Trophy, Sparkles, ThumbsUp,
  Send, X, Loader2, PartyPopper, Rocket, Crown,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatRelativeDate, getInitials } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { useToast } from '../hooks/useToast'

const KUDOS_TYPES = [
  { id: 'thanks', emoji: '🙏', label: 'Thanks!', color: 'bg-blue-500' },
  { id: 'amazing', emoji: '🌟', label: 'Amazing Work!', color: 'bg-yellow-500' },
  { id: 'helpful', emoji: '🤝', label: 'Super Helpful!', color: 'bg-green-500' },
  { id: 'creative', emoji: '🎨', label: 'Creative!', color: 'bg-purple-500' },
  { id: 'rockstar', emoji: '🚀', label: 'Rockstar!', color: 'bg-pink-500' },
  { id: 'champion', emoji: '🏆', label: 'Champion!', color: 'bg-orange-500' },
]

export function KudosWidget({ compact = false }) {
  const { user, profile } = useAuth()
  const { toast } = useToast()
  const [kudos, setKudos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showGiveKudos, setShowGiveKudos] = useState(false)
  const [teamMembers, setTeamMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // Fetch recent kudos
  useEffect(() => {
    const fetchKudos = async () => {
      const { data } = await supabase
        .from('kudos')
        .select(`
          *,
          sender:profiles!kudos_sender_id_fkey(full_name, avatar_url),
          receiver:profiles!kudos_receiver_id_fkey(full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(10)
      
      setKudos(data || [])
      setLoading(false)
    }

    const fetchTeam = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('role', ['team', 'admin'])
        .neq('id', user?.id)
      
      setTeamMembers(data || [])
    }

    fetchKudos()
    fetchTeam()

    // Subscribe to new kudos
    const channel = supabase
      .channel('kudos')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kudos' }, (payload) => {
        // Refresh kudos list
        fetchKudos()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  const handleSendKudos = async () => {
    if (!selectedMember || !selectedType) return

    setSending(true)
    try {
      const { error } = await supabase.from('kudos').insert({
        sender_id: user.id,
        receiver_id: selectedMember.id,
        type: selectedType.id,
        message: message.trim() || null,
      })

      if (error) throw error

      toast({
        title: '🎉 Kudos sent!',
        description: `You gave kudos to ${selectedMember.full_name}`,
        variant: 'success',
      })

      // Reset form
      setShowGiveKudos(false)
      setSelectedMember(null)
      setSelectedType(null)
      setMessage('')
    } catch (error) {
      console.error('Kudos error:', error)
      const errorMessage = error?.message || 'Unknown error'
      
      if (errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        toast({
          title: '⚠️ Setup needed',
          description: 'Run supabase/all-features-setup.sql first',
          variant: 'destructive',
        })
      } else {
        toast({
          title: '❌ Failed to send kudos',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    } finally {
      setSending(false)
    }
  }

  if (compact) {
    return (
      <div className="p-3 rounded-xl border bg-gradient-to-br from-pink-500/5 to-purple-500/5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            <span className="text-sm font-medium">Team Kudos</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowGiveKudos(true)}
            className="h-7 text-xs"
          >
            Give Kudos
          </Button>
        </div>
        
        {kudos.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">{kudos[0].sender?.full_name}</span>
            {' gave '}
            <span className="font-medium">{kudos[0].receiver?.full_name}</span>
            {' '}
            {KUDOS_TYPES.find(t => t.id === kudos[0].type)?.emoji}
          </div>
        )}

        {/* Give Kudos Modal */}
        <AnimatePresence>
          {showGiveKudos && (
            <GiveKudosModal
              teamMembers={teamMembers}
              selectedMember={selectedMember}
              setSelectedMember={setSelectedMember}
              selectedType={selectedType}
              setSelectedType={setSelectedType}
              message={message}
              setMessage={setMessage}
              sending={sending}
              onSend={handleSendKudos}
              onClose={() => setShowGiveKudos(false)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-pink-500" />
          <h3 className="font-semibold">Team Kudos</h3>
        </div>
        <Button size="sm" onClick={() => setShowGiveKudos(true)}>
          <Sparkles className="h-4 w-4 mr-2" />
          Give Kudos
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : kudos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Heart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No kudos yet. Be the first to give some!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {kudos.map((kudo) => {
            const type = KUDOS_TYPES.find(t => t.id === kudo.type)
            
            return (
              <motion.div
                key={kudo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border bg-gradient-to-r from-pink-500/5 to-purple-500/5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={kudo.sender?.avatar_url} />
                      <AvatarFallback className="bg-pink-500 text-white">
                        {getInitials(kudo.sender?.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 text-lg">
                      {type?.emoji}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{kudo.sender?.full_name}</span>
                      {' gave kudos to '}
                      <span className="font-semibold">{kudo.receiver?.full_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {type?.label} • {formatRelativeDate(new Date(kudo.created_at))}
                    </p>
                    {kudo.message && (
                      <p className="text-sm mt-2 italic text-muted-foreground">
                        "{kudo.message}"
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      {/* Give Kudos Modal */}
      <AnimatePresence>
        {showGiveKudos && (
          <GiveKudosModal
            teamMembers={teamMembers}
            selectedMember={selectedMember}
            setSelectedMember={setSelectedMember}
            selectedType={selectedType}
            setSelectedType={setSelectedType}
            message={message}
            setMessage={setMessage}
            sending={sending}
            onSend={handleSendKudos}
            onClose={() => setShowGiveKudos(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

function GiveKudosModal({
  teamMembers,
  selectedMember,
  setSelectedMember,
  selectedType,
  setSelectedType,
  message,
  setMessage,
  sending,
  onSend,
  onClose,
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-50 bg-background rounded-2xl shadow-2xl border overflow-hidden"
      >
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-500" />
              Give Kudos
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Select Team Member */}
          <div>
            <label className="text-sm font-medium mb-2 block">Who deserves kudos?</label>
            <div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={cn(
                    "p-2 rounded-xl border text-center transition-all",
                    selectedMember?.id === member.id
                      ? "border-pink-500 bg-pink-500/10"
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-10 w-10 mx-auto mb-1">
                    <AvatarImage src={member.avatar_url} />
                    <AvatarFallback className="bg-brand-orange text-white text-xs">
                      {getInitials(member.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-xs font-medium truncate">{member.full_name?.split(' ')[0]}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Select Kudos Type */}
          <div>
            <label className="text-sm font-medium mb-2 block">What kind of kudos?</label>
            <div className="grid grid-cols-3 gap-2">
              {KUDOS_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={cn(
                    "p-3 rounded-xl border text-center transition-all",
                    selectedType?.id === type.id
                      ? "border-pink-500 bg-pink-500/10"
                      : "hover:bg-muted"
                  )}
                >
                  <div className="text-2xl mb-1">{type.emoji}</div>
                  <p className="text-xs font-medium">{type.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="text-sm font-medium mb-2 block">Add a note (optional)</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="You're awesome because..."
              className="resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="p-4 border-t">
          <Button
            onClick={onSend}
            disabled={!selectedMember || !selectedType || sending}
            className="w-full"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Kudos
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </>
  )
}

export default KudosWidget
