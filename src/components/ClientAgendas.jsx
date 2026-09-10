import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Copy, Loader2, Pencil, Plus, Presentation, Search, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { useToast } from '../hooks/useToast'
import {
  SETUP_SQL,
  defaultAgendaTitle,
  stampKind,
  toISODate,
} from '../lib/docs'

const AGENDA_TYPE = 'Weekly client review'

function StampNotes({ text, large = false }) {
  const lines = String(text || '').split('\n').filter((line) => line.trim())
  if (!lines.length) return <p className="text-muted-foreground">No notes yet.</p>
  return (
    <ul className={cn('space-y-3', large && 'space-y-4')}>
      {lines.map((line, i) => {
        const kind = stampKind(line)
        return (
          <li key={`${i}-${line}`} className={cn('leading-relaxed', large && 'text-2xl')}>
            {line}
            {kind && (
              <span
                className={cn(
                  'ml-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide align-middle',
                  large && 'text-sm px-3 py-1',
                  kind === 'due' && 'bg-amber-100 text-amber-800',
                  kind === 'need' && 'bg-blue-100 text-blue-800',
                  kind === 'sent' && 'bg-emerald-100 text-emerald-800'
                )}
              >
                {kind}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function formatShortDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatLongDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function agendaStatus(row) {
  return (row?.topic_count || 0) > 0 ? 'Complete' : 'Draft'
}

export default function ClientAgendas({ client }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [agendas, setAgendas] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [agenda, setAgenda] = useState(null)
  const [topics, setTopics] = useState([])
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [saving, setSaving] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [mode, setMode] = useState('run')
  const [presentOpen, setPresentOpen] = useState(false)
  const [presentIndex, setPresentIndex] = useState(0)
  const [topicForm, setTopicForm] = useState({ item: '', presenter: '', notes: '' })
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [sortOrder, setSortOrder] = useState('newest')
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyDate, setCopyDate] = useState('')
  const [emptyDate, setEmptyDate] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [newDate, setNewDate] = useState('')

  const loadList = useCallback(async (preferId) => {
    if (!client?.id) return []
    setLoadingList(true)
    const { data, error } = await supabase
      .from('client_agendas')
      .select('id, client_id, meeting_date, title, created_at, updated_at')
      .eq('client_id', client.id)
      .order('meeting_date', { ascending: false })
    if (error) {
      setSetupNeeded(true)
      setAgendas([])
      setLoadingList(false)
      return []
    }
    setSetupNeeded(false)
    const rows = data || []
    const withCounts = await Promise.all(rows.map(async (row) => {
      const { data: topicRows } = await supabase
        .from('client_agenda_topics')
        .select('item, notes')
        .eq('agenda_id', row.id)
      const topicsForSearch = topicRows || []
      return {
        ...row,
        topic_count: topicsForSearch.length,
        search_blob: `${row.title || ''} ${AGENDA_TYPE} ${topicsForSearch.map((topic) => `${topic.item || ''} ${topic.notes || ''}`).join(' ')}`.toLowerCase(),
      }
    }))
    setAgendas(withCounts)
    setLoadingList(false)
    setSelectedId((current) => {
      const nextId = preferId || current || withCounts[0]?.id || null
      if (nextId && withCounts.some((row) => row.id === nextId)) return nextId
      return withCounts[0]?.id || null
    })
    return withCounts
  }, [client?.id])

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setAgenda(null)
      setTopics([])
      return
    }
    setLoadingDetail(true)
    const { data, error } = await supabase
      .from('client_agendas')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) {
      setAgenda(null)
      setTopics([])
      setLoadingDetail(false)
      return
    }
    const { data: topicRows } = await supabase
      .from('client_agenda_topics')
      .select('*')
      .eq('agenda_id', data.id)
      .order('sort_order')
    const nextTopics = topicRows || []
    setAgenda(data)
    setTopics(nextTopics)
    setMode(nextTopics.length ? 'run' : 'prep')
    setLoadingDetail(false)
  }, [])

  useEffect(() => {
    loadList()
  }, [client?.id])

  useEffect(() => {
    loadDetail(selectedId)
  }, [selectedId, loadDetail])

  useEffect(() => {
    if (!presentOpen) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') setPresentOpen(false)
      if (event.key === 'ArrowRight' || event.key === 'j' || event.key === 'J') {
        setPresentIndex((index) => Math.min(topics.length - 1, index + 1))
      }
      if (event.key === 'ArrowLeft' || event.key === 'k' || event.key === 'K') {
        setPresentIndex((index) => Math.max(0, index - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [presentOpen, topics.length])

  const createAgendaForDate = async (isoDate, { seed = false, copyFrom = null } = {}) => {
    if (!isoDate) return null
    const existing = agendas.find((row) => row.meeting_date === isoDate)
    if (existing && !copyFrom) {
      setSelectedId(existing.id)
      setEmptyDate('')
      return existing
    }
    if (existing && copyFrom) {
      toast({ title: 'An agenda already exists for that date', variant: 'destructive' })
      return null
    }
    setSaving(true)
    const title = defaultAgendaTitle(client.name, isoDate)
    const { data, error } = await supabase
      .from('client_agendas')
      .insert({
        client_id: client.id,
        meeting_date: isoDate,
        title,
        created_by: user?.id || null,
      })
      .select()
      .single()
    if (error) {
      setSaving(false)
      toast({ title: 'Could not create agenda', description: error.message, variant: 'destructive' })
      return null
    }
    if (copyFrom) {
      const { data: prevTopics } = await supabase
        .from('client_agenda_topics')
        .select('*')
        .eq('agenda_id', copyFrom.id)
        .order('sort_order')
      if (prevTopics?.length) {
        await supabase.from('client_agenda_topics').insert(
          prevTopics.map((topic, index) => ({
            agenda_id: data.id,
            item: topic.item,
            presenter: topic.presenter,
            notes: topic.notes,
            sort_order: index,
          }))
        )
      }
    } else if (seed) {
      await supabase.from('client_agenda_topics').insert([
        { agenda_id: data.id, item: 'Marketing Updates', presenter: '', notes: '', sort_order: 0 },
        { agenda_id: data.id, item: 'Digital', presenter: '', notes: '', sort_order: 1 },
      ])
    }
    setSaving(false)
    setEmptyDate('')
    await loadList(data.id)
    setSelectedId(data.id)
    toast({ title: copyFrom ? 'Agenda copied' : 'Agenda created' })
    return data
  }

  const addTopic = async () => {
    if (!topicForm.item.trim()) {
      toast({ title: 'Item is required', variant: 'destructive' })
      return
    }
    if (!agenda) return
    setSaving(true)
    const { error } = await supabase.from('client_agenda_topics').insert({
      agenda_id: agenda.id,
      item: topicForm.item.trim(),
      presenter: topicForm.presenter.trim() || null,
      notes: topicForm.notes.trim() || null,
      sort_order: topics.length,
    })
    setSaving(false)
    if (error) {
      toast({ title: 'Could not add topic', description: error.message, variant: 'destructive' })
      return
    }
    setTopicForm({ item: '', presenter: '', notes: '' })
    loadDetail(agenda.id)
    loadList(agenda.id)
  }

  const saveTopic = async (topic, patch) => {
    await supabase.from('client_agenda_topics').update(patch).eq('id', topic.id)
  }

  const deleteTopic = async (id) => {
    await supabase.from('client_agenda_topics').delete().eq('id', id)
    setTopics((prev) => prev.filter((topic) => topic.id !== id))
    if (agenda) loadList(agenda.id)
  }

  const startPresent = (index = 0) => {
    if (!topics.length) return
    setPresentIndex(index)
    setPresentOpen(true)
  }

  const visibleAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let rows = [...agendas]
    if (q) {
      rows = rows.filter((row) => (row.search_blob || '').includes(q))
    }
    rows.sort((a, b) => {
      const left = a.meeting_date || ''
      const right = b.meeting_date || ''
      return sortOrder === 'oldest' ? left.localeCompare(right) : right.localeCompare(left)
    })
    return rows
  }, [agendas, searchQuery, sortOrder])

  const onPickDate = (value) => {
    setDateFilter(value)
    if (!value) {
      setEmptyDate('')
      return
    }
    const match = agendas.find((row) => row.meeting_date === value)
    if (match) {
      setSelectedId(match.id)
      setEmptyDate('')
    } else {
      setSelectedId(null)
      setEmptyDate(value)
    }
  }

  const current = topics[presentIndex]
  const title = agenda?.title || defaultAgendaTitle(client.name, agenda?.meeting_date || toISODate())
  const status = agendaStatus({ topic_count: topics.length })

  if (setupNeeded) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-5">
          <h3 className="font-semibold">Agendas need one SQL run</h3>
          <p className="text-sm text-muted-foreground mt-1">{SETUP_SQL}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl sm:text-3xl font-display font-bold">Agendas</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Find past meeting notes or prepare the next client agenda.
          </p>
        </div>
        <Button
          onClick={() => {
            setNewDate(toISODate())
            setNewOpen(true)
          }}
          disabled={saving}
          className="bg-brand-orange hover:bg-brand-orange/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Agenda
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agendas and notes…"
            className="pl-9"
          />
        </div>
        <div className="relative sm:w-[180px]">
          <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => onPickDate(e.target.value)}
            className="pr-9"
          />
        </div>
        <Select value={sortOrder} onValueChange={setSortOrder}>
          <SelectTrigger className="sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,32%)_1fr]">
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Agenda history</h3>
            </div>
            {loadingList ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                Loading agendas…
              </div>
            ) : visibleAgendas.length === 0 ? (
              <div className="p-8 text-sm text-muted-foreground">No agendas match these filters.</div>
            ) : (
              <div>
                {visibleAgendas.map((row) => {
                  const selected = row.id === selectedId
                  const rowStatus = agendaStatus(row)
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(row.id)
                        setEmptyDate('')
                      }}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors',
                        selected ? 'bg-orange-50 border-l-4 border-l-brand-orange' : 'hover:bg-muted/40 border-l-4 border-l-transparent'
                      )}
                    >
                      <p className="font-semibold">{formatShortDate(row.meeting_date)}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-sm text-muted-foreground truncate">{AGENDA_TYPE}</span>
                        <span className={cn(
                          'text-sm font-semibold',
                          rowStatus === 'Draft' ? 'text-brand-orange' : 'text-emerald-600'
                        )}>
                          {rowStatus}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            {emptyDate ? (
              <div className="py-10 text-center">
                <p className="text-xl font-bold">No agenda for {formatLongDate(emptyDate)}</p>
                <p className="text-muted-foreground mt-2 mb-6">Create a blank agenda for that date, or copy an existing one onto it.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => createAgendaForDate(emptyDate)} disabled={saving} className="bg-brand-orange hover:bg-brand-orange/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create for this date
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!agenda || saving}
                    onClick={() => {
                      setCopyDate(emptyDate)
                      setCopyOpen(true)
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy existing agenda
                  </Button>
                </div>
              </div>
            ) : loadingDetail ? (
              <div className="p-10 text-center text-muted-foreground">
                <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                Loading agenda…
              </div>
            ) : !agenda ? (
              <div className="py-10 text-center">
                <p className="text-xl font-bold">No agendas yet</p>
                <p className="text-muted-foreground mt-2 mb-6">Create the first agenda for this client.</p>
                <Button onClick={() => createAgendaForDate(toISODate(), { seed: true })} disabled={saving} className="bg-brand-orange hover:bg-brand-orange/90">
                  <Plus className="h-4 w-4 mr-2" />
                  New Agenda
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                      {status} · {AGENDA_TYPE}
                    </p>
                    <h3 className="text-2xl font-bold tracking-tight mt-1">{title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{formatLongDate(agenda.meeting_date)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCopyDate('')
                        setCopyOpen(true)
                      }}
                      disabled={saving}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copy to New Agenda
                    </Button>
                    {topics.length > 0 && (
                      <>
                        <Button variant={mode === 'prep' ? 'default' : 'outline'} onClick={() => setMode(mode === 'prep' ? 'run' : 'prep')}>
                          <Pencil className="h-4 w-4 mr-2" />
                          {mode === 'prep' ? 'Done prepping' : 'Prep'}
                        </Button>
                        <Button onClick={() => startPresent(0)}>
                          <Presentation className="h-4 w-4 mr-2" />
                          Present
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {topics.length === 0 ? (
                  <div className="rounded-xl border p-6 text-center">
                    <p className="font-semibold">This agenda is empty</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-4">Add topics, or seed Marketing + Digital.</p>
                    <Button variant="outline" onClick={async () => {
                      if (!agenda) return
                      setSaving(true)
                      await supabase.from('client_agenda_topics').insert([
                        { agenda_id: agenda.id, item: 'Marketing Updates', presenter: '', notes: '', sort_order: 0 },
                        { agenda_id: agenda.id, item: 'Digital', presenter: '', notes: '', sort_order: 1 },
                      ])
                      setSaving(false)
                      loadDetail(agenda.id)
                      loadList(agenda.id)
                    }} disabled={saving}>
                      Seed starter topics
                    </Button>
                    <div className="mt-6 text-left">
                      <div className="grid md:grid-cols-[180px_170px_1fr_auto] gap-3">
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">New item</Label>
                          <Input
                            value={topicForm.item}
                            onChange={(e) => setTopicForm((form) => ({ ...form, item: e.target.value }))}
                            placeholder="Marketing Updates"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">Presenter</Label>
                          <Input
                            value={topicForm.presenter}
                            onChange={(e) => setTopicForm((form) => ({ ...form, presenter: e.target.value }))}
                            placeholder="Aimee"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">Notes</Label>
                          <Textarea
                            rows={2}
                            value={topicForm.notes}
                            onChange={(e) => setTopicForm((form) => ({ ...form, notes: e.target.value }))}
                          />
                        </div>
                        <Button className="mt-6" onClick={addTopic} disabled={saving}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : mode === 'run' ? (
                  <div className="space-y-3">
                    {topics.map((topic, index) => (
                      <button
                        key={topic.id}
                        type="button"
                        onClick={() => startPresent(index)}
                        className="w-full text-left rounded-2xl border bg-background p-5 hover:border-orange-300 hover:shadow-sm transition"
                      >
                        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                          {index + 1} · {topic.presenter || 'Presenter TBD'}
                        </p>
                        <h4 className="text-xl font-bold mt-1 mb-3">{topic.item}</h4>
                        <StampNotes text={topic.notes} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border">
                    {topics.map((topic) => (
                      <div key={topic.id} className="grid md:grid-cols-[180px_170px_1fr_auto] gap-3 p-4 border-t first:border-t-0">
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">Item</Label>
                          <Input
                            value={topic.item || ''}
                            onChange={(e) => setTopics((prev) => prev.map((row) => (row.id === topic.id ? { ...row, item: e.target.value } : row)))}
                            onBlur={(e) => saveTopic(topic, { item: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">Presenter</Label>
                          <Input
                            value={topic.presenter || ''}
                            onChange={(e) => setTopics((prev) => prev.map((row) => (row.id === topic.id ? { ...row, presenter: e.target.value } : row)))}
                            onBlur={(e) => saveTopic(topic, { presenter: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] uppercase text-muted-foreground">Notes</Label>
                          <Textarea
                            rows={3}
                            value={topic.notes || ''}
                            onChange={(e) => setTopics((prev) => prev.map((row) => (row.id === topic.id ? { ...row, notes: e.target.value } : row)))}
                            onBlur={(e) => saveTopic(topic, { notes: e.target.value })}
                            placeholder="One line the client can scan. Use due / sent / need."
                          />
                        </div>
                        <Button size="icon" variant="ghost" className="mt-6" onClick={() => deleteTopic(topic.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <div className="grid md:grid-cols-[180px_170px_1fr_auto] gap-3 p-4 border-t bg-orange-50/40">
                      <div>
                        <Label className="text-[11px] uppercase text-muted-foreground">New item</Label>
                        <Input
                          value={topicForm.item}
                          onChange={(e) => setTopicForm((form) => ({ ...form, item: e.target.value }))}
                          placeholder="Marketing Updates"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase text-muted-foreground">Presenter</Label>
                        <Input
                          value={topicForm.presenter}
                          onChange={(e) => setTopicForm((form) => ({ ...form, presenter: e.target.value }))}
                          placeholder="Aimee"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] uppercase text-muted-foreground">Notes</Label>
                        <Textarea
                          rows={2}
                          value={topicForm.notes}
                          onChange={(e) => setTopicForm((form) => ({ ...form, notes: e.target.value }))}
                          onKeyDown={(e) => {
                            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') addTopic()
                          }}
                          placeholder="Cmd+Enter to add"
                        />
                      </div>
                      <Button className="mt-6" onClick={addTopic} disabled={saving}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Agenda</DialogTitle>
            <DialogDescription>Pick the meeting date. Existing agendas for that date will open instead of duplicating.</DialogDescription>
          </DialogHeader>
          <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button
              disabled={!newDate || saving}
              className="bg-brand-orange hover:bg-brand-orange/90"
              onClick={async () => {
                const created = await createAgendaForDate(newDate, { seed: true })
                if (created) setNewOpen(false)
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy to New Agenda</DialogTitle>
            <DialogDescription>
              Choose the meeting date for the copy. The original agenda stays unchanged.
            </DialogDescription>
          </DialogHeader>
          <Input type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)}>Cancel</Button>
            <Button
              disabled={!copyDate || !agenda || saving}
              className="bg-brand-orange hover:bg-brand-orange/90"
              onClick={async () => {
                const created = await createAgendaForDate(copyDate, { copyFrom: agenda })
                if (created) setCopyOpen(false)
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {presentOpen && current && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 text-slate-300">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-400">Brandastic · {client.name}</p>
              <p className="text-sm mt-1">{title}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">{presentIndex + 1} / {topics.length}</span>
              <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setPresentOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-8 pb-10">
            <div className="max-w-4xl w-full">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-orange-400">
                {current.presenter || 'Presenter TBD'}
              </p>
              <h2 className="text-5xl md:text-6xl font-bold tracking-tight mt-3 mb-8">{current.item}</h2>
              <div className="text-slate-100">
                <StampNotes text={current.notes} large />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between px-6 py-4 text-slate-400">
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              disabled={presentIndex === 0}
              onClick={() => setPresentIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Back
            </Button>
            <p className="text-xs">← → or J / K · Esc to leave</p>
            <Button
              variant="ghost"
              className="text-white hover:bg-white/10"
              disabled={presentIndex === topics.length - 1}
              onClick={() => setPresentIndex((index) => Math.min(topics.length - 1, index + 1))}
            >
              Next
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
