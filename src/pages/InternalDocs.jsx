import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookOpen, ExternalLink, Loader2, Plus, Trash2, Video } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/useToast'
import { DOC_COLLECTIONS, SETUP_SQL, detectDocKind, parseLoomId } from '../lib/docs'

export default function InternalDocs() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docs, setDocs] = useState([])
  const [collection, setCollection] = useState('videos')
  const [dump, setDump] = useState('')
  const [notes, setNotes] = useState('')
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [query, setQuery] = useState('')

  const fetchDocs = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('internal_docs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      setSetupNeeded(true)
      setDocs([])
    } else {
      setSetupNeeded(false)
      setDocs(data || [])
    }
    setLoading(false)
  }, [toast])

  useEffect(() => {
    fetchDocs()
  }, [fetchDocs])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return docs.filter((doc) => {
      const inCollection = collection === 'all' || doc.collection === collection
      if (!inCollection) return false
      if (!q) return true
      return [doc.title, doc.notes, doc.url, doc.collection].join(' ').toLowerCase().includes(q)
    })
  }, [docs, collection, query])

  const addDoc = async () => {
    const value = dump.trim()
    if (!value) {
      toast({ title: 'Paste a Loom URL or title first', variant: 'destructive' })
      return
    }
    const kind = detectDocKind(value)
    const title = kind === 'loom'
      ? (notes.trim() || 'Loom tutorial')
      : (/^https?:\/\//i.test(value) ? (notes.trim() || 'Internal link') : value)
    const url = kind === 'loom' || /^https?:\/\//i.test(value) ? value : null
    setSaving(true)
    const { error } = await supabase.from('internal_docs').insert({
      title,
      url,
      notes: notes.trim() || null,
      collection: collection === 'all' ? 'videos' : collection,
      kind,
      created_by: user?.id || null,
    })
    setSaving(false)
    if (error) {
      toast({ title: 'Could not save', description: error.message, variant: 'destructive' })
      return
    }
    setDump('')
    setNotes('')
    toast({ title: 'Added to Internal Docs' })
    fetchDocs()
  }

  const removeDoc = async (id) => {
    const { error } = await supabase.from('internal_docs').delete().eq('id', id)
    if (error) {
      toast({ title: 'Could not delete', description: error.message, variant: 'destructive' })
      return
    }
    setDocs((prev) => prev.filter((doc) => doc.id !== id))
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold">Internal Docs</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Company wiki. Paste a Loom, hit Enter. Not on the client page.
        </p>
      </div>
      {setupNeeded && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="font-semibold">Internal Docs need one SQL run</p>
            <p className="text-sm text-muted-foreground mt-1">{SETUP_SQL}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Card>
          <CardContent className="p-3 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 pt-1">
              Collections
            </p>
            <button
              type="button"
              onClick={() => setCollection('all')}
              className={cn(
                'w-full text-left rounded-lg px-3 py-2 text-sm',
                collection === 'all' ? 'bg-orange-50 text-orange-800 font-semibold' : 'hover:bg-muted'
              )}
            >
              All
            </button>
            {DOC_COLLECTIONS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setCollection(item.value)}
                className={cn(
                  'w-full text-left rounded-lg px-3 py-2 text-sm',
                  collection === item.value ? 'bg-orange-50 text-orange-800 font-semibold' : 'hover:bg-muted'
                )}
              >
                {item.label}
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search videos and how-tos…"
          />
          <Card className="border-orange-200 bg-orange-50/40">
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="font-semibold">Dump it here.</p>
                <p className="text-sm text-muted-foreground">Loom URL or a short note. Tag it. Done.</p>
              </div>
              <Input
                value={dump}
                onChange={(e) => setDump(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    addDoc()
                  }
                }}
                placeholder="https://www.loom.com/share/…"
              />
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional: one-line what this is for"
                rows={2}
              />
              <div className="flex justify-end">
                <Button onClick={addDoc} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  Add to Internal Docs
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Loading docs…
                </div>
              ) : visible.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p className="font-medium">Nothing in {collection === 'all' ? 'Internal Docs' : collection} yet</p>
                  <p className="text-sm">Paste a Loom to start the company video dump.</p>
                </div>
              ) : (
                visible.map((doc) => {
                  const loomId = parseLoomId(doc.url || '')
                  const playing = loomId && openId === doc.id
                  return (
                    <div key={doc.id} className="p-4 border-b last:border-0">
                      <div className="flex items-start gap-3">
                        <button
                          type="button"
                          className="h-16 w-24 rounded-xl bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0"
                          onClick={() => loomId && setOpenId(playing ? null : doc.id)}
                        >
                          {doc.kind === 'loom' ? (playing ? 'HIDE' : 'PLAY') : 'NOTE'}
                        </button>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          onClick={() => loomId && setOpenId(playing ? null : doc.id)}
                        >
                          <h3 className="font-semibold truncate">{doc.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {doc.notes || doc.url || 'Internal note'}
                          </p>
                        </button>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{doc.collection}</Badge>
                          <Button size="icon" variant="ghost" onClick={() => removeDoc(doc.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {playing && (
                        <div className="mt-3 space-y-2">
                          <div className="aspect-video overflow-hidden rounded-xl bg-slate-900">
                            <iframe
                              title={doc.title}
                              src={`https://www.loom.com/embed/${loomId}?autoplay=1`}
                              allowFullScreen
                              className="h-full w-full border-0"
                            />
                          </div>
                          <a
                            href={`https://www.loom.com/share/${loomId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-blue-600"
                          >
                            <Video className="h-3.5 w-3.5" />
                            Open Loom
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
