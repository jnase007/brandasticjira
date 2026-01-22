import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  FileJson,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  HelpCircle,
  Zap,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Progress } from '../components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { useToast } from '../hooks/useToast'
import AnimatedCounter from '../components/AnimatedCounter'

// Status mapping from JIRA to our system
const STATUS_MAP = {
  'done': 'done',
  'closed': 'done',
  'resolved': 'done',
  'complete': 'done',
  'completed': 'done',
  'in progress': 'inprogress',
  'in development': 'inprogress',
  'in review': 'inprogress',
  'testing': 'inprogress',
  'review': 'inprogress',
  'to do': 'todo',
  'todo': 'todo',
  'open': 'todo',
  'new': 'todo',
  'backlog': 'todo',
}

// Priority mapping
const PRIORITY_MAP = {
  'highest': 'urgent',
  'blocker': 'urgent',
  'critical': 'urgent',
  'high': 'high',
  'medium': 'medium',
  'normal': 'medium',
  'low': 'low',
  'lowest': 'low',
  'trivial': 'low',
}

function mapStatus(jiraStatus) {
  const status = jiraStatus?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(STATUS_MAP)) {
    if (status.includes(key)) return value
  }
  return 'todo'
}

function mapPriority(jiraPriority) {
  const priority = jiraPriority?.toLowerCase()?.trim() || ''
  for (const [key, value] of Object.entries(PRIORITY_MAP)) {
    if (priority.includes(key)) return value
  }
  return 'medium'
}

function parseCSVLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const issues = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const issue = {}
    headers.forEach((header, index) => {
      issue[header] = values[index] || ''
    })
    issues.push(issue)
  }

  return issues
}

function parseJSON(content) {
  const data = JSON.parse(content)
  if (Array.isArray(data)) return data
  if (data.issues) return data.issues
  return []
}

function parseTimeEstimate(value) {
  if (!value) return null
  if (typeof value === 'number') return Math.round(value / 3600 * 10) / 10

  let hours = 0
  const dayMatch = value.match(/(\d+)d/)
  const hourMatch = value.match(/(\d+)h/)
  const minMatch = value.match(/(\d+)m/)

  if (dayMatch) hours += parseInt(dayMatch[1]) * 8
  if (hourMatch) hours += parseInt(hourMatch[1])
  if (minMatch) hours += parseInt(minMatch[1]) / 60

  return hours > 0 ? Math.round(hours * 10) / 10 : null
}

function getField(issue, ...names) {
  for (const name of names) {
    if (issue[name]) return issue[name]
    if (issue.fields?.[name]) return issue.fields[name]
  }
  return ''
}

export default function JiraImport() {
  const { user } = useAuth()
  const { toast } = useToast()

  // State
  const [clients, setClients] = useState([])
  const [boards, setBoards] = useState([])
  const [loading, setLoading] = useState(true)

  // File upload state
  const [file, setFile] = useState(null)
  const [fileType, setFileType] = useState(null)
  const [parsedIssues, setParsedIssues] = useState([])
  const [parseError, setParseError] = useState(null)

  // Import settings
  const [selectedClient, setSelectedClient] = useState('')
  const [selectedBoard, setSelectedBoard] = useState('')
  const [createNewBoard, setCreateNewBoard] = useState(false)
  const [newBoardName, setNewBoardName] = useState('')

  // Import progress
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState(null)

  // Preview dialog
  const [previewOpen, setPreviewOpen] = useState(false)

  // Fetch clients and boards
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [clientsRes, boardsRes] = await Promise.all([
          supabase.from('clients').select('*').eq('is_active', true).order('name'),
          supabase.from('boards').select('*, client:clients(id, name, color)').eq('is_archived', false).order('name'),
        ])
        setClients(clientsRes.data || [])
        setBoards(boardsRes.data || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  // Filter boards by selected client
  const filteredBoards = boards.filter(b => !selectedClient || b.client_id === selectedClient)

  // Handle file drop/select
  const handleFile = useCallback((selectedFile) => {
    if (!selectedFile) return

    const ext = selectedFile.name.split('.').pop().toLowerCase()
    if (!['csv', 'json'].includes(ext)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a CSV or JSON file exported from JIRA.',
        variant: 'destructive',
      })
      return
    }

    setFile(selectedFile)
    setFileType(ext)
    setParseError(null)
    setParsedIssues([])
    setImportResults(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target.result
        const issues = ext === 'csv' ? parseCSV(content) : parseJSON(content)
        
        if (issues.length === 0) {
          throw new Error('No issues found in file')
        }

        setParsedIssues(issues)
        toast({
          title: 'File parsed successfully',
          description: `Found ${issues.length} issues ready to import.`,
          variant: 'success',
        })
      } catch (error) {
        setParseError(error.message)
        toast({
          title: 'Parse error',
          description: error.message,
          variant: 'destructive',
        })
      }
    }
    reader.readAsText(selectedFile)
  }, [toast])

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    handleFile(droppedFile)
  }, [handleFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  // Transform issues to tickets
  const transformIssues = (issues, boardId, clientId) => {
    return issues.map((issue, index) => ({
      title: getField(issue, 'Summary', 'summary', 'Issue Summary', 'title') || 'Imported Ticket',
      description: getField(issue, 'Description', 'description') || '',
      board_id: boardId,
      client_id: clientId,
      status: mapStatus(getField(issue, 'Status', 'status', 'Issue Status')),
      priority: mapPriority(getField(issue, 'Priority', 'priority')),
      estimated_hours: parseTimeEstimate(getField(issue, 'Original Estimate', 'timeoriginalestimate', 'Time Estimate')),
      tags: extractTags(getField(issue, 'Labels', 'labels', 'Components')),
      position: index,
      created_by: user?.id,
    }))
  }

  function extractTags(value) {
    if (!value) return []
    if (Array.isArray(value)) return value.map(t => t.name || t).filter(Boolean)
    return value.split(',').map(t => t.trim()).filter(Boolean)
  }

  // Run import
  const handleImport = async () => {
    if (!selectedClient) {
      toast({ title: 'Select a client', variant: 'destructive' })
      return
    }

    let boardId = selectedBoard

    // Create new board if needed
    if (createNewBoard && newBoardName) {
      try {
        const { data: newBoard, error } = await supabase
          .from('boards')
          .insert({
            name: newBoardName,
            client_id: selectedClient,
            type: 'kanban',
            created_by: user?.id,
          })
          .select()
          .single()

        if (error) throw error
        boardId = newBoard.id
        toast({ title: 'Board created', variant: 'success' })
      } catch (error) {
        toast({ title: 'Failed to create board', variant: 'destructive' })
        return
      }
    }

    if (!boardId) {
      toast({ title: 'Select or create a board', variant: 'destructive' })
      return
    }

    setImporting(true)
    setImportProgress(0)
    setImportResults(null)

    const tickets = transformIssues(parsedIssues, boardId, selectedClient)
    const batchSize = 25
    let imported = 0
    let failed = 0
    const errors = []

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize)

      try {
        const { data, error } = await supabase
          .from('tickets')
          .insert(batch)
          .select('id, ticket_id, title')

        if (error) {
          failed += batch.length
          errors.push(error.message)
        } else {
          imported += data.length
        }
      } catch (error) {
        failed += batch.length
        errors.push(error.message)
      }

      setImportProgress(Math.round(((i + batch.length) / tickets.length) * 100))
    }

    setImporting(false)
    setImportResults({ imported, failed, errors, boardId })

    if (imported > 0) {
      toast({
        title: 'Import complete!',
        description: `Successfully imported ${imported} tickets.`,
        variant: 'success',
      })
    }
  }

  // Reset
  const handleReset = () => {
    setFile(null)
    setFileType(null)
    setParsedIssues([])
    setParseError(null)
    setSelectedBoard('')
    setCreateNewBoard(false)
    setNewBoardName('')
    setImportResults(null)
    setImportProgress(0)
  }

  // Stats from parsed issues
  const stats = {
    total: parsedIssues.length,
    todo: parsedIssues.filter(i => mapStatus(getField(i, 'Status', 'status')) === 'todo').length,
    inprogress: parsedIssues.filter(i => mapStatus(getField(i, 'Status', 'status')) === 'inprogress').length,
    done: parsedIssues.filter(i => mapStatus(getField(i, 'Status', 'status')) === 'done').length,
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 bg-muted rounded" />
          <div className="h-6 w-96 bg-muted rounded" />
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto"
    >
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-brand-blue/10">
            <Upload className="h-6 w-6 text-brand-blue" />
          </div>
          <h1 className="text-4xl font-display font-bold">Import from JIRA</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Upload a JIRA CSV or JSON export to import tickets into Brandastic PM
        </p>
      </div>

      {/* Instructions */}
      <Card className="mb-6 border-brand-blue/20 bg-brand-blue/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <HelpCircle className="h-5 w-5 text-brand-blue mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-2">How to export from JIRA:</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Go to your JIRA board or project</li>
                <li>Click <strong>Export</strong> → <strong>Export Excel CSV</strong> or <strong>Export JSON</strong></li>
                <li>Upload the downloaded file below</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="space-y-6">
        {/* Step 1: Upload File */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-sm flex items-center justify-center">1</span>
              Upload JIRA Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!file ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed rounded-xl p-12 text-center hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-colors cursor-pointer"
              >
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => handleFile(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-1">Drop your file here</p>
                  <p className="text-sm text-muted-foreground mb-4">or click to browse</p>
                  <div className="flex items-center justify-center gap-4">
                    <Badge variant="outline" className="gap-1">
                      <FileSpreadsheet className="h-3 w-3" />
                      CSV
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <FileJson className="h-3 w-3" />
                      JSON
                    </Badge>
                  </div>
                </label>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
                <div className="flex items-center gap-3">
                  {fileType === 'csv' ? (
                    <FileSpreadsheet className="h-8 w-8 text-green-500" />
                  ) : (
                    <FileJson className="h-8 w-8 text-brand-blue" />
                  )}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB • {parsedIssues.length} issues found
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {parsedIssues.length > 0 && (
                    <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={handleReset}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {parseError && (
              <div className="mt-4 p-4 rounded-xl bg-destructive/10 text-destructive flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                <span>{parseError}</span>
              </div>
            )}

            {parsedIssues.length > 0 && (
              <div className="mt-4 grid grid-cols-4 gap-4">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold"><AnimatedCounter value={stats.total} /></p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-status-todo/10">
                  <p className="text-2xl font-bold text-status-todo"><AnimatedCounter value={stats.todo} /></p>
                  <p className="text-xs text-muted-foreground">To Do</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-status-inprogress/10">
                  <p className="text-2xl font-bold text-status-inprogress"><AnimatedCounter value={stats.inprogress} /></p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-status-done/10">
                  <p className="text-2xl font-bold text-status-done"><AnimatedCounter value={stats.done} /></p>
                  <p className="text-xs text-muted-foreground">Done</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Step 2: Select Destination */}
        {parsedIssues.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-sm flex items-center justify-center">2</span>
                  Select Destination
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Client Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Client *</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: client.color }}
                            />
                            {client.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Board Selection */}
                {selectedClient && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Board</label>
                    <Tabs
                      value={createNewBoard ? 'new' : 'existing'}
                      onValueChange={(v) => setCreateNewBoard(v === 'new')}
                    >
                      <TabsList className="mb-3">
                        <TabsTrigger value="existing">Use Existing Board</TabsTrigger>
                        <TabsTrigger value="new">Create New Board</TabsTrigger>
                      </TabsList>
                      <TabsContent value="existing">
                        <Select value={selectedBoard} onValueChange={setSelectedBoard}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a board" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredBoards.length === 0 ? (
                              <div className="p-4 text-center text-muted-foreground text-sm">
                                No boards found for this client
                              </div>
                            ) : (
                              filteredBoards.map(board => (
                                <SelectItem key={board.id} value={board.id}>
                                  {board.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </TabsContent>
                      <TabsContent value="new">
                        <input
                          type="text"
                          placeholder="Enter new board name"
                          value={newBoardName}
                          onChange={(e) => setNewBoardName(e.target.value)}
                          className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                        />
                      </TabsContent>
                    </Tabs>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Step 3: Import */}
        {parsedIssues.length > 0 && selectedClient && (selectedBoard || (createNewBoard && newBoardName)) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-brand-orange text-white text-sm flex items-center justify-center">3</span>
                  Import Tickets
                </CardTitle>
              </CardHeader>
              <CardContent>
                {importing ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-brand-orange" />
                      <span>Importing tickets...</span>
                    </div>
                    <Progress value={importProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">{importProgress}% complete</p>
                  </div>
                ) : importResults ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-green-600">
                      <CheckCircle className="h-6 w-6" />
                      <span className="text-lg font-medium">Import Complete!</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-green-500/10 text-center">
                        <p className="text-3xl font-bold text-green-600">{importResults.imported}</p>
                        <p className="text-sm text-muted-foreground">Imported</p>
                      </div>
                      <div className="p-4 rounded-xl bg-red-500/10 text-center">
                        <p className="text-3xl font-bold text-red-600">{importResults.failed}</p>
                        <p className="text-sm text-muted-foreground">Failed</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button asChild>
                        <a href={`/boards/${importResults.boardId}`}>
                          View Board <ArrowRight className="h-4 w-4 ml-2" />
                        </a>
                      </Button>
                      <Button variant="outline" onClick={handleReset}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Import More
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Ready to import <strong>{parsedIssues.length} tickets</strong> into{' '}
                      <strong>{createNewBoard ? newBoardName : filteredBoards.find(b => b.id === selectedBoard)?.name}</strong>
                    </p>
                    <Button onClick={handleImport} size="lg" className="w-full">
                      <Zap className="h-5 w-5 mr-2" />
                      Start Import
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Preview Issues ({parsedIssues.length})</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0">
                <tr>
                  <th className="text-left py-2 px-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Title</th>
                  <th className="text-left py-2 px-3 font-medium">Status</th>
                  <th className="text-left py-2 px-3 font-medium">Priority</th>
                </tr>
              </thead>
              <tbody>
                {parsedIssues.slice(0, 100).map((issue, i) => (
                  <tr key={i} className="border-b hover:bg-muted/50">
                    <td className="py-2 px-3 text-muted-foreground">{i + 1}</td>
                    <td className="py-2 px-3 max-w-[300px] truncate">
                      {getField(issue, 'Summary', 'summary', 'title') || 'No title'}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={mapStatus(getField(issue, 'Status', 'status'))}>
                        {mapStatus(getField(issue, 'Status', 'status'))}
                      </Badge>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={mapPriority(getField(issue, 'Priority', 'priority'))}>
                        {mapPriority(getField(issue, 'Priority', 'priority'))}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedIssues.length > 100 && (
              <p className="text-center py-4 text-muted-foreground">
                Showing first 100 of {parsedIssues.length} issues
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
