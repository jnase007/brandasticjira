import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  Building2, Palette, Clock, Mail, User, FileText, 
  Upload, X, Image as ImageIcon, Check, ChevronRight, ChevronLeft,
  Sparkles, Plus, Kanban, ArrowRight, Zap
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

const HOUR_OPTIONS = [
  { value: 5, label: '5' },
  { value: 10, label: '10' },
  { value: 15, label: '15' },
  { value: 20, label: '20' },
  { value: 25, label: '25' },
  { value: 30, label: '30' },
  { value: 40, label: '40', popular: true },
  { value: 50, label: '50' },
  { value: 60, label: '60' },
  { value: 80, label: '80' },
  { value: 100, label: '100' },
  { value: 120, label: '120' },
]

const STEPS = [
  { id: 1, title: 'Basics', icon: Building2 },
  { id: 2, title: 'Details', icon: User },
  { id: 3, title: 'Branding', icon: Palette },
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
    contact_funder: '',
    monthly_hours: 30,
    color: '#F7931E',
    account_services: '',
    is_active: true,
    logo_url: '',
    banner_url: '',
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
          contact_funder: client.contact_funder || '',
          monthly_hours: client.monthly_hours || 30,
          color: client.color || '#F7931E',
          account_services: Array.isArray(client.account_services) 
            ? client.account_services.join(', ') 
            : client.account_services || '',
          is_active: client.is_active !== false,
          logo_url: client.logo_url || '',
          banner_url: client.banner_url || '',
        })
        setStep(1)
      } else {
        setFormData({
          name: '',
          slug: '',
          contact_name: '',
          contact_email: '',
          contact_funder: '',
          monthly_hours: 30,
          color: COLORS[Math.floor(Math.random() * COLORS.length)].value,
          account_services: '',
          is_active: true,
          logo_url: '',
          banner_url: '',
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
      if (step < 3) {
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
      const dataToSave = {
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase(),
        contact_name: formData.contact_name.trim() || null,
        contact_email: formData.contact_email.trim() || null,
        // Note: contact_phone field - save to notes for now since column doesn't exist
        // To add proper phone field, run: ALTER TABLE clients ADD COLUMN contact_phone TEXT;
        monthly_hours: parseInt(formData.monthly_hours) || 30,
        color: formData.color,
        account_services: formData.account_services 
          ? formData.account_services.split(',').map(s => s.trim()).filter(Boolean)
          : [],
        is_active: formData.is_active,
        logo_url: formData.logo_url || null,
        banner_url: formData.banner_url || null,
      }
      
      // Add phone to notes if provided (temporary until column is added)
      if (formData.contact_funder?.trim()) {
        dataToSave.notes = `Phone: ${formData.contact_funder.trim()}${formData.notes ? '\n' + formData.notes : ''}`
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
                        contact_funder: '',
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
                          <Label className="text-sm font-medium">Status</Label>
                          <Select
                            value={formData.is_active ? 'active' : 'inactive'}
                            onValueChange={(value) =>
                              setFormData(prev => ({ ...prev, is_active: value === 'active' }))
                            }
                          >
                            <SelectTrigger className="mt-1.5 h-11">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            Inactive clients are hidden from dashboards and reports.
                          </p>
                        </div>

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
                            value={formData.contact_funder}
                            onChange={(e) => setFormData(prev => ({ ...prev, contact_funder: e.target.value }))}
                            className="mt-1.5 h-11"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Contact phone number for this client.
                          </p>
                        </div>

                        <div>
                          <Label className="text-sm font-medium mb-3 block">
                            Monthly Hours
                            <span className="ml-2 text-brand-orange font-bold">{formData.monthly_hours}h</span>
                          </Label>
                          <div className="space-y-3">
                            {/* Quick Select Grid */}
                            <div className="grid grid-cols-6 gap-1.5">
                              {HOUR_OPTIONS.map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, monthly_hours: opt.value }))}
                                  className={cn(
                                    "relative py-2 px-1 rounded-lg border-2 transition-all text-center font-semibold",
                                    formData.monthly_hours === opt.value
                                      ? "border-brand-orange bg-brand-orange text-white"
                                      : "border-muted hover:border-brand-orange/50 hover:bg-brand-orange/5"
                                  )}
                                >
                                  {opt.popular && (
                                    <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-brand-orange rounded-full" />
                                  )}
                                  {opt.value}
                                </button>
                              ))}
                            </div>
                            
                            {/* Custom Input */}
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Or custom:</span>
                              <Input
                                type="number"
                                min={1}
                                max={200}
                                value={formData.monthly_hours}
                                onChange={(e) => setFormData(prev => ({ ...prev, monthly_hours: parseInt(e.target.value) || 0 }))}
                                className="w-24 h-9 text-center font-bold"
                              />
                              <span className="text-sm text-muted-foreground">hours/month</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Branding */}
                    {step === 3 && (
                      <motion.div
                        key="step3"
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
                    ) : step === 3 ? (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {client ? 'Save Changes' : 'Create Client'}
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
