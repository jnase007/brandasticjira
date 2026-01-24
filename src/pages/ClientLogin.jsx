import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowRight, Loader2, ArrowLeft, CheckCircle, Building2, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../hooks/useToast'

// Brandastic Logo
const LOGO_MARK = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Logo-1024x1024.png'

export default function ClientLogin() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkSent, setMagicLinkSent] = useState(false)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      // Check if user is a client or team member
      const checkUserType = async () => {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, client_id')
          .eq('id', user.id)
          .single()
        
        if (profile?.client_id || profile?.role === 'client') {
          navigate('/client-dashboard', { replace: true })
        } else {
          // Team member - redirect to main dashboard
          navigate('/dashboard', { replace: true })
        }
      }
      checkUserType()
    }
  }, [user, navigate])

  const handleMagicLink = async (e) => {
    e.preventDefault()
    if (!email) return

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/client-dashboard`,
        },
      })

      if (error) throw error

      setMagicLinkSent(true)
      toast({
        title: '✨ Magic link sent!',
        description: 'Check your email for a login link.',
        variant: 'success',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send magic link.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-blue-500/10 blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-brand-orange/10 blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Back to team login */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Team Login
            </Link>
          </motion.div>

          {/* Glass Card */}
          <div className="relative backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Gleam effect */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            />
            
            {/* Card content */}
            <div className="relative p-8 sm:p-10">
              {/* Logo & Header */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  className="w-20 h-20 mx-auto mb-4 relative"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
                  <img 
                    src={LOGO_MARK}
                    alt="Brandastic" 
                    className="relative w-full h-full object-contain drop-shadow-2xl"
                  />
                </motion.div>
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 mb-4">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-medium text-blue-300">Client Portal</span>
                </div>
                
                <h2 className="text-2xl font-display font-bold text-white">
                  {magicLinkSent ? 'Check your email' : 'Welcome, Partner'}
                </h2>
                <p className="text-white/60 mt-2">
                  {magicLinkSent 
                    ? 'We sent you a magic link to sign in'
                    : 'Sign in to view your projects and request work'}
                </p>
              </motion.div>

              <AnimatePresence mode="wait">
                {magicLinkSent ? (
                  /* Success State */
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center py-8"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
                      className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center"
                    >
                      <CheckCircle className="h-10 w-10 text-green-400" />
                    </motion.div>
                    
                    <p className="text-white/80 mb-6">
                      We sent a login link to<br />
                      <span className="font-semibold text-white">{email}</span>
                    </p>
                    
                    <Button
                      variant="ghost"
                      className="text-white/60 hover:text-white"
                      onClick={() => {
                        setMagicLinkSent(false)
                        setEmail('')
                      }}
                    >
                      Use a different email
                    </Button>
                  </motion.div>
                ) : (
                  /* Email Form */
                  <motion.form
                    key="form"
                    onSubmit={handleMagicLink}
                    className="space-y-6"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div>
                      <Label htmlFor="email" className="text-white/80">Email Address</Label>
                      <div className="relative mt-1.5">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                        <Input
                          id="email"
                          type="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-400 focus:ring-blue-400/30"
                        />
                      </div>
                      <p className="text-xs text-white/40 mt-2">
                        We'll send you a secure link to sign in - no password needed
                      </p>
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button
                        type="submit"
                        className="w-full h-12 text-base font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border-0 shadow-lg shadow-blue-500/25 group"
                        disabled={loading}
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>
                            <Sparkles className="h-5 w-5 mr-2" />
                            Send Magic Link
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                          </>
                        )}
                      </Button>
                    </motion.div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* What you can do */}
              {!magicLinkSent && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 pt-6 border-t border-white/10"
                >
                  <p className="text-sm text-white/50 mb-4 text-center">In the Client Portal you can:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: '📋', text: 'View projects' },
                      { icon: '✉️', text: 'Request work' },
                      { icon: '💬', text: 'Leave feedback' },
                      { icon: '📊', text: 'Track progress' },
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10"
                      >
                        <span>{item.icon}</span>
                        <span className="text-sm text-white/70">{item.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          </div>

          {/* Bottom text */}
          <motion.p 
            className="text-center text-white/40 text-xs mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Need help? Contact your account manager or email support@brandastic.com
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
