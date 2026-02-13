import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AtSign, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn } from '../lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

/**
 * MentionInput - A textarea/input that supports @mentions
 * 
 * Features:
 * - Type @ to trigger user dropdown
 * - Filter users as you type
 * - Insert mention into text
 * - Returns list of mentioned user IDs
 */
const MentionInput = forwardRef(({
  value,
  onChange,
  onMentionsChange,
  placeholder = "Type @ to mention someone...",
  className,
  multiline = true,
  rows = 4,
  onKeyDown,
  disabled = false,
}, ref) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [teamMembers, setTeamMembers] = useState([])
  const [filteredMembers, setFilteredMembers] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  // Expose methods via ref
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    extractMentionedUserIds: () => extractMentionedUserIds(value),
  }))

  // Fetch all team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .order('full_name')

      if (!error && data) {
        setTeamMembers(data)
      }
    }
    fetchTeamMembers()
  }, [])

  // Filter members based on search query
  useEffect(() => {
    if (searchQuery.length > 0) {
      const filtered = teamMembers.filter(member =>
        member.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredMembers(filtered.slice(0, 8)) // Limit to 8 results
    } else {
      setFilteredMembers(teamMembers.slice(0, 8))
    }
    setSelectedIndex(0)
  }, [searchQuery, teamMembers])

  // Calculate dropdown position based on cursor
  const calculateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return

    const input = inputRef.current
    const { selectionStart } = input
    
    // Create a temporary element to measure text dimensions
    const mirror = document.createElement('div')
    mirror.style.cssText = window.getComputedStyle(input).cssText
    mirror.style.position = 'absolute'
    mirror.style.visibility = 'hidden'
    mirror.style.whiteSpace = 'pre-wrap'
    mirror.style.wordWrap = 'break-word'
    mirror.style.width = `${input.clientWidth}px`
    mirror.style.height = 'auto'
    
    // Get text up to cursor and measure
    const textBeforeCursor = value.substring(0, selectionStart)
    mirror.textContent = textBeforeCursor
    
    document.body.appendChild(mirror)
    
    const rect = input.getBoundingClientRect()
    const mirrorHeight = mirror.offsetHeight
    
    document.body.removeChild(mirror)

    // Position dropdown below the current line
    setDropdownPosition({
      top: Math.min(mirrorHeight, input.clientHeight) + 8,
      left: 0,
    })
  }, [value])

  // Handle input change
  const handleChange = (e) => {
    const newValue = e.target.value
    const cursor = e.target.selectionStart
    setCursorPosition(cursor)
    onChange(newValue)

    // Check for @ symbol
    const textBeforeCursor = newValue.substring(0, cursor)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      // Check if @ is at start or after a space/newline
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      const isValidMention = charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0

      if (isValidMention) {
        const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1)
        // Check if there's a space after the @ (mention would be complete)
        if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
          setMentionStartIndex(lastAtIndex)
          setSearchQuery(textAfterAt)
          setShowDropdown(true)
          calculateDropdownPosition()
          return
        }
      }
    }

    setShowDropdown(false)
    setMentionStartIndex(-1)
    setSearchQuery('')
  }

  // Insert a mention
  const insertMention = (member) => {
    if (mentionStartIndex === -1) return

    const beforeMention = value.substring(0, mentionStartIndex)
    const afterMention = value.substring(cursorPosition)
    const mentionText = `@${member.full_name} `
    
    const newValue = beforeMention + mentionText + afterMention
    onChange(newValue)

    // Update mentions list
    if (onMentionsChange) {
      const allMentions = extractMentionedUserIds(newValue)
      onMentionsChange(allMentions)
    }

    // Close dropdown and reset
    setShowDropdown(false)
    setMentionStartIndex(-1)
    setSearchQuery('')

    // Focus back on input and set cursor position
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        const newCursorPos = mentionStartIndex + mentionText.length
        inputRef.current.setSelectionRange(newCursorPos, newCursorPos)
      }
    }, 0)
  }

  // Extract mentioned user IDs from text
  const extractMentionedUserIds = (text) => {
    const mentionedIds = []
    const mentionPattern = /@([^@\n]+?)(?=\s|$)/g
    let match

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionedName = match[1].trim()
      const member = teamMembers.find(m => 
        m.full_name?.toLowerCase() === mentionedName.toLowerCase()
      )
      if (member && !mentionedIds.includes(member.id)) {
        mentionedIds.push(member.id)
      }
    }

    return mentionedIds
  }

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (showDropdown && filteredMembers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev < filteredMembers.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredMembers.length - 1
          )
          break
        case 'Enter':
          if (showDropdown) {
            e.preventDefault()
            insertMention(filteredMembers[selectedIndex])
            return
          }
          break
        case 'Escape':
          e.preventDefault()
          setShowDropdown(false)
          break
        case 'Tab':
          if (showDropdown) {
            e.preventDefault()
            insertMention(filteredMembers[selectedIndex])
            return
          }
          break
      }
    }

    // Pass through to parent handler
    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const InputComponent = multiline ? 'textarea' : 'input'

  return (
    <div className="relative">
      <InputComponent
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={multiline ? rows : undefined}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          multiline && "min-h-[80px] resize-none",
          className
        )}
      />

      {/* Mention Dropdown */}
      <AnimatePresence>
        {showDropdown && filteredMembers.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
            }}
            className="absolute z-50 w-64 max-h-64 overflow-y-auto bg-popover border rounded-xl shadow-lg"
          >
            <div className="p-1">
              <div className="px-2 py-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <AtSign className="h-3 w-3" />
                Mention a team member
              </div>
              {filteredMembers.map((member, index) => (
                <motion.button
                  key={member.id}
                  type="button"
                  onClick={() => insertMention(member)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={cn(
                    "w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-colors",
                    index === selectedIndex 
                      ? "bg-accent text-accent-foreground" 
                      : "hover:bg-muted"
                  )}
                >
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={member.avatar_url} referrerPolicy="no-referrer" />
                    <AvatarFallback className="text-xs bg-brand-orange/10 text-brand-orange">
                      {member.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.full_name}</p>
                    {member.role && (
                      <p className="text-xs text-muted-foreground truncate capitalize">
                        {member.role}
                      </p>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      {!showDropdown && !value && (
        <div className="absolute bottom-2 right-2 pointer-events-none">
          <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
            <AtSign className="h-3 w-3" /> to mention
          </span>
        </div>
      )}
    </div>
  )
})

MentionInput.displayName = 'MentionInput'

/**
 * Utility function to send mention notifications
 * Call this after saving a comment/message
 */
export async function sendMentionNotifications({
  mentionedUserIds,
  fromUserId,
  fromUserName,
  entityType, // 'ticket', 'client_note', etc.
  entityId,
  entityName,
  messagePreview,
  clientId = null,
}) {
  if (!mentionedUserIds || mentionedUserIds.length === 0) return

  const notifications = mentionedUserIds
    .filter(id => id !== fromUserId) // Don't notify yourself
    .map(userId => ({
      user_id: userId,
      type: 'mention',
      title: `${fromUserName} mentioned you`,
      message: messagePreview?.substring(0, 100) + (messagePreview?.length > 100 ? '...' : ''),
      data: {
        from_user_id: fromUserId,
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        client_id: clientId,
      },
      read: false,
    }))

  if (notifications.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications)

    if (error) {
      console.error('Error sending mention notifications:', error)
    }
  }
}

/**
 * Component to render text with highlighted mentions
 */
export function MentionText({ text, className }) {
  if (!text) return null

  // Replace @Name with styled spans
  const parts = text.split(/(@[^@\s]+(?:\s[^@\s]+)?)/g)

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span 
              key={index} 
              className="text-brand-orange font-medium bg-brand-orange/10 px-1 rounded"
            >
              {part}
            </span>
          )
        }
        return part
      })}
    </span>
  )
}

export default MentionInput
