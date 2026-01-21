import { useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Hook for subscribing to real-time updates on a table
 */
export function useRealtime(table, options = {}) {
  const {
    event = '*', // INSERT, UPDATE, DELETE, or *
    filter = null, // e.g., 'board_id=eq.123'
    schema = 'public',
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  } = options

  const channelRef = useRef(null)

  useEffect(() => {
    // Create unique channel name
    const channelName = `realtime:${table}:${filter || 'all'}:${Date.now()}`

    // Configure the subscription
    let subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          filter,
        },
        (payload) => {
          // Call the appropriate handler
          if (payload.eventType === 'INSERT' && onInsert) {
            onInsert(payload.new)
          } else if (payload.eventType === 'UPDATE' && onUpdate) {
            onUpdate(payload.new, payload.old)
          } else if (payload.eventType === 'DELETE' && onDelete) {
            onDelete(payload.old)
          }

          // Call generic onChange handler
          if (onChange) {
            onChange(payload)
          }
        }
      )
      .subscribe()

    channelRef.current = subscription

    // Cleanup on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [table, event, filter, schema, onInsert, onUpdate, onDelete, onChange])

  return channelRef.current
}

/**
 * Hook for subscribing to ticket updates on a specific board
 */
export function useBoardRealtime(boardId, handlers = {}) {
  const { onTicketInsert, onTicketUpdate, onTicketDelete, onAnyChange } = handlers

  useRealtime('tickets', {
    filter: boardId ? `board_id=eq.${boardId}` : null,
    onInsert: onTicketInsert,
    onUpdate: onTicketUpdate,
    onDelete: onTicketDelete,
    onChange: onAnyChange,
  })
}

/**
 * Hook for subscribing to time entry updates
 */
export function useTimeEntriesRealtime(ticketId, handlers = {}) {
  const { onInsert, onUpdate, onDelete, onChange } = handlers

  useRealtime('time_entries', {
    filter: ticketId ? `ticket_id=eq.${ticketId}` : null,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  })
}

/**
 * Hook for subscribing to comment updates
 */
export function useCommentsRealtime(ticketId, handlers = {}) {
  const { onInsert, onUpdate, onDelete, onChange } = handlers

  useRealtime('comments', {
    filter: ticketId ? `ticket_id=eq.${ticketId}` : null,
    onInsert,
    onUpdate,
    onDelete,
    onChange,
  })
}

/**
 * Generic presence hook for showing who's viewing a board/ticket
 */
export function usePresence(roomId, userData) {
  const channelRef = useRef(null)
  const presenceRef = useRef([])

  const updatePresence = useCallback((state) => {
    presenceRef.current = Object.values(state).flat()
  }, [])

  useEffect(() => {
    if (!roomId || !userData) return

    const channel = supabase.channel(`presence:${roomId}`, {
      config: {
        presence: {
          key: userData.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        updatePresence(state)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key, newPresences)
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(userData)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [roomId, userData, updatePresence])

  return presenceRef.current
}
