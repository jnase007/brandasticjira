import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, X, File, Image, FileText, Film, Music,
  Loader2, Check, AlertCircle, Download, Eye, Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn, formatFileSize } from '../lib/utils'
import { Button } from './ui/button'
import { useToast } from '../hooks/useToast'

// File type icons
const getFileIcon = (type) => {
  if (type?.startsWith('image/')) return Image
  if (type?.startsWith('video/')) return Film
  if (type?.startsWith('audio/')) return Music
  if (type?.includes('pdf') || type?.includes('document')) return FileText
  return File
}

// Allowed file types
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/csv'],
  all: ['*'],
}

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export function FileUpload({
  bucket = 'documents',
  folder = '',
  accept = 'all',
  multiple = true,
  maxFiles = 10,
  onUpload,
  onRemove,
  existingFiles = [],
  className,
}) {
  const { toast } = useToast()
  const fileInputRef = useRef(null)
  
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState(existingFiles)
  const [uploading, setUploading] = useState({})
  const [errors, setErrors] = useState({})

  // Validate file
  const validateFile = (file) => {
    if (file.size > MAX_FILE_SIZE) {
      return `File too large (max ${formatFileSize(MAX_FILE_SIZE)})`
    }
    
    const allowedTypes = ALLOWED_TYPES[accept] || ALLOWED_TYPES.all
    if (allowedTypes[0] !== '*' && !allowedTypes.includes(file.type)) {
      return 'File type not allowed'
    }
    
    return null
  }

  // Upload file to Supabase
  const uploadFile = async (file) => {
    const fileId = `${Date.now()}-${file.name}`
    const filePath = folder ? `${folder}/${fileId}` : fileId
    
    setUploading((prev) => ({ ...prev, [file.name]: true }))
    setErrors((prev) => ({ ...prev, [file.name]: null }))

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) throw error

      // Prefer signed URL for private buckets, fallback to public URL
      let fileUrl = null
      const { data: signed } = await supabase.storage
        .from(bucket)
        .createSignedUrl(filePath, 60 * 60)
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

      setFiles((prev) => [...prev, uploadedFile])
      
      if (onUpload) {
        onUpload(uploadedFile)
      }

      toast({
        title: '📎 File uploaded',
        description: file.name,
        duration: 2000,
      })

      return uploadedFile
    } catch (error) {
      console.error('Upload error:', error)
      setErrors((prev) => ({ ...prev, [file.name]: error.message }))
      
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      })
      
      return null
    } finally {
      setUploading((prev) => ({ ...prev, [file.name]: false }))
    }
  }

  // Handle file selection
  const handleFiles = useCallback(async (selectedFiles) => {
    const fileList = Array.from(selectedFiles)
    
    // Check max files limit
    if (files.length + fileList.length > maxFiles) {
      toast({
        title: 'Too many files',
        description: `Maximum ${maxFiles} files allowed`,
        variant: 'destructive',
      })
      return
    }

    // Validate and upload each file
    for (const file of fileList) {
      const error = validateFile(file)
      if (error) {
        setErrors((prev) => ({ ...prev, [file.name]: error }))
        toast({
          title: 'Invalid file',
          description: `${file.name}: ${error}`,
          variant: 'destructive',
        })
        continue
      }
      
      await uploadFile(file)
    }
  }, [files.length, maxFiles])

  // Drag events
  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const { files: droppedFiles } = e.dataTransfer
    if (droppedFiles?.length) {
      handleFiles(droppedFiles)
    }
  }

  // Remove file
  const handleRemove = async (file) => {
    try {
      // Delete from storage
      if (file.path) {
        await supabase.storage.from(bucket).remove([file.path])
      }
      
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
      
      if (onRemove) {
        onRemove(file)
      }
      
      toast({
        title: 'File removed',
        duration: 2000,
      })
    } catch (error) {
      console.error('Remove error:', error)
      toast({
        title: 'Failed to remove',
        variant: 'destructive',
      })
    }
  }

  // Click to open file picker
  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const acceptTypes = accept === 'image' 
    ? 'image/*' 
    : accept === 'document' 
      ? '.pdf,.doc,.docx,.txt,.csv'
      : 'image/*,.pdf,application/pdf,.doc,.docx,.txt,.csv,application/*'

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          "relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200",
          "hover:border-brand-orange/50 hover:bg-brand-orange/5",
          isDragging && "border-brand-orange bg-brand-orange/10 scale-[1.02]",
          !isDragging && "border-muted-foreground/25"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptTypes}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
        
        <motion.div
          animate={{ scale: isDragging ? 1.1 : 1 }}
          className="flex flex-col items-center gap-3"
        >
          <div className={cn(
            "p-4 rounded-2xl transition-colors",
            isDragging ? "bg-brand-orange/20" : "bg-muted/50"
          )}>
            <Upload className={cn(
              "h-8 w-8 transition-colors",
              isDragging ? "text-brand-orange" : "text-muted-foreground"
            )} />
          </div>
          
          <div>
            <p className="font-medium">
              {isDragging ? 'Drop files here!' : 'Drag & drop files here'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or click to browse • Max {formatFileSize(MAX_FILE_SIZE)} per file
            </p>
          </div>
        </motion.div>

        {/* Drag overlay */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl bg-brand-orange/10 pointer-events-none"
            />
          )}
        </AnimatePresence>
      </div>

      {/* File List */}
      <AnimatePresence mode="popLayout">
        {files.map((file) => {
          const FileIcon = getFileIcon(file.type)
          const isUploading = uploading[file.name]
          const error = errors[file.name]
          const isImage = file.type?.startsWith('image/')
          
          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                error ? "border-red-500/30 bg-red-500/5" : "hover:bg-muted/50"
              )}
            >
              {/* Preview/Icon */}
              {isImage && file.url ? (
                <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={file.url}
                    alt={file.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                  <FileIcon className="h-6 w-6 text-muted-foreground" />
                </div>
              )}

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                  {error && (
                    <span className="text-red-500 ml-2">• {error}</span>
                  )}
                </p>
              </div>

              {/* Status/Actions */}
              <div className="flex items-center gap-2">
                {isUploading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
                ) : error ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <>
                    {file.url && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                        >
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          asChild
                        >
                          <a href={file.url} download={file.name}>
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRemove(file)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </motion.div>
          )
        })}
      </AnimatePresence>

      {/* File count */}
      {files.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {files.length} of {maxFiles} files
        </p>
      )}
    </div>
  )
}

// Compact inline file upload for comments/quick actions
export function InlineFileUpload({ onUpload, accept = 'all' }) {
  const fileInputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()

  const handleChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast({
        title: 'File too large',
        description: `Maximum size is ${formatFileSize(MAX_FILE_SIZE)}`,
        variant: 'destructive',
      })
      return
    }

    setUploading(true)
    
    try {
      const fileId = `${Date.now()}-${file.name}`
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileId, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileId)

      onUpload({
        name: file.name,
        url: publicUrl,
        type: file.type,
        size: file.size,
      })

      toast({
        title: '📎 Attached',
        description: file.name,
        duration: 2000,
      })
    } catch (error) {
      toast({
        title: 'Upload failed',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept === 'image' ? 'image/*' : '*'}
        onChange={handleChange}
        className="hidden"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
      </Button>
    </>
  )
}

export default FileUpload
