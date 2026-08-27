import { useCallback, useEffect, useState } from 'react'
import { Copy, Loader2, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { useToast } from '../hooks/useToast'
import { defaultAgendaTitle, formatWeekLabel, toISODate, weekOptions, wednesdayOnOrBefore } from '../lib/docs'

export default function ClientAgendas({ client }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const weeks = weekOptions(8)
  const [meetingDate, setMeetingDate] = useState(toISODate(wednesdayOnOrBefore()))
  const [agenda, setAgenda] = useState(null)
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
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
      toast({
        title: 'Agendas not ready',
        description: 'Run supabase/agendas-internal-docs.sql in Supabase, then refresh.',
        variant: 'destructive',
      })
      setAgenda(null)
      setTopics([])
      setLoading(false)
      return
    }
    setAgenda(data)
    if (!data) {
      setTopics([])
      setLoading(false)
      return
    }
    const { data: topicRows } = await supabase
      .from('client_agenda_topics')
      .select('*')
      .eq('agenda_id', data.id)
      .order('sort_order')
    setTopics(topicRows || [])
    setLoading(false)
  }, [client?.id, meetingDate, toast])

  useEffect(() => {
    loadAgenda()
  }, [loadAgenda])

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
    setAddOpen(false)
    loadAgenda()
  }

  const saveTopic = async (topic, patch) => {
    await supabase.from('client_agenda_topics').update(patch).eq('id', topic.id)
  }

  const deleteTopic = async (id) => {
    await supabase.from('client_agenda_topics').delete().eq('id', id)
    setTopics((prev) => prev.filter((topic) => topic.id !== id))
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-orange-50/40">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">This week’s client review</h3>
            <p className="text-sm text-muted-foreground">Open it, add a topic, or copy last week. No Confluence tree.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={copyLastWeek} disabled={saving}>
              <Copy className="h-4 w-4 mr-2" />
              Copy last week
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add topic
            </Button>
          </div>
        </CardContent>
      </Card>

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
            <span className="text-[11px] text-muted-foreground">{iso === toISODate(wednesdayOnOrBefore()) ? 'this week' : 'week'}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-5 border-b">
            <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Weekly client review</p>
            <h3 className="text-xl font-bold mt-1">
              {agenda?.title || defaultAgendaTitle(client.name, meetingDate)}
            </h3>
          </div>
          {loading ? (
            <div className="p-10 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
              Loading agenda…
            </div>
          ) : topics.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <p className="font-medium">Empty week</p>
              <p className="text-sm mb-4">Copy last week or add Marketing / Digital.</p>
              <Button onClick={() => setAddOpen(true)} variant="outline">Add first topic</Button>
            </div>
          ) : (
            topics.map((topic) => (
              <div key={topic.id} className="grid md:grid-cols-[180px_170px_1fr_auto] gap-3 p-4 border-t">
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
                  />
                </div>
                <Button size="icon" variant="ghost" className="mt-6" onClick={() => deleteTopic(topic.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a topic</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Item</Label>
              <Input value={topicForm.item} onChange={(e) => setTopicForm((f) => ({ ...f, item: e.target.value }))} placeholder="Marketing Updates" />
            </div>
            <div>
              <Label>Presenter</Label>
              <Input value={topicForm.presenter} onChange={(e) => setTopicForm((f) => ({ ...f, presenter: e.target.value }))} placeholder="Aimee McAfee" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea rows={4} value={topicForm.notes} onChange={(e) => setTopicForm((f) => ({ ...f, notes: e.target.value }))} placeholder="One line the client can scan." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addTopic} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add to agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
