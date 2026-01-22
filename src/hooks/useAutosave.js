import { useState, useEffect, useRef, useCallback } from 'react'
import { useToast } from './useToast'

// Get autosave preference from localStorage
const getAutosaveEnabled = () => {
  const stored = localStorage.getItem('autosave_enabled')
  return stored === null ? true : stored === 'true'
}

/**
 * Autosave hook with debounce and notifications
 * @param {Function} saveFn - Async function to save data
 * @param {any} data - Data to watch for changes
 * @param {Object} options - Configuration options
 * @param {number} options.delay - Debounce delay in ms (default: 1500)
 * @param {string} options.saveMessage - Toast message on save
 * @param {boolean} options.showToast - Whether to show toast notifications
 */
export function useAutosave(saveFn, data, options = {}) {
  const {
    delay = 1500,
    saveMessage = 'Changes saved',
    showToast = true,
  } = options

  const { toast } = useToast()
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isEnabled, setIsEnabled] = useState(getAutosaveEnabled)
  
  const timeoutRef = useRef(null)
  const initialDataRef = useRef(null)
  const isFirstRender = useRef(true)

  // Track initial data
  useEffect(() => {
    if (isFirstRender.current) {
      initialDataRef.current = JSON.stringify(data)
      isFirstRender.current = false
    }
  }, [])

  // Check for changes and trigger autosave
  useEffect(() => {
    if (!isEnabled) return
    
    const currentData = JSON.stringify(data)
    
    // Skip if data hasn't changed from initial
    if (currentData === initialDataRef.current) {
      setHasUnsavedChanges(false)
      return
    }

    setHasUnsavedChanges(true)

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set new timeout for autosave
    timeoutRef.current = setTimeout(async () => {
      try {
        setIsSaving(true)
        await saveFn(data)
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        initialDataRef.current = currentData
        
        if (showToast) {
          toast({
            title: '✓ ' + saveMessage,
            variant: 'default',
            duration: 2000,
            className: 'autosave-toast',
          })
        }
      } catch (error) {
        console.error('Autosave error:', error)
        toast({
          title: 'Failed to save',
          description: error.message,
          variant: 'destructive',
        })
      } finally {
        setIsSaving(false)
      }
    }, delay)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [data, isEnabled, delay, saveFn, showToast, toast, saveMessage])

  // Toggle autosave
  const toggleAutosave = useCallback((enabled) => {
    setIsEnabled(enabled)
    localStorage.setItem('autosave_enabled', String(enabled))
    
    toast({
      title: enabled ? '🔄 Autosave enabled' : '⏸️ Autosave disabled',
      description: enabled 
        ? 'Your changes will be saved automatically' 
        : 'Remember to save your changes manually',
      duration: 3000,
    })
  }, [toast])

  // Manual save function
  const saveNow = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    try {
      setIsSaving(true)
      await saveFn(data)
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      initialDataRef.current = JSON.stringify(data)
      
      toast({
        title: '✓ Saved',
        variant: 'success',
        duration: 2000,
      })
    } catch (error) {
      console.error('Save error:', error)
      toast({
        title: 'Failed to save',
        description: error.message,
        variant: 'destructive',
      })
      throw error
    } finally {
      setIsSaving(false)
    }
  }, [data, saveFn, toast])

  return {
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    isEnabled,
    toggleAutosave,
    saveNow,
  }
}

export default useAutosave
