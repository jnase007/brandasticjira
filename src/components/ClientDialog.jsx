import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, Palette, Clock, Mail, User, FileText, 
  Upload, X, Image as ImageIcon, Check, ChevronRight, ChevronLeft,
  ChevronUp, ChevronDown, Minus,
  Sparkles, Plus, Kanban, ArrowRight, Zap, Target, DollarSign,
  Calendar, Briefcase, MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { cn, slugify } from '../lib/utils'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import Confetti from './Confetti'

const COLORS = [
  { value: '#FF6B6B', name: 'Coral' },
  { value: '#4ECDC4', name: 'Teal' },
  { value: '#6C5CE7', name: 'Purple' },
  { value: '#FFD93D', name: 'Yellow' },
  { value: '#A8E6CF', name: 'Mint' },
  { value: '#FF8B94', name: 'Pink' },
  { value: '#F7931E', name: 'Orange' },
  { value: '#00CEC9', name: 'Cyan' },
  { value: '#E84393', name: 'Magenta' },
  { value: '#0984E3', name: 'Blue' },
  { value: '#6AB04C', name: 'Green' },
  { value: '#2D3436', name: 'Dark' },
]

// Quick preset options for common hour amounts
const HOUR_PRESETS = [
  { value: 10, label: '10' },
  { value: 20, label: '20' },
  { value: 30, label: '30' },
  { value: 40, label: '40' },
  { value: 60, label: '60' },
  { value: 80, label: '80' },
]

const STEPS = [
  { id: 1, title: 'Basics', icon: Building2 },
  { id: 2, title: 'Details', icon: User },
  { id: 3, title: 'Engagement', icon: Briefcase },
  { id: 4, title: 'Branding', icon: Palette },
]

const ENGAGEMENT_TYPES = [
  { value: 'retainer', label: 'Monthly Retainer', description: 'Ongoing monthly hours' },
  { value: 'one_time', label: 'One-Time Project', description: 'Fixed scope project' },
  { value: 'hourly', label: 'Hourly', description: 'Bill by the hour' },
  { value: 'discovery', label: 'Discovery', description: 'Exploring scope' },
]

const PIPELINE_STAGES = [
  { value: 'lead', label: 'Lead', color: 'bg-gray-500' },
  { value: 'kickoff', label: 'Kickoff', color: 'bg-blue-500' },
  { value: 'proposal', label: 'Proposal', color: 'bg-purple-500' },
  { value: 'contract', label: 'Contract', color: 'bg-yellow-500' },
  { value: 'won', label: 'Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
]

const LEAD_SOURCES = [
  'Referral',
  'Website',
  'LinkedIn',
  'Cold Outreach',
  'Event/Conference',
  'Partner',
  'Other',
]

export default function ClientDialog({ 
  open, 
  onOpenChange, 
  client = null,
  onSuccess 
}) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [createdClient, setCreatedClient] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const fileInputRef = useRef(null)
  const bannerInputRef = useRef(null)
  const nameInputRef = useRef(null)
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    monthly_hours: 30,
    color: '#F7931E',
    account_services: '',
    is_active: true,
    logo_url: '',
    banner_url: '',
    // New pipeline/engagement fields
    client_status: 'active', // prospect, active, inactive
    engagement_type: 'retainer', // retainer, one_time, hourly, discovery
    estimated_monthly_hours: null,
    estimated_project_hours: null,
    estimated_budget: null,
    pipeline_stage: 'lead',
    lead_source: '',
    expected_close_date: '',
    notes: '',
    // Deactivation tracking
    deactivated_at: '',
    deactivation_reason: '',
  })

  const [errors, setErrors] = useState({})

  // Focus name input when dialog opens
  useEffect(() => {
    if (open && !client) {
      setStep(1)
      setShowSuccess(false)
      setCreatedClient(null)
      setTimeout(() => nameInputRef.current?.focus(), 100)
    }
  }, [open, client])

  // Reset form
  useEffect(() => {
    if (open) {
      if (client) {
        setFormData({
          name: client.name || '',
          slug: client.slug || '',
          contact_name: client.contact_name || '',
          contact_email: client.contact_email || '',
          contact_phone: client.contact_phone || '',
          monthly_hours: client.monthly_hours || 30,
          color: client.color || '#F7931E',
          account_services: Array.isArray(client.account_services) 
            ? client.account_services.join(', ') 
            : client.account_services || '',
          is_active: client.is_active !== false,
          logo_url: client.logo_url || '',
          banner_url: client.banner_url || '',
          // New fields
          client_status: client.client_status || 'active',
          engagement_type: client.engagement_type || 'retainer',
          estimated_monthly_hours: client.estimated_monthly_hours || null,
          estimated_project_hours: client.estimated_project_hours || null,
          estimated_budget: client.estimated_budget || null,
          pipeline_stage: client.pipeline_stage || 'lead',
          lead_source: client.lead_source || '',
          expected_close_date: client.expected_close_date || '',
          notes: client.notes || '',
          // Deactivation tracking
          deactivated_at: client.deactivated_at || '',
          deactivation_reason: client.deactivation_reason || '',
        })
        setStep(1)
      } else {
        setFormData({
          name: '',
          slug: '',
          contact_name: '',
          contact_email: '',
          contact_phone: '',
          monthly_hours: 30,
          color: COLORS[Math.floor(Math.random() * COLORS.length)].value,
          account_services: '',
          is_active: true,
          logo_url: '',
          banner_url: '',
          // New fields default
          client_status: 'active',
          engagement_type: 'retainer',
          estimated_monthly_hours: null,
          estimated_project_hours: null,
          estimated_budget: null,
          pipeline_stage: 'lead',
          lead_source: '',
          expected_close_date: '',
          notes: '',
        })
        setStep(1)
        setShowSuccess(false)
      }
      setErrors({})
    }
  }, [open, client])

  // Auto-generate slug
  const handleNameChange = (name) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: slugify(name),
    }))
    if (errors.name) setErrors(prev => ({ ...prev, name: null }))
  }

  // Validate current step
  const validateStep = () => {
    const newErrors = {}
    
    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Client name is required'
      }
      if (!formData.slug.trim()) {
        newErrors.slug = 'Slug is required'
      } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
        newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens'
      }
    }
    
    if (step === 2) {
      if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
        newErrors.contact_email = 'Please enter a valid email'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Next step
  const handleNext = () => {
    if (validateStep()) {
      if (step < 4) {
        setStep(step + 1)
      } else {
        handleSubmit()
      }
    }
  }

  // Previous step
  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  // Logo upload with drag & drop
  const handleLogoUpload = async (file) => {
    if (!file) {
      console.log('[LogoUpload] No file provided')
      return
    }

    console.log('[LogoUpload] Starting upload:', file.name, file.type, file.size)

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please upload an image file', variant: 'destructive' })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Image must be under 50MB', variant: 'destructive' })
      return
    }

    setUploadingLogo(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `client-logos/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      console.log('[LogoUpload] Uploading to:', fileName)

      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: true 
        })

      console.log('[LogoUpload] Upload result:', { data, error })

      if (error) {
        console.error('[LogoUpload] Upload error:', error)
        throw error
      }

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName)

      console.log('[LogoUpload] Public URL:', urlData.publicUrl)

      setFormData(prev => ({ ...prev, logo_url: urlData.publicUrl }))
      toast({ title: 'Logo uploaded!', variant: 'success' })
    } catch (error) {
      console.error('[LogoUpload] Error:', error)
      toast({ 
        title: 'Upload failed', 
        description: error.message || 'Please check storage permissions',
        variant: 'destructive' 
      })
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleLogoUpload(file)
  }

  // Banner upload with drag & drop
  const handleBannerUpload = async (file) => {
    if (!file) {
      console.log('[BannerUpload] No file provided')
      return
    }

    console.log('[BannerUpload] Starting upload:', file.name, file.type, file.size)

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Please upload an image file', variant: 'destructive' })
      return
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: 'Image must be under 50MB', variant: 'destructive' })
      return
    }

    setUploadingBanner(true)

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `client-banners/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

      console.log('[BannerUpload] Uploading to:', fileName)

      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, file, { 
          cacheControl: '3600',
          upsert: true 
        })

      console.log('[BannerUpload] Upload result:', { data, error })

      if (error) {
        console.error('[BannerUpload] Upload error:', error)
        throw error
      }

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName)

      console.log('[BannerUpload] Public URL:', urlData.publicUrl)

      setFormData(prev => ({ ...prev, banner_url: urlData.publicUrl }))
      toast({ title: 'Banner uploaded!', variant: 'success' })
    } catch (error) {
      console.error('[BannerUpload] Error:', error)
      toast({ 
        title: 'Upload failed', 
        description: error.message || 'Please check storage permissions',
        variant: 'destructive' 
      })
    } finally {
      setUploadingBanner(false)
    }
  }

  const handleBannerDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleBannerUpload(file)
  }

  // Submit form
  const handleSubmit = async () => {
    if (!validateStep()) return

    setSaving(true)

    try {
      // Generate ticket prefix from name (first 3 letters, uppercase, letters only)
      const generatePrefix = (name) => {
        const lettersOnly = name.replace(/[^a-zA-Z]/g, '')
        return lettersOnly.substring(0, 3).toUpperCase()
      }
      
      const dataToSave = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        contact_name: formData.contact_name.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        contact_phone: formData.contact_phone?.trim() || null,
        monthly_hours: parseFloat(formData.monthly_hours) || 30,
        color: formData.color,
        account_services: formData.account_services 
          ? formData.account_services.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        is_active: formData.client_status === 'active',
        logo_url: formData.logo_url || null,
        banner_url: formData.banner_url || null,
        // Generate ticket prefix for new clients
        ticket_prefix: client?.ticket_prefix || generatePrefix(formData.name.trim()),
        // New pipeline/engagement fields
        client_status: formData.client_status,
        engagement_type: formData.engagement_type,
        estimated_monthly_hours: formData.estimated_monthly_hours || null,
        estimated_project_hours: formData.estimated_project_hours || null,
        estimated_budget: formData.estimated_budget || null,
        pipeline_stage: formData.client_status === 'prospect' ? formData.pipeline_stage : null,
        lead_source: formData.lead_source || null,
        expected_close_date: formData.expected_close_date || null,
        notes: formData.notes || null,
        // Deactivation tracking - only save if inactive
        deactivated_at: formData.client_status === 'inactive' ? (formData.deactivated_at || null) : null,
        deactivation_reason: formData.client_status === 'inactive' ? (formData.deactivation_reason || null) : null,
      }

      console.log('Saving client data:', dataToSave)

      let result

      if (client) {
        result = await supabase
          .from('clients')
          .update(dataToSave)
          .eq('id', client.id)
          .select()
          .single()
      } else {
        result = await supabase
          .from('clients')
          .insert(dataToSave)
          .select()
          .single()
      }

      console.log('Supabase result:', result)

      if (result.error) {
        console.error('Supabase error:', result.error)
        if (result.error.code === '23505') {
          setErrors({ slug: 'This slug is already taken' })
          setStep(1)
          setSaving(false)
          return
        }
        // Show more specific error messages
        let errorMessage = result.error.message
        if (result.error.message?.includes('row-level security')) {
          errorMessage = 'Permission denied. Please run the SQL fix in Supabase (supabase/fix-clients-import.sql)'
        } else if (result.error.message?.includes('check constraint')) {
          errorMessage = 'Invalid data. Please check monthly hours is between 0-500.'
        }
        toast({ 
          title: 'Failed to create client', 
          description: errorMessage,
          variant: 'destructive' 
        })
        setSaving(false)
        return
      }

      if (!client) {
        // New client - show success screen
        setCreatedClient(result.data)
        setShowSuccess(true)
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 3000)
      } else {
        // Edit - just close
        toast({ title: 'Client updated!', variant: 'success' })
        onOpenChange(false)
        if (onSuccess) onSuccess(result.data)
      }
    } catch (error) {
      console.error('Client creation error:', error)
      toast({ 
        title: 'Error creating client', 
        description: error.message || 'Please try again. Check browser console for details.',
        variant: 'destructive' 
      })
    } finally {
      setSaving(false)
    }
  }

  // Close and refresh
  const handleClose = () => {
    onOpenChange(false)
    if (createdClient && onSuccess) {
      onSuccess(createdClient)
    }
  }

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleNext()
    }
  }

  return (
    <>
      {showConfetti && <Confetti trigger={showConfetti} />}
      
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <AnimatePresence mode="wait">
            {showSuccess ? (
              // Success Screen
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 flex items-center justify-center"
                >
                  <Check className="h-10 w-10 text-green-500" />
                </motion.div>
                
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold mb-2"
                >
                  {createdClient?.name} is ready!
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-muted-foreground mb-8"
                >
                  Your new client has been created successfully.
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="space-y-3"
                >
                  <Button 
                    className="w-full h-12 gap-2 bg-gradient-to-r from-brand-orange to-brand-coral" 
                    onClick={() => {
                      handleClose()
                      navigate(`/clients/${createdClient?.slug || createdClient?.id}`)
                    }}
                  >
                    <Building2 className="h-4 w-4" />
                    View Client Profile
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full h-11 gap-2"
                    onClick={() => {
                      handleClose()
                      navigate(`/boards?new=true&client=${createdClient?.id}`)
                    }}
                  >
                    <Kanban className="h-4 w-4" />
                    Create First Board
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    className="w-full gap-2"
                    onClick={() => {
                      setShowSuccess(false)
                      setStep(1)
                      setFormData({
                        name: '',
                        slug: '',
                        contact_name: '',
                        contact_email: '',
                        contact_phone: '',
                        monthly_hours: 30,
                        color: COLORS[Math.floor(Math.random() * COLORS.length)].value,
                        account_services: '',
                        is_active: true,
                        logo_url: '',
                        banner_url: '',
                      })
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Add Another Client
                  </Button>
                </motion.div>
              </motion.div>
            ) : (
              // Form Steps
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Header with Progress - Fixed at top */}
                <div className="px-6 pt-6 pb-4 border-b bg-gradient-to-b from-muted/50 to-transparent flex-shrink-0">
                  <DialogHeader className="mb-4">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                      <Building2 className="h-5 w-5 text-brand-orange" />
                      {client ? 'Edit Client' : 'Add New Client'}
                    </DialogTitle>
                    <DialogDescription>
                      {client ? 'Update client information' : 'Set up a new client in 3 easy steps'}
                    </DialogDescription>
                  </DialogHeader>

                  {/* Step Indicator */}
                  {!client && (
                    <div className="flex items-center justify-between">
                      {STEPS.map((s, i) => (
                        <div key={s.id} className="flex items-center">
                          <button
                            onClick={() => s.id < step && setStep(s.id)}
                            disabled={s.id > step}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                              step === s.id && "bg-brand-orange text-white",
                              step > s.id && "text-brand-orange cursor-pointer hover:bg-brand-orange/10",
                              step < s.id && "text-muted-foreground"
                            )}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                              step === s.id && "bg-white/20",
                              step > s.id && "bg-brand-orange/20",
                              step < s.id && "bg-muted"
                            )}>
                              {step > s.id ? <Check className="h-3 w-3" /> : s.id}
                            </div>
                            <span className="text-sm font-medium hidden sm:block">{s.title}</span>
                          </button>
                          {i < STEPS.length - 1 && (
                            <div className={cn(
                              "w-8 h-0.5 mx-1",
                              step > s.id ? "bg-brand-orange" : "bg-muted"
                            )} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Form Content - Scrollable */}
                <div className="p-6 flex-1 overflow-y-auto min-h-0" onKeyDown={handleKeyDown}>
                  <AnimatePresence mode="wait">
                    {/* Step 1: Basics */}
                    {step === 1 && (
                      <motion.div
                        key="step1"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <div>
                          <Label htmlFor="name" className="text-sm font-medium">
                            Client Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            ref={nameInputRef}
                            id="name"
                            placeholder="e.g., Acme Corporation"
                            value={formData.name}
                            onChange={(e) => handleNameChange(e.target.value)}
                            className={cn("mt-1.5 h-12 text-lg", errors.name && "border-destructive")}
                          />
                          {errors.name && (
                            <p className="text-destructive text-sm mt-1">{errors.name}</p>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="slug" className="text-sm font-medium">
                            URL Slug <span className="text-destructive">*</span>
                          </Label>
                          <div className="relative mt-1.5">
                            <Input
                              id="slug"
                              placeholder="acme-corp"
                              value={formData.slug}
                              onChange={(e) => {
                                setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))
                                if (errors.slug) setErrors(prev => ({ ...prev, slug: null }))
                              }}
                              className={cn("h-11 font-mono pr-20", errors.slug && "border-destructive")}
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                              -001, -002...
                            </span>
                          </div>
                          {errors.slug ? (
                            <p className="text-destructive text-sm mt-1">{errors.slug}</p>
                          ) : (
                            <p className="text-muted-foreground text-xs mt-1">
                              Used for ticket IDs like <span className="font-mono">{formData.slug?.toUpperCase() || 'ACME'}-001</span>
                            </p>
                          )}
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Services</Label>
                          <Input
                            placeholder="SEO, Paid Ads, Social Media"
                            value={formData.account_services}
                            onChange={(e) => setFormData(prev => ({ ...prev, account_services: e.target.value }))}
                            className="mt-1.5 h-11"
                          />
                          <p className="text-muted-foreground text-xs mt-1">
                            Comma-separated list of services
                          </p>
                        </div>

                        {/* Client Type Toggle */}
                        <div className="pt-2">
                          <Label className="text-sm font-medium mb-2 block">Client Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                client_status: 'prospect',
                                is_active: false 
                              }))}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                formData.client_status === 'prospect'
                                  ? "border-purple-500 bg-purple-500/10"
                                  : "border-muted hover:border-purple-500/50"
                              )}
                            >
                              <Target className={cn(
                                "h-5 w-5",
                                formData.client_status === 'prospect' ? "text-purple-500" : "text-muted-foreground"
                              )} />
                              <div>
                                <p className="font-semibold text-sm">Prospect</p>
                                <p className="text-xs text-muted-foreground">In sales pipeline</p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ 
                                ...prev, 
                                client_status: 'active',
                                is_active: true 
                              }))}
                              className={cn(
                                "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                                formData.client_status === 'active'
                                  ? "border-green-500 bg-green-500/10"
                                  : "border-muted hover:border-green-500/50"
                              )}
                            >
                              <Check className={cn(
                                "h-5 w-5",
                                formData.client_status === 'active' ? "text-green-500" : "text-muted-foreground"
                              )} />
                              <div>
                                <p className="font-semibold text-sm">Active Client</p>
                                <p className="text-xs text-muted-foreground">Ready to work</p>
                              </div>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 2: Details */}
                    {step === 2 && (
                      <motion.div
                        key="step2"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        <div>
                          <Label className="text-sm font-medium">Client Status</Label>
                          <Select
                            value={formData.client_status}
                            onValueChange={(value) => {
                              setFormData(prev => ({ 
                                ...prev, 
                                client_status: value,
                                is_active: value === 'active',
                                // Auto-set today's date when switching to inactive
                                deactivated_at: value === 'inactive' && !prev.deactivated_at 
                                  ? new Date().toISOString().split('T')[0] 
                                  : prev.deactivated_at
                              }))
                            }}
                          >
                            <SelectTrigger className="mt-1.5 h-11">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive / Churned</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formData.client_status === 'inactive' 
                              ? 'Client will be hidden from dashboards and reports.' 
                              : formData.client_status === 'prospect'
                                ? 'Client is in the sales pipeline.'
                                : 'Active retainer client.'}
                          </p>
                        </div>
                        
                        {/* Deactivation Details - Only show when inactive */}
                        {formData.client_status === 'inactive' && (
                          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-3">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium text-sm">
                              <Calendar className="h-4 w-4" />
                              Deactivation Details
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-sm text-red-700 dark:text-red-400">End Date</Label>
                                <Input
                                  type="date"
                                  value={formData.deactivated_at}
                                  onChange={(e) => setFormData(prev => ({ ...prev, deactivated_at: e.target.value }))}
                                  className="mt-1 bg-white dark:bg-white/10"
                                />
                                <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">When did/will the retainer end?</p>
                              </div>
                              <div>
                                <Label className="text-sm text-red-700 dark:text-red-400">Reason</Label>
                                <Select
                                  value={formData.deactivation_reason || ''}
                                  onValueChange={(value) => setFormData(prev => ({ ...prev, deactivation_reason: value }))}
                                >
                                  <SelectTrigger className="mt-1 bg-white dark:bg-white/10">
                                    <SelectValue placeholder="Select reason..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="client_ended">Client ended retainer</SelectItem>
                                    <SelectItem value="budget_cuts">Budget cuts</SelectItem>
                                    <SelectItem value="contract_complete">Project/contract complete</SelectItem>
                                    <SelectItem value="poor_fit">Not a good fit</SelectItem>
                                    <SelectItem value="went_inhouse">Went in-house</SelectItem>
                                    <SelectItem value="competitor">Went to competitor</SelectItem>
                                    <SelectItem value="business_closed">Business closed</SelectItem>
                                    <SelectItem value="paused">Temporarily paused</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">Contact Name</Label>
                            <Input
                              placeholder="John Smith"
                              value={formData.contact_name}
                              onChange={(e) => setFormData(prev => ({ ...prev, contact_name: e.target.value }))}
                              className="mt-1.5 h-11"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Contact Email</Label>
                            <Input
                              type="email"
                              placeholder="john@acme.com"
                              value={formData.contact_email}
                              onChange={(e) => {
                                setFormData(prev => ({ ...prev, contact_email: e.target.value }))
                                if (errors.contact_email) setErrors(prev => ({ ...prev, contact_email: null }))
                              }}
                              className={cn("mt-1.5 h-11", errors.contact_email && "border-destructive")}
                            />
                            {errors.contact_email && (
                              <p className="text-destructive text-sm mt-1">{errors.contact_email}</p>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">Phone Number</Label>
                          <Input
                            placeholder="e.g., (555) 123-4567"
                            type="tel"
                            value={formData.contact_phone}
                            onChange={(e) => setFormData(prev => ({ ...prev, contact_phone: e.target.value }))}
                            className="mt-1.5 h-11"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Contact phone number for this client.
                          </p>
                        </div>

                      </motion.div>
                    )}

                    {/* Step 3: Engagement */}
                    {step === 3 && (
                      <motion.div
                        key="step3"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        {/* Engagement Type */}
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Engagement Type</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {ENGAGEMENT_TYPES.map((type) => (
                              <button
                                key={type.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, engagement_type: type.value }))}
                                className={cn(
                                  "p-3 rounded-xl border-2 transition-all text-left",
                                  formData.engagement_type === type.value
                                    ? "border-brand-orange bg-brand-orange/10"
                                    : "border-muted hover:border-brand-orange/50"
                                )}
                              >
                                <p className="font-semibold text-sm">{type.label}</p>
                                <p className="text-xs text-muted-foreground">{type.description}</p>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Hours based on engagement type */}
                        {formData.engagement_type === 'retainer' && (
                          <div>
                            <Label className="text-sm font-medium mb-3 block">
                              {formData.client_status === 'prospect' ? 'Estimated' : ''} Monthly Hours
                            </Label>
                            
                            {/* Custom hours input with up/down arrows */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="flex items-center border-2 border-muted rounded-lg overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => {
                                    const currentHours = prev.monthly_hours || prev.estimated_monthly_hours || 0
                                    const newHours = Math.max(0, currentHours - 0.5)
                                    return { ...prev, monthly_hours: newHours, estimated_monthly_hours: newHours }
                                  })}
                                  className="p-2 hover:bg-muted transition-colors border-r border-muted"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={formData.monthly_hours || formData.estimated_monthly_hours || ''}
                                  onChange={(e) => {
                                    const value = parseFloat(e.target.value) || 0
                                    setFormData(prev => ({ 
                                      ...prev, 
                                      monthly_hours: value,
                                      estimated_monthly_hours: value 
                                    }))
                                  }}
                                  className="w-20 text-center py-2 font-bold text-lg bg-transparent focus:outline-none"
                                  placeholder="0"
                                />
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => {
                                    const currentHours = prev.monthly_hours || prev.estimated_monthly_hours || 0
                                    const newHours = currentHours + 0.5
                                    return { ...prev, monthly_hours: newHours, estimated_monthly_hours: newHours }
                                  })}
                                  className="p-2 hover:bg-muted transition-colors border-l border-muted"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <span className="text-lg font-semibold text-muted-foreground">hours/month</span>
                            </div>

                            {/* Quick preset buttons */}
                            <div className="flex flex-wrap gap-1.5">
                              <span className="text-xs text-muted-foreground mr-1 self-center">Quick:</span>
                              {HOUR_PRESETS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ 
                                    ...prev, 
                                    monthly_hours: opt.value,
                                    estimated_monthly_hours: opt.value 
                                  }))}
                                  className={cn(
                                    "py-1 px-3 rounded-full border transition-all text-center font-medium text-sm",
                                    (formData.monthly_hours === opt.value || formData.estimated_monthly_hours === opt.value)
                                      ? "border-brand-orange bg-brand-orange text-white"
                                      : "border-muted hover:border-brand-orange/50 hover:bg-brand-orange/5"
                                  )}
                                >
                                  {opt.value}h
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {formData.engagement_type === 'one_time' && (
                          <div>
                            <Label className="text-sm font-medium">Estimated Project Hours</Label>
                            <div className="flex items-center border-2 border-muted rounded-lg overflow-hidden mt-1.5 focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20">
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="e.g., 100"
                                value={formData.estimated_project_hours ? formData.estimated_project_hours.toLocaleString() : ''}
                                onChange={(e) => {
                                  const rawValue = e.target.value.replace(/[^0-9.]/g, '')
                                  const numValue = parseFloat(rawValue) || null
                                  setFormData(prev => ({ 
                                    ...prev, 
                                    estimated_project_hours: numValue 
                                  }))
                                }}
                                className="flex-1 py-2.5 px-3 bg-transparent focus:outline-none text-base"
                              />
                              <div className="flex flex-col border-l border-muted">
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ 
                                    ...prev, 
                                    estimated_project_hours: (prev.estimated_project_hours || 0) + 5 
                                  }))}
                                  className="px-2 py-0.5 hover:bg-muted transition-colors"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ 
                                    ...prev, 
                                    estimated_project_hours: Math.max(0, (prev.estimated_project_hours || 0) - 5) 
                                  }))}
                                  className="px-2 py-0.5 hover:bg-muted transition-colors border-t border-muted"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Estimated Budget */}
                        <div>
                          <Label className="text-sm font-medium">
                            {formData.client_status === 'prospect' ? 'Estimated Budget' : 'Monthly Budget'}
                          </Label>
                          <div className="relative mt-1.5 flex items-center border-2 border-muted rounded-lg overflow-hidden focus-within:border-brand-orange focus-within:ring-2 focus-within:ring-brand-orange/20">
                            <DollarSign className="ml-3 h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="5,000"
                              value={formData.estimated_budget ? formData.estimated_budget.toLocaleString() : ''}
                              onChange={(e) => {
                                // Remove commas and non-numeric chars (except decimal)
                                const rawValue = e.target.value.replace(/[^0-9.]/g, '')
                                const numValue = parseFloat(rawValue) || null
                                setFormData(prev => ({ 
                                  ...prev, 
                                  estimated_budget: numValue
                                }))
                              }}
                              className="flex-1 py-2.5 px-2 bg-transparent focus:outline-none text-base"
                            />
                            <div className="flex flex-col border-l border-muted">
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  estimated_budget: (prev.estimated_budget || 0) + 500 
                                }))}
                                className="px-2 py-0.5 hover:bg-muted transition-colors"
                              >
                                <ChevronUp className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setFormData(prev => ({ 
                                  ...prev, 
                                  estimated_budget: Math.max(0, (prev.estimated_budget || 0) - 500) 
                                }))}
                                className="px-2 py-0.5 hover:bg-muted transition-colors border-t border-muted"
                              >
                                <ChevronDown className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Pipeline fields for prospects */}
                        {formData.client_status === 'prospect' && (
                          <>
                            <div>
                              <Label className="text-sm font-medium mb-2 block">Pipeline Stage</Label>
                              <div className="flex flex-wrap gap-2">
                                {PIPELINE_STAGES.map((stage) => (
                                  <button
                                    key={stage.value}
                                    type="button"
                                    onClick={() => setFormData(prev => ({ ...prev, pipeline_stage: stage.value }))}
                                    className={cn(
                                      "px-3 py-1.5 rounded-full border-2 transition-all text-sm font-medium",
                                      formData.pipeline_stage === stage.value
                                        ? stage.value === 'won' ? "border-green-500 bg-green-500 text-white"
                                        : stage.value === 'lost' ? "border-red-500 bg-red-500 text-white"
                                        : "border-brand-orange bg-brand-orange text-white"
                                        : "border-muted hover:border-brand-orange/50"
                                    )}
                                  >
                                    {stage.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-sm font-medium">Lead Source</Label>
                                <Select 
                                  value={formData.lead_source || ''} 
                                  onValueChange={(val) => setFormData(prev => ({ ...prev, lead_source: val }))}
                                >
                                  <SelectTrigger className="mt-1.5 h-11">
                                    <SelectValue placeholder="How did they find us?" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {LEAD_SOURCES.map((source) => (
                                      <SelectItem key={source} value={source}>{source}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label className="text-sm font-medium">Expected Close Date</Label>
                                <Input
                                  type="date"
                                  value={formData.expected_close_date || ''}
                                  onChange={(e) => setFormData(prev => ({ ...prev, expected_close_date: e.target.value }))}
                                  className="mt-1.5 h-11"
                                />
                              </div>
                            </div>

                            <div>
                              <Label className="text-sm font-medium">Notes</Label>
                              <textarea
                                placeholder="Initial discussions, requirements, next steps..."
                                value={formData.notes || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                className="mt-1.5 w-full min-h-[80px] px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-orange"
                                rows={3}
                              />
                            </div>
                          </>
                        )}
                      </motion.div>
                    )}

                    {/* Step 4: Branding */}
                    {step === 4 && (
                      <motion.div
                        key="step4"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                      >
                        {/* Banner Upload */}
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Client Banner (optional)</Label>
                          <div
                            onDrop={handleBannerDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer",
                              "hover:border-brand-orange hover:bg-brand-orange/5"
                            )}
                            onClick={() => bannerInputRef.current?.click()}
                          >
                            <input
                              ref={bannerInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleBannerUpload(e.target.files?.[0])}
                              className="hidden"
                            />

                            {formData.banner_url ? (
                              <div className="space-y-2">
                                <img 
                                  src={formData.banner_url} 
                                  alt="Banner" 
                                  className="w-full h-24 rounded-lg object-cover bg-white border"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setFormData(prev => ({ ...prev, banner_url: '' }))
                                  }}
                                  className="text-xs text-muted-foreground hover:text-destructive"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                {uploadingBanner ? (
                                  <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                )}
                                <div className="text-left">
                                  <p className="font-medium text-sm">Drop banner here or click to upload</p>
                                  <p className="text-xs text-muted-foreground">PNG, JPG up to 50MB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Logo Upload */}
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Client Logo (optional)</Label>
                          <div
                            onDrop={handleDrop}
                            onDragOver={(e) => e.preventDefault()}
                            className={cn(
                              "border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer",
                              "hover:border-brand-orange hover:bg-brand-orange/5"
                            )}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                              className="hidden"
                            />
                            
                            {formData.logo_url ? (
                              <div className="flex items-center justify-center gap-4">
                                <img 
                                  src={formData.logo_url} 
                                  alt="Logo" 
                                  className="w-12 h-12 rounded-lg object-contain bg-white border"
                                />
                                <div className="text-left">
                                  <p className="text-sm font-medium text-green-600 flex items-center gap-1">
                                    <Check className="h-3 w-3" /> Uploaded
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setFormData(prev => ({ ...prev, logo_url: '' }))
                                    }}
                                    className="text-xs text-muted-foreground hover:text-destructive"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                {uploadingLogo ? (
                                  <div className="w-8 h-8 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Upload className="h-8 w-8 text-muted-foreground" />
                                )}
                                <div className="text-left">
                                  <p className="font-medium text-sm">Drop logo here or click to upload</p>
                                  <p className="text-xs text-muted-foreground">PNG, JPG up to 50MB</p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Color Picker */}
                        <div>
                          <Label className="text-sm font-medium mb-1.5 block">Brand Color</Label>
                          <div className="grid grid-cols-6 gap-2">
                            {COLORS.map((color) => (
                              <button
                                key={color.value}
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                                className={cn(
                                  "aspect-square rounded-xl transition-all relative",
                                  formData.color === color.value && "ring-2 ring-offset-2 ring-foreground scale-105"
                                )}
                                style={{ backgroundColor: color.value }}
                                title={color.name}
                              >
                                {formData.color === color.value && (
                                  <Check className="h-4 w-4 text-white absolute inset-0 m-auto" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="pt-3 border-t">
                          <Label className="text-xs text-muted-foreground mb-2 block">Preview</Label>
                          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                            {formData.logo_url ? (
                              <img 
                                src={formData.logo_url} 
                                alt="" 
                                className="w-12 h-12 rounded-xl object-contain bg-white border shadow"
                              />
                            ) : (
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow"
                                style={{ backgroundColor: formData.color }}
                              >
                                {formData.name?.charAt(0)?.toUpperCase() || 'C'}
                              </div>
                            )}
                            <div>
                              <p className="font-bold">{formData.name || 'Client Name'}</p>
                              <p className="text-sm text-muted-foreground">
                                {formData.monthly_hours}h/month • {formData.slug?.toUpperCase() || 'SLUG'}-001
                              </p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Footer - Always visible */}
                <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between flex-shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={step === 1 ? handleClose : handleBack}
                    disabled={saving}
                  >
                    {step === 1 ? 'Cancel' : (
                      <>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Back
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleNext}
                    disabled={saving}
                    className="min-w-[120px]"
                  >
                    {saving ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : step === 4 ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {client ? 'Save Changes' : formData.client_status === 'prospect' ? 'Add to Pipeline' : 'Create Client'}
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  )
}
