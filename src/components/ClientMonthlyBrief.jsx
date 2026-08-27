import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Loader2, Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Textarea } from './ui/textarea'
import { Label } from './ui/label'
import { useToast } from '../hooks/useToast'
import { BRIEF_CHANNELS, SETUP_SQL, formatMonthLabel, monthStart } from '../lib/docs'

function emptyBrief(month) {
  return {
    month_start: month,
    campaign_name: '',
    jira_key: '',
    key_due_dates: '',
    goals: '',
    scope: '',
    channels: BRIEF_CHANNELS.map((row) => ({ ...row })),
    next_steps: '',
  }
}

export default function ClientMonthlyBrief({ client }) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [month, setMonth] = useState(monthStart())
  const [brief, setBrief] = useState(emptyBrief(monthStart()))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const briefRef = useRef(brief)
  briefRef.current = brief

  const loadBrief = useCallback(async () => {
    if (!client?.id) return
    setLoading(true)
    const { data, error } = await supabase
      .from('client_monthly_briefs')
      .select('*')
      .eq('client_id', client.id)
      .eq('month_start', month)
      .maybeSingle()
    if (error) {
      setSetupNeeded(true)
      setBrief(emptyBrief(month))
      setLoading(false)
      return
    }
    setSetupNeeded(false)
    if (!data) {
      setBrief(emptyBrief(month))
    } else {
      setBrief({
        ...data,
        channels: Array.isArray(data.channels) && data.channels.length ? data.channels : BRIEF_CHANNELS.map((row) => ({ ...row })),
      })
    }
    setDirty(false)
    setLoading(false)
  }, [client?.id, month, toast])

  useEffect(() => {
    loadBrief()
  }, [loadBrief])

  const saveBrief = async (silent = false) => {
    setSaving(true)
    const payload = {
      client_id: client.id,
      month_start: month,
      campaign_name: briefRef.current.campaign_name || null,
      jira_key: briefRef.current.jira_key || null,
      key_due_dates: briefRef.current.key_due_dates || null,
      goals: briefRef.current.goals || null,
      scope: briefRef.current.scope || null,
      channels: briefRef.current.channels || [],
      next_steps: briefRef.current.next_steps || null,
      created_by: user?.id || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('client_monthly_briefs')
      .upsert(payload, { onConflict: 'client_id,month_start' })
    setSaving(false)
    if (error) {
      toast({ title: 'Could not save brief', description: error.message, variant: 'destructive' })
      return
    }
    if (!silent) toast({ title: 'Monthly brief saved' })
    setDirty(false)
  }

  useEffect(() => {
    if (!dirty || setupNeeded) return undefined
    const timer = window.setTimeout(() => {
      saveBrief(true)
    }, 900)
    return () => window.clearTimeout(timer)
  }, [dirty, brief, setupNeeded])

  const copyLastMonth = async () => {
    const prev = new Date(`${month}T12:00:00`)
    prev.setMonth(prev.getMonth() - 1)
    const prevMonth = monthStart(prev)
    const { data } = await supabase
      .from('client_monthly_briefs')
      .select('*')
      .eq('client_id', client.id)
      .eq('month_start', prevMonth)
      .maybeSingle()
    if (!data) {
      toast({ title: 'No last-month brief to copy', variant: 'destructive' })
      return
    }
    setBrief({
      ...data,
      id: undefined,
      month_start: month,
      channels: Array.isArray(data.channels) && data.channels.length ? data.channels : BRIEF_CHANNELS.map((row) => ({ ...row })),
    })
    setDirty(true)
    toast({ title: `Copied ${formatMonthLabel(prevMonth)}` })
  }

  const updateChannel = (index, patch) => {
    setDirty(true)
    setBrief((prev) => ({
      ...prev,
      channels: prev.channels.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  const updateField = (patch) => {
    setDirty(true)
    setBrief((prev) => ({ ...prev, ...patch }))
  }

  if (setupNeeded) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-5">
          <h3 className="font-semibold">Monthly briefs need one SQL run</h3>
          <p className="text-sm text-muted-foreground mt-1">{SETUP_SQL}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card className="border-orange-200 bg-orange-50/40">
        <CardContent className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-lg">{formatMonthLabel(month)} monthly brief</h3>
            <p className="text-sm text-muted-foreground">Internal planning for design. Not the weekly meeting.</p>
          </div>
          <div className="flex gap-2">
            <Input type="month" value={month.slice(0, 7)} onChange={(e) => setMonth(`${e.target.value}-01`)} className="w-40" />
            <Button variant="outline" onClick={copyLastMonth}>
              <Copy className="h-4 w-4 mr-2" />
              Copy last month
            </Button>
            <Button onClick={() => saveBrief()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {dirty ? 'Save brief' : 'Saved'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
            Loading brief…
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <Label>Campaign / project</Label>
                <Input value={brief.campaign_name || ''} onChange={(e) => updateField({ campaign_name: e.target.value })} />
              </div>
              <div>
                <Label>Jira key</Label>
                <Input value={brief.jira_key || ''} onChange={(e) => updateField({ jira_key: e.target.value })} />
              </div>
              <div>
                <Label>Key due dates</Label>
                <Input value={brief.key_due_dates || ''} onChange={(e) => updateField({ key_due_dates: e.target.value })} />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="rounded-xl bg-emerald-50 p-3">
                <Label>Goals + objectives</Label>
                <Textarea rows={3} value={brief.goals || ''} onChange={(e) => updateField({ goals: e.target.value })} />
              </div>
              <div className="rounded-xl bg-blue-50 p-3">
                <Label>Scope + deliverables</Label>
                <Textarea rows={3} value={brief.scope || ''} onChange={(e) => updateField({ scope: e.target.value })} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-muted-foreground">
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">This month</th>
                    <th className="py-2">Design / internal</th>
                  </tr>
                </thead>
                <tbody>
                  {(brief.channels || []).map((row, index) => (
                    <tr key={row.channel} className="border-t">
                      <td className="py-2 pr-3 font-medium">{row.channel}</td>
                      <td className="py-2 pr-3">
                        <Input value={row.this_month || ''} onChange={(e) => updateChannel(index, { this_month: e.target.value })} />
                      </td>
                      <td className="py-2">
                        <Input value={row.design || ''} onChange={(e) => updateChannel(index, { design: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <Label>Next steps</Label>
              <Textarea rows={3} value={brief.next_steps || ''} onChange={(e) => updateField({ next_steps: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Client Project Brief (intake + signature) stays a one-time template. Do not mix it into this monthly table.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
