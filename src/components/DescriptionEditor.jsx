import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, File, Image, FileText, Film, Music,
  Loader2, Paperclip, Check, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn, formatFileSize } from '../lib/utils'
import { Textarea } from './ui/textarea'
import { useToast } from '../hooks/useToast'

// File type icons
const getFileIcon = (type) => {
  if (type?.startsWith('image/')) return Image
  if (type?.startsWith('video/')) return Film
  if (type?.startsWith('audio/')) return Music
  if (type?.includes('pdf') || type?.includes('document')) return FileText
  return File
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

/**
 * Description editor with drag-and-drop file upload
 * Dropped files are uploaded and added to attachments
 */
export default function DescriptionEditor({
  value,
  onChange,
  onFileUpload,
  bucket = 'documents',
  folder = '',
  placeholder = 'Add a description... (drag & drop files here)',
  className,
  minHeight = '150px',
  disabled = false,
}) {
  const { toast } = useToast()
  const textareaRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState([])
  const [recentUploads, setRecentUploads] = useState([])

  // Upload a single file
  const uploadFile = async (file) => {
    const fileId = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
    const filePath = folder ? `${folder}/${fileId}` : fileId

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // Get URL - prefer signed URL for private buckets
      let fileUrl = null
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60 * 24 * 7) // 7 days
      
      if (signed?.signedUrl) {
        fileUrl = signed.signedUrl
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(filePath)
        fileUrl = publicUrl
      }

      const uploadedFile = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        url: fileUrl,
        path: filePath,
        uploadedAt: new Date().toISOString(),
      }

      return uploadedFile
    } catch (error) {
      console.error('Upload error:', error)
      throw error
    }
  }

  // Handle dropped or pasted files
  const handleFiles = useCallback(async (files) => {
    const fileList = Array.from(files)
    if (fileList.length === 0) return

    // Add to uploading state
    const uploadingNames = fileList.map(f => f.name)
    setUploading(prev => [...prev, ...uploadingNames])

    for (const file of fileList) {
      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'File too large',
          description: `${file.name} exceeds ${formatFileSize(MAX_FILE_SIZE)} limit`,
          variant: 'destructive',
        })
        setUploading(prev => prev.filter(n => n !== file.name))
        continue
      }

      try {
        const uploadedFile = await uploadFile(file)
        
        // Add to recent uploads display
        setRecentUploads(prev => [...prev, uploadedFile])
        
        // Notify parent
        if (onFileUpload) {
          onFileUpload(uploadedFile)
        }

        toast({
          title: '📎 File attached',
          description: file.name,
          duration: 2000,
        })

        // For images, optionally insert markdown reference
        if (file.type?.startsWith('image/')) {
          const imageRef = `\n![${file.name}](${uploadedFile.url})\n`
          // Insert at cursor or append
          if (textareaRef.current) {
            const textarea = textareaRef.current
            const start = textarea.selectionStart
            const end = textarea.selectionEnd
            const currentValue = value || ''
            const newValue = currentValue.slice(0, start) + imageRef + currentValue.slice(end)
            onChange(newValue)
          }
        }
      } catch (error) {
        toast({
          title: 'Upload failed',
          description: error.message || `Failed to upload ${file.name}`,
          variant: 'destructive',
        })
      } finally {
        setUploading(prev => prev.filter(n => n !== file.name))
      }
    }

    // Clear recent uploads after a few seconds
    setTimeout(() => {
      setRecentUploads([])
    }, 5000)
  }, [bucket, folder, onFileUpload, onChange, value, toast])

  // Drag events
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set to false if leaving the container entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
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

    if (disabled) return

    const { files } = e.dataTransfer
    if (files?.length) {
      handleFiles(files)
    }
  }

  // Handle paste (Ctrl+V images)
  const handlePaste = (e) => {
    if (disabled) return
    
    const items = e.clipboardData?.items
    if (!items) return

    const files = []
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      e.preventDefault()
      handleFiles(files)
    }
  }

  return (
    <div className={cn("relative", className)}>
      {/* Main textarea with drag-drop overlay */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="relative"
      >
        <Textarea
          ref={textareaRef}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "transition-all",
            isDragging && "border-brand-orange border-dashed bg-brand-orange/5",
          )}
          style={{ minHeight }}
        />

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-brand-orange/10 border-2 border-dashed border-brand-orange rounded-lg flex items-center justify-center pointer-events-none z-10"
            >
              <div className="text-center">
                <Upload className="h-8 w-8 text-brand-orange mx-auto mb-2" />
                <p className="text-sm font-medium text-brand-orange">Drop files to attach</p>
                <p className="text-xs text-muted-foreground">Images, documents, and more</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload progress indicators */}
      <AnimatePresence>
        {uploading.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="mt-2 flex flex-wrap gap-2"
          >
            {uploading.map((name) => (
              <div
                key={name}
                className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm"
              >
                <Loader2 className="h-3 w-3 animate-spin text-brand-orange" />
                <span className="truncate max-w-[150px]">{name}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recently uploaded files */}
      <AnimatePresence>
        {recentUploads.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="mt-2 flex flex-wrap gap-2"
          >
            {recentUploads.map((file) => {
              const FileIcon = getFileIcon(file.type)
              return (
                <div
                  key={file.id}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-700 dark:text-green-400"
                >
                  <Check className="h-3 w-3" />
                  <FileIcon className="h-3 w-3" />
                  <span className="truncate max-w-[150px]">{file.name}</span>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Helper text */}
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        <Paperclip className="h-3 w-3" />
        <span>Drag & drop or paste images/files to attach</span>
      </div>
    </div>
  )
}
