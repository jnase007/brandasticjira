import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard,
  Kanban,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Search,
  Activity,
  Timer,
  Command,
  Users,
  BarChart3,
} from 'lucide-react'
import { cn } from '../lib/utils'
import { useAuth } from '../contexts/AuthContext'
import { Button } from './ui/button'

const LOGO_WHITE = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/BrandasticLogo-White%20(4).png'
const LOGO_ICON = 'https://mjguavikbkqrzlvaizqa.supabase.co/storage/v1/object/public/images/Brandastic_black_logo%20(6).png'

const navItems = [
  { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', shortcut: 'G D' },
  { path: '/boards', icon: Kanban, label: 'Boards', shortcut: 'G B' },
  { path: '/settings', icon: Settings, label: 'Settings', shortcut: 'G S' },
]

export default function Sidebar({ 
  collapsed, 
  onCollapse, 
  onOpenCommandPalette,
  onOpenActivity,
  onOpenTimer
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-background flex flex-col",
        "shadow-lg"
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b">
        <AnimatePresence mode="wait">
          {collapsed ? (
            <motion.div
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="w-10 h-10 rounded-lg bg-brand-orange flex items-center justify-center"
            >
              <span className="text-white font-bold text-xl">B</span>
            </motion.div>
          ) : (
            <motion.div
              key="full"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-brand-orange flex items-center justify-center">
                <span className="text-white font-bold text-lg">B</span>
              </div>
              <span className="font-bold text-lg">Brandastic</span>
            </motion.div>
          )}
        </AnimatePresence>
        
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onCollapse(!collapsed)}
          className="h-8 w-8"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="p-3 space-y-2">
        <Button
          variant="outline"
          size={collapsed ? "icon" : "default"}
          onClick={onOpenCommandPalette}
          className={cn(
            "w-full justify-start gap-2",
            collapsed && "justify-center px-0"
          )}
        >
          <Search className="h-4 w-4" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left text-muted-foreground">Search...</span>
              <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
            </>
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all relative group",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-brand-orange text-white"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNav"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full"
                />
              )}
              
              {/* Tooltip for collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-sm rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}

        <div className="pt-4 border-t mt-4">
          <p className={cn(
            "text-xs text-muted-foreground uppercase tracking-wider mb-2",
            collapsed ? "text-center" : "px-3"
          )}>
            {collapsed ? "•" : "Quick Access"}
          </p>
          
          <button
            onClick={onOpenTimer}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all",
              collapsed && "justify-center px-0",
              "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Timer className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Timer</span>}
          </button>
          
          <button
            onClick={onOpenActivity}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-all",
              collapsed && "justify-center px-0",
              "hover:bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            <Activity className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Activity</span>}
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={handleSignOut}
          className={cn(
            "w-full justify-start gap-2 text-muted-foreground hover:text-red-500",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </div>
    </motion.aside>
  )
}
