import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Timer,
  Trash2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TIME_CHANNELS, normalizeTimeChannel } from '../lib/timeChannels'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, formatDuration, getInitials } from '../lib/utils'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { useToast } from '../hooks/useToast'

const PAGE_SIZE = 10

function entryPerson(entry) {
  return entry.user || entry.profiles || null
}

function entryPersonName(entry) {
  return entryPerson(entry)?.full_name || 'Team Member'
}

function entryDateValue(entry) {
  return String(entry.date || '').slice(0, 10)
}

function entryDateLabel(entry) {
  const iso = entryDateValue(entry)
  if (!iso) return '—'
  return formatDate(`${iso}T12:00:00`)
}

function entryTaskTitle(entry) {
  return entry.ticket?.title || entry.description || entry.notes || 'Time entry'
}

function entryTaskMeta(entry) {
  const parts = []
  if (entry.ticket?.ticket_id) parts.push(entry.ticket.ticket_id)
  const channel = TIME_CHANNELS.find((item) => item.id === normalizeTimeChannel(entry.channel))
  if (channel?.label) parts.push(channel.label)
  return parts.join(' · ')
}

export default function ClientTimeEntries({ entries = [], onRefresh }) {
  const { user, isAdmin, isTeam } = useAuth()
  const { toast } = useToast()
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedMemberIds, setSelectedMemberIds] = useState([])
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage] = useState(1)
  const [editingEntry, setEditingEntry] = useState(null)
  const [editData, setEditData] = useState({ description: '', minutes: 0, billable: true, channel: 'general' })
  const [saving, setSaving] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const teamMembers = useMemo(() => {
    const seen = new Map()
    for (const entry of entries) {
      const person = entryPerson(entry)
      if (!entry.user_id || seen.has(entry.user_id)) continue
      seen.set(entry.user_id, {
        id: entry.user_id,
        full_name: person?.full_name || 'Team Member',
        avatar_url: person?.avatar_url || null,
      })
    }
    return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))
  }, [entries])

  const filtered = useMemo(() => {
    let rows = [...entries]
    if (startDate) rows = rows.filter((entry) => entryDateValue(entry) >= startDate)
    if (endDate) rows = rows.filter((entry) => entryDateValue(entry) <= endDate)
    if (selectedMemberIds.length > 0) {
      rows = rows.filter((entry) => selectedMemberIds.includes(entry.user_id))
    }
    const dir = sortDir === 'asc' ? 1 : -1
    rows.sort((a, b) => {
      if (sortKey === 'member') {
        return entryPersonName(a).localeCompare(entryPersonName(b)) * dir
      }
      if (sortKey === 'task') {
        return entryTaskTitle(a).localeCompare(entryTaskTitle(b)) * dir
      }
      if (sortKey === 'time') {
        return ((a.minutes || 0) - (b.minutes || 0)) * dir
      }
      const left = entryDateValue(a)
      const right = entryDateValue(b)
      if (left === right) return ((b.minutes || 0) - (a.minutes || 0))
      return left.localeCompare(right) * dir
    })
    return rows
  }, [entries, startDate, endDate, selectedMemberIds, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const filteredMinutes = filtered.reduce((sum, entry) => sum + (entry.minutes || 0), 0)
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(filtered.length, currentPage * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [startDate, endDate, selectedMemberIds, sortKey, sortDir])

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDir(key === 'date' || key === 'time' ? 'desc' : 'asc')
  }

  const resetFilters = () => {
    setStartDate('')
    setEndDate('')
    setSelectedMemberIds([])
    setSortKey('date')
    setSortDir('desc')
    setPage(1)
  }

  const canManage = (entry) => isAdmin || isTeam || entry.user_id === user?.id

  const openEdit = (entry) => {
    setEditingEntry(entry)
    setEditData({
      description: entry.description || '',
      minutes: entry.minutes || 0,
      billable: entry.billable ?? true,
      channel: normalizeTimeChannel(entry.channel),
    })
  }

  const saveEntry = async () => {
    if (!editingEntry) return
    setSaving(true)
    try {
      const updates = {
        description: editData.description,
        minutes: editData.minutes,
        billable: editData.billable,
        channel: normalizeTimeChannel(editData.channel),
      }
      let { error } = await supabase.from('time_entries').update(updates).eq('id', editingEntry.id)
      if (error && error.message?.includes('column')) {
        delete updates.channel
        ;({ error } = await supabase.from('time_entries').update(updates).eq('id', editingEntry.id))
      }
      if (error) throw error
      toast({ title: 'Time entry updated', variant: 'success' })
      setEditingEntry(null)
      onRefresh?.()
    } catch (error) {
      toast({ title: 'Could not update entry', description: error.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const deleteEntry = async () => {
    if (!entryToDelete) return
    setDeleting(true)
    try {
      const { error } = await supabase.from('time_entries').delete().eq('id', entryToDelete.id)
      if (error) throw error
      toast({ title: 'Time entry deleted', variant: 'success' })
      setEntryToDelete(null)
      setEditingEntry(null)
      onRefresh?.()
    } catch (error) {
      toast({ title: 'Could not delete entry', description: error.message, variant: 'destructive' })
    } finally {
      setDeleting(false)
    }
  }

  const memberLabel = selectedMemberIds.length === 0
    ? 'All team members'
    : selectedMemberIds.length === 1
      ? (teamMembers.find((member) => member.id === selectedMemberIds[0])?.full_name || '1 selected')
      : `${selectedMemberIds.length} selected`

  const SortHeader = ({ id, children, className }) => (
    <th className={cn('px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider', className)}>
      <button type="button" onClick={() => toggleSort(id)} className="inline-flex items-center gap-1 hover:text-foreground">
        {children}
        {sortKey === id && <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
      </button>
    </th>
  )

  const RowMenu = ({ entry }) => {
    if (!canManage(entry)) return null
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => openEdit(entry)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem className="text-red-600" onClick={() => setEntryToDelete(entry)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl sm:text-3xl font-display font-bold">Time Entries</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review and edit individual time entries for this client.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-auto">
          <Label className="text-[11px] uppercase text-muted-foreground">Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1 h-10 sm:w-[170px]" />
        </div>
        <div className="w-full sm:w-auto">
          <Label className="text-[11px] uppercase text-muted-foreground">End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1 h-10 sm:w-[170px]" />
        </div>
        <div className="w-full sm:w-auto">
          <Label className="text-[11px] uppercase text-muted-foreground">Team Members</Label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-1 h-10 w-full sm:w-[220px] justify-between font-normal">
                <span className="truncate">{memberLabel}</span>
                <ChevronDown className="h-4 w-4 ml-2 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <div className="flex items-center justify-between px-2 py-1.5">
                <button
                  type="button"
                  className="text-xs font-semibold text-brand-orange"
                  onClick={() => setSelectedMemberIds(teamMembers.map((member) => member.id))}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="text-xs font-semibold text-muted-foreground"
                  onClick={() => setSelectedMemberIds([])}
                >
                  Clear All
                </button>
              </div>
              <DropdownMenuSeparator />
              {teamMembers.length === 0 ? (
                <p className="px-3 py-2 text-sm text-muted-foreground">No team members yet</p>
              ) : (
                teamMembers.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={selectedMemberIds.includes(member.id)}
                    onCheckedChange={(checked) => {
                      setSelectedMemberIds((prev) => (
                        checked ? [...prev, member.id] : prev.filter((id) => id !== member.id)
                      ))
                    }}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {member.full_name}
                  </DropdownMenuCheckboxItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <Button variant="outline" className="h-10" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}</span>
        <span>Filtered total: <span className="font-semibold text-foreground">{formatDuration(filteredMinutes)}</span></span>
      </div>

      <Card>
        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Timer className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No time entries yet</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No entries match these filters</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <SortHeader id="date">Date</SortHeader>
                      <SortHeader id="member">Team Member</SortHeader>
                      <SortHeader id="task">Task / Work Item</SortHeader>
                      <SortHeader id="time" className="text-right">Time</SortHeader>
                      <th className="px-4 py-3 w-16 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {pageRows.map((entry) => {
                      const person = entryPerson(entry)
                      return (
                        <tr key={entry.id} className="hover:bg-muted/40">
                          <td className="px-4 py-3 text-sm whitespace-nowrap">{entryDateLabel(entry)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-7 w-7">
                                <AvatarImage src={person?.avatar_url} />
                                <AvatarFallback className="text-[10px]">{getInitials(person?.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate">{entryPersonName(entry)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium truncate max-w-md">{entryTaskTitle(entry)}</p>
                            {entryTaskMeta(entry) && (
                              <p className="text-xs text-muted-foreground truncate">{entryTaskMeta(entry)}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-right whitespace-nowrap">{formatDuration(entry.minutes)}</td>
                          <td className="px-4 py-3 text-right">
                            <RowMenu entry={entry} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y">
                {pageRows.map((entry) => {
                  const person = entryPerson(entry)
                  return (
                    <div key={entry.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm text-muted-foreground">{entryDateLabel(entry)}</p>
                          <p className="font-semibold mt-0.5">{entryTaskTitle(entry)}</p>
                          {entryTaskMeta(entry) && (
                            <p className="text-xs text-muted-foreground">{entryTaskMeta(entry)}</p>
                          )}
                        </div>
                        <RowMenu entry={entry} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={person?.avatar_url} />
                            <AvatarFallback className="text-[10px]">{getInitials(person?.full_name)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm truncate">{entryPersonName(entry)}</span>
                        </div>
                        <span className="font-semibold text-sm">{formatDuration(entry.minutes)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {filtered.length > PAGE_SIZE && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t text-sm text-muted-foreground">
                  <span>Showing {rangeStart}–{rangeEnd} of {filtered.length} entries</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= pageCount}
                      onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!editingEntry} onOpenChange={(open) => { if (!open) setEditingEntry(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Time Entry</DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <Input
                  className="mt-1.5"
                  value={editData.description}
                  onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hours</Label>
                  <Input
                    type="number"
                    min="0"
                    className="mt-1.5"
                    value={Math.floor(editData.minutes / 60)}
                    onChange={(e) => {
                      const hours = parseInt(e.target.value, 10) || 0
                      setEditData((prev) => ({ ...prev, minutes: hours * 60 + (prev.minutes % 60) }))
                    }}
                  />
                </div>
                <div>
                  <Label>Minutes</Label>
                  <Input
                    type="number"
                    min="0"
                    max="59"
                    className="mt-1.5"
                    value={editData.minutes % 60}
                    onChange={(e) => {
                      const mins = Math.min(59, parseInt(e.target.value, 10) || 0)
                      setEditData((prev) => ({ ...prev, minutes: Math.floor(prev.minutes / 60) * 60 + mins }))
                    }}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingEntry(null)}>Cancel</Button>
            <Button onClick={saveEntry} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!entryToDelete} onOpenChange={(open) => { if (!open) setEntryToDelete(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete time entry?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteEntry} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
