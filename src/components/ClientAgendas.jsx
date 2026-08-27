import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, Loader2, Pencil, Plus, Presentation, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { useToast } from '../hooks/useToast'
import {
  SETUP_SQL,
  defaultAgendaTitle,
  formatWeekLabel,
  stampKind,
  toISODate,
  weekOptions,
  wednesdayOnOrBefore,
} from '../lib/docs'

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

export default function ClientAgendas({ client }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const weeks = weekOptions(8)
  const thisWeek = toISODate(wednesdayOnOrBefore())
  const [meetingDate, setMeetingDate] = useState(thisWeek)
  const [agenda, setAgenda] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [mode, setMode] = useState('run')
  const [presentOpen, setPresentOpen] = useState(false)
  const [presentIndex, setPresentIndex] = useState(0)
  const [topicForm, setTopicForm] = useState({ item: '', presenter: '', notes: '' })

  const loadAgenda = useCallback(async () => {
    if (!client?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('client_agendas')
      .select('*')
      .eq('client_id', client.id)
      .eq('meeting_date', meetingDate)
      .maybeSingle()
    if (error) {
      setSetupNeeded(true)
      setAgenda(null)
      setTopics([])
      setLoading(false)
      return
    }
    setSetupNeeded(false)
    setAgenda(data)
    if (!data) {
      setTopics([])
      setMode('run')
      setLoading(false)
      return
    }
    const { data: topicRows } = await supabase
      .from('client_agenda_topics')
      .select('*')
      .eq('agenda_id', data.id)
      .order('sort_order')
    const nextTopics = topicRows || []
    setTopics(nextTopics)
    setMode(nextTopics.length ? 'run' : 'prep')
    setLoading(false)
  }, [client?.id, meetingDate])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

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

  const ensureAgenda = async () => {
    if (agenda) return agenda
    const title = defaultAgendaTitle(client.name, meetingDate)
    const { data, error } = await supabase
      .from('client_agendas')
      .insert({
        client_id: client.id,
        meeting_date: meetingDate,
        title,
        created_by: user?.id || null,
      })
      .select()
      .single()
    if (error) {
      toast({ title: 'Could not create agenda', description: error.message, variant: 'destructive' })
      return null
    }
    setAgenda(data)
    return data
  }

  const copyLastWeek = async () => {
    const prev = new Date(`${meetingDate}T12:00:00`)
    prev.setDate(prev.getDate() - 7)
    const prevDate = toISODate(prev)
    const { data: previous } = await supabase
      .from('client_agendas')
      .select('*')
      .eq('client_id', client.id)
      .eq('meeting_date', prevDate)
      .maybeSingle()
    if (!previous) {
      toast({ title: 'No last-week agenda to copy', variant: 'destructive' })
      return
    }
    setSaving(true)
    const created = await ensureAgenda()
    if (!created) {
      setSaving(false)
      return
    }
    const { data: prevTopics } = await supabase
      .from('client_agenda_topics')
      .select('*')
      .eq('agenda_id', previous.id)
      .order('sort_order')
    if (prevTopics?.length) {
      await supabase.from('client_agenda_topics').delete().eq('agenda_id', created.id)
      await supabase.from('client_agenda_topics').insert(
        prevTopics.map((topic, index) => ({
          agenda_id: created.id,
          item: topic.item,
          presenter: topic.presenter,
          notes: topic.notes,
          sort_order: index,
        }))
      )
    }
    setSaving(false)
    toast({ title: `Copied ${formatWeekLabel(prevDate)}` })
    loadAgenda()
  }

  const startThisWeek = async () => {
    setSaving(true)
    const created = await ensureAgenda()
    if (!created) {
      setSaving(false)
      return
    }
    if (!topics.length) {
      await supabase.from('client_agenda_topics').insert([
        { agenda_id: created.id, item: 'Marketing Updates', presenter: '', notes: '', sort_order: 0 },
        { agenda_id: created.id, item: 'Digital', presenter: '', notes: '', sort_order: 1 },
      ])
    }
    setSaving(false)
    loadAgenda()
  }

  const addTopic = async () => {
    if (!topicForm.item.trim()) {
      toast({ title: 'Item is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    const created = await ensureAgenda()
    if (!created) {
      setSaving(false)
      return
    }
    const { error } = await supabase.from('client_agenda_topics').insert({
      agenda_id: created.id,
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
    loadAgenda()
  }

  const saveTopic = async (topic, patch) => {
    await supabase.from('client_agenda_topics').update(patch).eq('id', topic.id)
  }

  const deleteTopic = async (id) => {
    await supabase.from('client_agenda_topics').delete().eq('id', id)
    setTopics((prev) => prev.filter((topic) => topic.id !== id))
  }

  const startPresent = (index = 0) => {
    if (!topics.length) return
    setPresentIndex(index)
    setPresentOpen(true)
  }

  const current = topics[presentIndex]
  const title = agenda?.title || defaultAgendaTitle(client.name, meetingDate)

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
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {weeks.map((iso) => (
          <button
            key={iso}
            type="button"
            onClick={() => setMeetingDate(iso)}
            className={cn(
              'min-w-[108px] rounded-xl border bg-background px-3 py-2 text-left',
              iso === meetingDate ? 'border-orange-400 bg-orange-50 shadow-[0_0_0_3px_#FED7AA]' : 'border-border'
            )}
          >
            <b className="block text-sm">{formatWeekLabel(iso)}</b>
            <span className="text-[11px] text-muted-foreground">{iso === thisWeek ? 'this week' : 'week'}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Weekly client review</p>
            <h3 className="text-2xl font-bold tracking-tight mt-1">{title}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {topics.length ? `${topics.length} topics · land, present, done.` : 'No Confluence tree. Copy last week or start this one.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={copyLastWeek} disabled={saving}>
              <Copy className="h-4 w-4 mr-2" />
              Copy last week
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
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Loading agenda…
          </CardContent>
        </Card>
      ) : topics.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-2xl font-bold tracking-tight">Empty week.</p>
            <p className="text-muted-foreground mt-2 mb-6">Copy last Wednesday, or seed Marketing + Digital.</p>
            <div className="flex justify-center gap-2 flex-wrap">
              <Button size="lg" onClick={copyLastWeek} disabled={saving}>
                <Copy className="h-4 w-4 mr-2" />
                Copy last week
              </Button>
              <Button size="lg" variant="outline" onClick={startThisWeek} disabled={saving}>
                Start this week
              </Button>
            </div>
          </CardContent>
        </Card>
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
        <Card>
          <CardContent className="p-0">
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
          </CardContent>
        </Card>
      )}

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
