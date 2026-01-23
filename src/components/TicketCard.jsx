import { memo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Clock, 
  MessageSquare, 
  Paperclip, 
  Calendar,
  AlertCircle,
} from 'lucide-react'
import { cn, formatRelativeDate, getStatusInfo, getPriorityInfo, getInitials } from '../lib/utils'
import { Badge } from './ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip'

const TicketCard = memo(function TicketCard({ ticket, isDragging = false }) {
  const priorityInfo = getPriorityInfo(ticket.priority)
  const hasAttachments = ticket.attachments?.length > 0
  const hasDueDate = !!ticket.due_date
  const isOverdue = hasDueDate && new Date(ticket.due_date) < new Date() && ticket.status !== 'done'
  const clientSlug = ticket.client?.slug || ticket.client_id
  const ticketKey = ticket.ticket_id || ticket.id
  const ticketLink = clientSlug ? `/clients/${clientSlug}/tickets/${ticketKey}` : `/tickets/${ticketKey}`

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "group relative rounded-xl border bg-card p-4 shadow-sm transition-all duration-300",
        "hover:shadow-xl hover:shadow-brand-orange/10 hover:border-brand-orange/30",
        "before:absolute before:inset-0 before:rounded-xl before:opacity-0 before:transition-opacity before:duration-500",
        "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        "hover:before:opacity-100 hover:before:animate-gleam",
        isDragging && "shadow-2xl ring-2 ring-brand-orange/40 rotate-2 scale-105 z-50"
      )}
    >
      {/* Priority indicator strip */}
      <div 
        className={cn(
          "absolute left-0 top-0 bottom-0 w-1 rounded-l-xl",
          isOverdue ? "bg-red-500" : priorityInfo.color.replace('priority-', 'bg-priority-')
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

      <Link to={ticketLink} className="block pl-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-xs font-mono text-muted-foreground">
            {ticket.ticket_id}
          </span>
          <Badge variant={ticket.priority} className="text-[10px] px-1.5 py-0">
            {priorityInfo.label}
          </Badge>
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

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          {/* Left side - meta icons */}
          <div className="flex items-center gap-3 text-muted-foreground">
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

            {ticket.estimated_hours && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-[11px]">
                      <Clock className="h-3 w-3" />
                      <span>{ticket.estimated_hours}h</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    Estimated: {ticket.estimated_hours} hours
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
          </div>

          {/* Right side - assignee */}
          {ticket.assigned_user && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-6 w-6 border-2 border-background">
                    <AvatarImage 
                      src={ticket.assigned_user.avatar_url} 
                      alt={ticket.assigned_user.full_name} 
                    />
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {getInitials(ticket.assigned_user.full_name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>
                  {ticket.assigned_user.full_name}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </Link>
    </motion.div>
  )
})

export default TicketCard
