import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExternalLink, FileText, Download, X, ZoomIn } from 'lucide-react'
import { cn, linkifySegments } from '../lib/utils'

/**
 * Renders markdown content with proper image/link display
 * - Images show as thumbnails that expand on click
 * - Links show as clean hyperlinks
 * - Documents show with file icons
 */
export default function MarkdownContent({ 
  content, 
  className,
  onClick,
}) {
  const [expandedImage, setExpandedImage] = useState(null)

  // Parse and render markdown content
  const renderedContent = useMemo(() => {
    if (!content) return null

    // Split content into parts - text, images, and links
    const parts = []
    let remaining = content
    let key = 0

    // Regex patterns
    const imagePattern = /!\[([^\]]*)\]\(([^)]+)\)/g
    const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

    // First, extract and replace images
    let match
    let lastIndex = 0
    const imageMatches = []
    
    while ((match = imagePattern.exec(content)) !== null) {
      imageMatches.push({
        fullMatch: match[0],
        alt: match[1],
        url: match[2],
        index: match.index,
        endIndex: match.index + match[0].length,
      })
    }

    // Process content with images replaced
    if (imageMatches.length > 0) {
      lastIndex = 0
      for (const img of imageMatches) {
        // Add text before this image
        if (img.index > lastIndex) {
          const textBefore = content.slice(lastIndex, img.index)
          if (textBefore.trim()) {
            parts.push({
              type: 'text',
              content: textBefore,
              key: key++,
            })
          }
        }
        
        // Add the image
        parts.push({
          type: 'image',
          alt: img.alt || 'Attached image',
          url: img.url,
          key: key++,
        })
        
        lastIndex = img.endIndex
      }
      
      // Add remaining text
      if (lastIndex < content.length) {
        const textAfter = content.slice(lastIndex)
        if (textAfter.trim()) {
          parts.push({
            type: 'text',
            content: textAfter,
            key: key++,
          })
        }
      }
    } else {
      // No images, just add the whole content as text
      parts.push({
        type: 'text',
        content: content,
        key: key++,
      })
    }

    // Now process text parts for links
    const finalParts = []
    for (const part of parts) {
      if (part.type !== 'text') {
        finalParts.push(part)
        continue
      }

      // Find links in this text
      const linkMatches = []
      linkPattern.lastIndex = 0
      while ((match = linkPattern.exec(part.content)) !== null) {
        linkMatches.push({
          fullMatch: match[0],
          text: match[1],
          url: match[2],
          index: match.index,
          endIndex: match.index + match[0].length,
        })
      }

      if (linkMatches.length === 0) {
        finalParts.push(part)
        continue
      }

      // Split text around links
      lastIndex = 0
      for (const link of linkMatches) {
        if (link.index > lastIndex) {
          finalParts.push({
            type: 'text',
            content: part.content.slice(lastIndex, link.index),
            key: key++,
          })
        }
        
        finalParts.push({
          type: 'link',
          text: link.text,
          url: link.url,
          key: key++,
        })
        
        lastIndex = link.endIndex
      }
      
      if (lastIndex < part.content.length) {
        finalParts.push({
          type: 'text',
          content: part.content.slice(lastIndex),
          key: key++,
        })
      }
    }

    return finalParts
  }, [content])

  if (!content) {
    return (
      <p 
        className={cn("text-muted-foreground italic cursor-pointer", className)}
        onClick={onClick}
      >
        No description provided. Click to add one.
      </p>
    )
  }

  // Check if content is just plain text (no markdown)
  const hasMarkdown = content.includes('![') || content.includes('](')

  if (!hasMarkdown) {
    const segments = linkifySegments(content)
    return (
      <p 
        className={cn("text-muted-foreground whitespace-pre-wrap cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors", className)}
        onClick={onClick}
        title="Click to edit"
      >
        {segments.map((seg, i) =>
          seg.type === 'link' ? (
            <a
              key={i}
              href={seg.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-brand-orange hover:underline underline-offset-2"
            >
              {seg.value}
            </a>
          ) : (
            seg.value
          )
        )}
      </p>
    )
  }

  return (
    <>
      <div 
        className={cn("cursor-pointer hover:bg-muted/50 p-2 -m-2 rounded-lg transition-colors", className)}
        onClick={onClick}
        title="Click to edit"
      >
        {renderedContent?.map((part) => {
          if (part.type === 'text') {
            const segments = linkifySegments(part.content)
            return (
              <span key={part.key} className="text-muted-foreground whitespace-pre-wrap">
                {segments.map((seg, i) =>
                  seg.type === 'link' ? (
                    <a
                      key={i}
                      href={seg.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-brand-orange hover:underline underline-offset-2"
                    >
                      {seg.value}
                    </a>
                  ) : (
                    seg.value
                  )
                )}
              </span>
            )
          }

          if (part.type === 'image') {
            return (
              <div key={part.key} className="my-3" onClick={(e) => e.stopPropagation()}>
                <div className="relative group inline-block">
                  <img
                    src={part.url}
                    alt={part.alt}
                    className="max-w-full max-h-[300px] rounded-lg border shadow-sm object-contain cursor-zoom-in hover:shadow-md transition-shadow"
                    onClick={(e) => {
                      e.stopPropagation()
                      setExpandedImage(part)
                    }}
                  />
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setExpandedImage(part)
                      }}
                      className="p-1.5 bg-black/60 hover:bg-black/80 rounded-md text-white transition-colors"
                      title="Expand image"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                    <a
                      href={part.url}
                      download={part.alt}
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-black/60 hover:bg-black/80 rounded-md text-white transition-colors"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                </div>
                {part.alt && part.alt !== 'Attached image' && (
                  <p className="text-xs text-muted-foreground mt-1">{part.alt}</p>
                )}
              </div>
            )
          }

          if (part.type === 'link') {
            const isDocument = part.url.includes('storage') || 
                             part.url.includes('.pdf') || 
                             part.url.includes('.doc') ||
                             part.url.includes('.xlsx')
            
            return (
              <a
                key={part.key}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md transition-colors",
                  "text-brand-orange hover:text-brand-orange/80 hover:bg-brand-orange/10",
                  "underline underline-offset-2"
                )}
              >
                {isDocument ? (
                  <FileText className="h-3.5 w-3.5" />
                ) : (
                  <ExternalLink className="h-3 w-3" />
                )}
                {part.text}
              </a>
            )
          }

          return null
        })}
      </div>

      {/* Image Lightbox */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={expandedImage.url}
                alt={expandedImage.alt}
                className="max-w-full max-h-[90vh] rounded-lg object-contain"
              />
              
              {/* Close button */}
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute -top-3 -right-3 p-2 bg-white dark:bg-slate-800 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
              
              {/* Download button */}
              <a
                href={expandedImage.url}
                download={expandedImage.alt}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg shadow-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
              
              {/* Caption */}
              {expandedImage.alt && expandedImage.alt !== 'Attached image' && (
                <p className="absolute bottom-4 left-4 text-white bg-black/50 px-3 py-1.5 rounded-lg text-sm">
                  {expandedImage.alt}
                </p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
