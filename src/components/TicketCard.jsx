import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Clock, 
  Paperclip, 
  Calendar,
  AlertCircle,
  UserCircle2,
  ClipboardList,
  UserCheck,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn, formatRelativeDate, getInitials, getStatusInfo, getHoursProgress } from '../lib/utils'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'
import { Progress } from './ui/progress'

const TicketCard = memo(function TicketCard({ ticket, isDragging = false }) {
  const navigate = useNavigate()
  const statusInfo = getStatusInfo(ticket.status)
  const hasAttachments = ticket.attachments?.length > 0
  const hasDueDate = !!ticket.due_date
  const isOverdue = hasDueDate && new Date(ticket.due_date) < new Date() && !['done', 'closed'].includes(ticket.status)
  const isClientHomework = ticket.ticket_type === 'client_homework'
  const clientSlug = ticket.client?.slug || ticket.client_id
  const ticketKey = ticket.ticket_id || ticket.id
  const ticketLink = clientSlug ? `/clients/${clientSlug}/tickets/${ticketKey}` : `/tickets/${ticketKey}`
  
  // Calculate hours progress if we have estimated hours
  const hoursProgress = getHoursProgress(ticket.estimated_hours, ticket.tracked_minutes || ticket.actual_minutes || 0)

  // Handle click to navigate to ticket detail
  const handleClick = useCallback((e) => {
    // Don't navigate if we're dragging
    if (isDragging) return
    
    // Navigate to ticket detail
    navigate(ticketLink)
  }, [navigate, ticketLink, isDragging])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className={cn(
        "group relative rounded-xl border bg-card p-4 shadow-sm transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:shadow-brand-orange/10 hover:border-brand-orange/30",
        "before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-500",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "hover:before:opacity-100 hover:before:animate-gleam",
        isDragging && "shadow-2xl ring-2 ring-brand-orange/40 rotate-2 scale-105 z-50"
      )}
    >
      {/* Left indicator strip */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          isOverdue ? "bg-red-500" : "bg-brand-orange"
        )}
      />
      
      {/* Overdue badge */}
      {isOverdue && (
        <div className="absolute -top-2 -right-2 z-10">
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 shadow-lg animate-pulse">
            OVERDUE
          </Badge>
        </div>
      )}

      <div className="pl-2">
        {/* Header with Assignee */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">
              {ticket.ticket_id}
            </span>
            {isClientHomework && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 bg-orange-50 border-orange-300 text-orange-700 dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-400">
                      <UserCheck className="h-2.5 w-2.5 mr-0.5" />
                      HW
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>Client Homework</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          
          {/* Prominent Assignee Avatar */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                {ticket.assigned_user ? (
                  <div className="relative">
                    <Avatar className="h-8 w-8 border-2 border-white dark:border-slate-800 shadow-md ring-2 ring-brand-orange/20 transition-all duration-300 group-hover:ring-brand-orange/50 group-hover:scale-110">
                      <AvatarImage 
                        src={ticket.assigned_user.avatar_url} 
                        alt={ticket.assigned_user.full_name}
                        className="object-cover"
                      />
                      <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-brand-orange to-amber-500 text-white">
                        {getInitials(ticket.assigned_user.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online indicator dot */}
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-800" />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center bg-slate-50 dark:bg-slate-800/50">
                    <UserCircle2 className="h-4 w-4 text-slate-400" />
                  </div>
                )}
              </TooltipTrigger>
              <TooltipContent>
                {ticket.assigned_user ? ticket.assigned_user.full_name : 'Unassigned'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Title */}
        <h4 className="font-medium text-sm leading-snug mb-3 line-clamp-2 group-hover:text-brand-orange transition-colors duration-300">
          {ticket.title}
        </h4>

        {/* Tags */}
        {ticket.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {ticket.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-1.5 py-0.5 text-[10px] rounded bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))}
            {ticket.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{ticket.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Footer - Meta info */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/50 text-muted-foreground">
          {hasDueDate && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1 text-[11px]",
                    isOverdue && "text-destructive"
                  )}>
                    {isOverdue ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Calendar className="h-3 w-3" />
                    )}
                    <span>{formatRelativeDate(ticket.due_date)}</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Due: {new Date(ticket.due_date).toLocaleDateString()}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {ticket.estimated_hours > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-center gap-1.5 text-[11px] px-1.5 py-0.5 rounded-md",
                    hoursProgress.status === 'over' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                    hoursProgress.status === 'warning' && "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
                    hoursProgress.status === 'on_track' && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  )}>
                    {hoursProgress.status === 'over' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : hoursProgress.status === 'warning' ? (
                      <AlertCircle className="h-3 w-3" />
                    ) : (
                      <Target className="h-3 w-3" />
                    )}
                    <span className="font-medium">{hoursProgress.actualHours}/{ticket.estimated_hours}h</span>
                    <span className="text-[9px] opacity-70">({hoursProgress.percentage}%)</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-[200px]">
                  <div className="space-y-1">
                    <div className="font-medium">Hours Progress</div>
                    <div className="text-xs">
                      Actual: {hoursProgress.actualHours}h / Estimated: {ticket.estimated_hours}h
                    </div>
                    {hoursProgress.status === 'over' && (
                      <div className="text-red-400 text-xs">Over by {hoursProgress.overBy.toFixed(1)}h</div>
                    )}
                    {hoursProgress.status === 'on_track' && hoursProgress.remaining > 0 && (
                      <div className="text-green-400 text-xs">{hoursProgress.remaining.toFixed(1)}h remaining</div>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {hasAttachments && (
            <div className="flex items-center gap-1 text-[11px]">
              <Paperclip className="h-3 w-3" />
              <span>{ticket.attachments.length}</span>
            </div>
          )}
          
          {/* Show assignee name in footer for clarity */}
          {ticket.assigned_user && (
            <div className="flex items-center gap-1 text-[11px] ml-auto">
              <span className="text-muted-foreground/70">→</span>
              <span className="font-medium text-foreground/80 truncate max-w-[80px]">
                {ticket.assigned_user.full_name?.split(' ')[0]}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
})

export default TicketCard
