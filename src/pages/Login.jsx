import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, ExternalLink, Building2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useToast } from '../hooks/useToast'

// Brandastic Logo Mark
const LOGO_MARK = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Logo-1024x1024.png'

// Team photos from Supabase Storage - rotating backgrounds
const TEAM_PHOTOS = [
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/C_DSC03021_Edited%20(4).jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC02954%20(1).jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC03001.jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC03013.jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC02926%20(1).jpg',
  'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/DSC03052.jpg',
]

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, signInWithGoogle, user } = useAuth()
  const { toast } = useToast()

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      console.log('User detected, redirecting to dashboard...')
      navigate('/dashboard', { replace: true })
    }
  }, [user, navigate])

  // Rotate background images every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % TEAM_PHOTOS.length)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error } = await signIn(email, password)
        if (error) throw error
        if (!data?.user) {
          toast({
            title: 'Login incomplete',
            description: 'Please check your email and password and try again.',
            variant: 'destructive',
          })
          return
        }
        
        // Show success toast - redirect will happen via useEffect when user state updates
        toast({
          title: 'Welcome back! 👋',
          description: 'Redirecting to dashboard...',
          variant: 'success',
        })
        
        // The useEffect watching `user` will handle the redirect
        // But also try immediate navigation as backup
        if (data?.user) {
          navigate('/dashboard', { replace: true })
        }
      } else {
        const { error } = await signUp(email, password, { full_name: fullName })
        if (error) throw error
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account.',
        })
        setMode('login')
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong. Please try again.',
        variant: 'destructive',
      })
    }
    setLoading(false)
  }

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await signInWithGoogle()
      if (error) throw error
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to sign in with Google.',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Image Background with Ken Burns effect and rotation */}
      <div className="absolute inset-0 z-0">
        {/* Rotating background images */}
        <AnimatePresence mode="sync">
          <motion.img
            key={currentImageIndex}
            src={TEAM_PHOTOS[currentImageIndex]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ scale: 1.1, opacity: 0 }}
            animate={{ 
              scale: [1.1, 1.15, 1.1],
              opacity: 1
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              scale: { duration: 20, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 1.5 }
            }}
            onLoad={() => setImageLoaded(true)}
          />
        </AnimatePresence>
        
        {/* Animated Gradient Fallback (shows while image loads) */}
        <div className={`absolute inset-0 transition-opacity duration-1000 ${imageLoaded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {/* Base gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-brand-dark via-[#0a1628] to-brand-dark" />
          
          {/* Animated orbs */}
          <motion.div
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-orange/20 blur-[120px]"
            animate={{
              scale: [1, 1.3, 1],
              x: [0, 100, 0],
              y: [0, -50, 0],
            }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-brand-blue/20 blur-[100px]"
            animate={{
              scale: [1.2, 1, 1.2],
              x: [0, -80, 0],
              y: [0, 60, 0],
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-brand-purple/15 blur-[80px]"
            animate={{
              scale: [1, 1.4, 1],
              rotate: [0, 180, 360],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          
          {/* Floating particles */}
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-white/30 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                y: [0, -100, 0],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 5,
              }}
            />
          ))}
        </div>
        
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/50" />
        
        {/* Gradient overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Subtle vignette effect */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)]" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 sm:p-8">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* Glass Card */}
          <div className="relative backdrop-blur-xl bg-white/10 rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
            {/* Gleam effect on card */}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent pointer-events-none"
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            />
            
            {/* Subtle animated border glow */}
            <div className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-brand-orange/50 via-transparent to-brand-blue/50 opacity-50 blur-sm pointer-events-none" />
            
            {/* Card content */}
            <div className="relative p-8 sm:p-10">
              {/* Logo */}
              <motion.div 
                className="text-center mb-8"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <motion.div
                  className="w-24 h-24 mx-auto mb-4 relative"
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  {/* Glow effect behind logo */}
                  <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full" />
                  <img 
                    src={LOGO_MARK}
                    alt="Brandastic" 
                    className="relative w-full h-full object-contain drop-shadow-2xl"
                  />
                </motion.div>
                <h2 className="text-2xl font-display font-bold text-white">
                  {mode === 'login' ? 'Welcome back' : 'Create an account'}
                </h2>
                <p className="text-white/60 mt-2">
                  {mode === 'login'
                    ? 'Sign in to manage your projects'
                    : 'Get started with Brandastic'}
                </p>
              </motion.div>

              {/* Form */}
              <motion.form 
                onSubmit={handleSubmit} 
                className="space-y-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <AnimatePresence mode="wait">
                  {mode === 'signup' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Label htmlFor="fullName" className="text-white/80">Full Name</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="mt-1.5 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-orange focus:ring-brand-orange/30"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div>
                  <Label htmlFor="email" className="text-white/80">Email</Label>
                  <div className="relative mt-1.5">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-orange focus:ring-brand-orange/30"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-white/80">Password</Label>
                  <div className="relative mt-1.5">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pl-10 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-brand-orange focus:ring-brand-orange/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    type="submit"
                    className="w-full h-12 text-base font-semibold bg-gradient-to-r from-brand-orange to-brand-coral hover:from-brand-orange/90 hover:to-brand-coral/90 border-0 shadow-lg shadow-brand-orange/25 group"
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        {mode === 'login' ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </Button>
                </motion.div>
              </motion.form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-transparent px-2 text-white/50 backdrop-blur-sm">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Google Button */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-12 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                  onClick={handleGoogleSignIn}
                >
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </Button>
              </motion.div>

              {/* Toggle mode */}
              <p className="mt-6 text-center text-sm text-white/60">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="font-semibold text-brand-orange hover:text-brand-orange/80 transition-colors"
                    >
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-semibold text-brand-orange hover:text-brand-orange/80 transition-colors"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>

              {/* Client Portal Link */}
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-center text-white/50 text-sm mb-3">Are you a client?</p>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to="/client-login"
                    className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-500/20 to-blue-600/20 border border-blue-400/30 text-white font-medium hover:from-blue-500/30 hover:to-blue-600/30 transition-all group"
                  >
                    <Building2 className="h-4 w-4 text-blue-400" />
                    <span>Client Portal</span>
                    <ArrowRight className="h-4 w-4 text-blue-400 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                </motion.div>
              </div>

              {/* Visit Brandastic.com */}
              <div className="pt-4 border-t border-white/10">
                <motion.a
                  href="https://brandastic.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-brand-orange/20 to-brand-coral/20 border border-brand-orange/30 text-white font-medium hover:from-brand-orange/30 hover:to-brand-coral/30 transition-all group"
                >
                  <span className="text-brand-orange">✨</span>
                  Visit Brandastic.com
                  <ExternalLink className="h-4 w-4 text-brand-orange opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </motion.a>
                <p className="text-center text-white/40 text-xs mt-2">
                  Learn more about our digital marketing agency
                </p>
              </div>
            </div>
          </div>

          {/* Bottom text */}
          <motion.p 
            className="text-center text-white/40 text-xs mt-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            By signing in, you agree to our Terms of Service and Privacy Policy
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
