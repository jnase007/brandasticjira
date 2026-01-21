import { motion } from 'framer-motion'
import { 
  Users, Kanban, Clock, Search, Trophy, FileText,
  Rocket, Sparkles, Coffee, Heart, Zap
} from 'lucide-react'
import { Button } from './ui/button'
import { EMPTY_STATES } from '../lib/funMessages'

const ICONS = {
  clients: Users,
  boards: Kanban,
  tickets: FileText,
  timeEntries: Clock,
  search: Search,
  achievements: Trophy,
}

const DECORATIONS = [Rocket, Sparkles, Coffee, Heart, Zap]

export default function EmptyState({ 
  type = 'clients', 
  onAction,
  customTitle,
  customSubtitle,
  customAction,
  showDecoration = true 
}) {
  const content = EMPTY_STATES[type] || EMPTY_STATES.clients
  const Icon = ICONS[type] || Users
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      {/* Animated Icon with decorations */}
      <div className="relative mb-6">
        {showDecoration && DECORATIONS.map((DecIcon, i) => (
          <motion.div
            key={i}
            className="absolute text-brand-orange/30"
            style={{
              left: `${50 + 50 * Math.cos((i * 2 * Math.PI) / DECORATIONS.length)}%`,
              top: `${50 + 50 * Math.sin((i * 2 * Math.PI) / DECORATIONS.length)}%`,
            }}
            animate={{
              y: [0, -10, 0],
              opacity: [0.3, 0.6, 0.3],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          >
            <DecIcon className="h-5 w-5" />
          </motion.div>
        ))}
        
        <motion.div
          className="w-24 h-24 rounded-2xl bg-gradient-to-br from-brand-orange/10 to-brand-coral/5 flex items-center justify-center"
          animate={{
            scale: [1, 1.05, 1],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
          }}
        >
          <Icon className="h-10 w-10 text-brand-orange" />
        </motion.div>
      </div>

      {/* Title */}
      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-xl font-bold mb-2"
      >
        {customTitle || content.title}
      </motion.h3>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground max-w-md mb-6"
      >
        {customSubtitle || content.subtitle}
      </motion.p>

      {/* Action Button */}
      {(onAction || content.action) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            onClick={onAction}
            className="gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" />
            {customAction || content.action}
          </Button>
        </motion.div>
      )}

      {/* Fun floating emoji */}
      <motion.div
        className="mt-8 text-4xl"
        animate={{
          y: [0, -10, 0],
          rotate: [0, 10, -10, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      >
        {type === 'clients' && '🎯'}
        {type === 'boards' && '📋'}
        {type === 'tickets' && '✅'}
        {type === 'timeEntries' && '⏰'}
        {type === 'search' && '🔍'}
        {type === 'achievements' && '🏆'}
      </motion.div>
    </motion.div>
  )
}
