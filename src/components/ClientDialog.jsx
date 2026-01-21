import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Building2, Palette, Clock, Mail, User, Calendar, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn, slugify } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from './ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { useToast } from '../hooks/useToast'

const COLORS = [
  '#FF6B6B', '#4ECDC4', '#6C5CE7', '#FFD93D', '#A8E6CF', 
  '#FF8B94', '#F7931E', '#00CEC9', '#E84393', '#0984E3',
  '#6AB04C', '#F0932B', '#EB4D4B', '#7ED6DF', '#22A6B3',
]

const HOUR_OPTIONS = [20, 25, 30, 35, 40, 45, 50, 55, 60]

export default function ClientDialog({ 
  open, 
  onOpenChange, 
  client = null, // If provided, we're editing
  onSuccess 
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contact_name: '',
    contact_email: '',
    monthly_hours: 40,
    color: '#F7931E',
    renewal_date: '',
    account_services: '',
    is_active: true,
  })

  // Reset form when dialog opens/closes or client changes
  useEffect(() => {
    if (open) {
      if (client) {
        // Editing existing client
        setFormData({
          name: client.name || '',
          slug: client.slug || '',
          contact_name: client.contact_name || '',
          contact_email: client.contact_email || '',
          monthly_hours: client.monthly_hours || 40,
          color: client.color || '#F7931E',
          renewal_date: client.renewal_date || '',
          account_services: Array.isArray(client.account_services) 
            ? client.account_services.join(', ') 
            : client.account_services || '',
          is_active: client.is_active !== false,
        })
      } else {
        // New client
        setFormData({
          name: '',
          slug: '',
          contact_name: '',
          contact_email: '',
          monthly_hours: 40,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          renewal_date: '',
          account_services: '',
          is_active: true,
        })
      }
    }
  }, [open, client])

  // Auto-generate slug from name
  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: slugify(name),
    }))
  }

  const handleSubmit = async () => {
    // Validation
    if (!formData.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a client name.',
        variant: 'destructive',
      })
      return
    }

    if (!formData.slug.trim()) {
      toast({
        title: 'Slug required',
        description: 'Please enter a URL-friendly slug.',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)

    try {
      // Prepare data
      const dataToSave = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        contact_name: formData.contact_name.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        monthly_hours: parseInt(formData.monthly_hours) || 40,
        color: formData.color,
        renewal_date: formData.renewal_date || null,
        account_services: formData.account_services 
          ? formData.account_services.split(',').map(s => s.trim()).filter(Boolean)
          : null,
        is_active: formData.is_active,
      }

      let result

      if (client) {
        // Update existing
        result = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', client.id)
          .select()
          .single()
      } else {
        // Create new
        result = await supabase
          .from('clients')
          .insert(dataToSave)
          .select()
          .single()
      }

      if (result.error) {
        // Check for duplicate slug
        if (result.error.code === '23505') {
          toast({
            title: 'Slug already exists',
            description: 'Please use a different slug.',
            variant: 'destructive',
          })
          return
        }
        throw result.error
      }

      toast({
        title: client ? 'Client updated' : 'Client created',
        description: `${formData.name} has been ${client ? 'updated' : 'added'} successfully.`,
        variant: 'success',
      })

      onOpenChange(false)
      
      if (onSuccess) {
        onSuccess(result.data)
      }
    } catch (error) {
      console.error('Error saving client:', error)
      toast({
        title: 'Error',
        description: `Failed to ${client ? 'update' : 'create'} client. Please try again.`,
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-brand-orange" />
            {client ? 'Edit Client' : 'Add New Client'}
          </DialogTitle>
          <DialogDescription>
            {client 
              ? 'Update the client information below.' 
              : 'Fill in the details to create a new client.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Client Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Client Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Acme Corporation"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="h-11"
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              placeholder="e.g., acme-corp"
              value={formData.slug}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="h-11 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Used for URLs and ticket IDs (e.g., ACME-123)
            </p>
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_name">
                <User className="h-3 w-3 inline mr-1" />
                Contact Name
              </Label>
              <Input
                id="contact_name"
                placeholder="John Smith"
                value={formData.contact_name}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_email">
                <Mail className="h-3 w-3 inline mr-1" />
                Contact Email
              </Label>
              <Input
                id="contact_email"
                type="email"
                placeholder="john@acme.com"
                value={formData.contact_email}
                onChange={(e) => setFormData(prev => ({ ...prev, contact_email: e.target.value }))}
              />
            </div>
          </div>

          {/* Hours & Renewal */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="monthly_hours">
                <Clock className="h-3 w-3 inline mr-1" />
                Monthly Hours
              </Label>
              <Select
                value={formData.monthly_hours.toString()}
                onValueChange={(v) => setFormData(prev => ({ ...prev, monthly_hours: parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map(h => (
                    <SelectItem key={h} value={h.toString()}>{h} hours</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="renewal_date">
                <Calendar className="h-3 w-3 inline mr-1" />
                Renewal Date
              </Label>
              <Input
                id="renewal_date"
                type="date"
                value={formData.renewal_date}
                onChange={(e) => setFormData(prev => ({ ...prev, renewal_date: e.target.value }))}
              />
            </div>
          </div>

          {/* Account Services */}
          <div className="space-y-2">
            <Label htmlFor="account_services">
              <FileText className="h-3 w-3 inline mr-1" />
              Account Services
            </Label>
            <Input
              id="account_services"
              placeholder="SEO, Paid Digital, Social Media (comma separated)"
              value={formData.account_services}
              onChange={(e) => setFormData(prev => ({ ...prev, account_services: e.target.value }))}
            />
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>
              <Palette className="h-3 w-3 inline mr-1" />
              Brand Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, color }))}
                  className={cn(
                    "w-8 h-8 rounded-full transition-transform hover:scale-110",
                    formData.color === color && "ring-2 ring-offset-2 ring-foreground scale-110"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="pt-4 border-t">
            <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: formData.color }}
              >
                {formData.name?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div>
                <p className="font-semibold">{formData.name || 'Client Name'}</p>
                <p className="text-sm text-muted-foreground">
                  {formData.monthly_hours}h/month • {formData.slug || 'slug'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
