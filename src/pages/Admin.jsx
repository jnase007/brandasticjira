import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Users,
  Building2,
  Kanban,
  Clock,
  TrendingUp,
  Shield,
  Plus,
  Search,
  MoreHorizontal,
  Edit,
  Trash2,
  UserPlus,
  CheckCircle,
  XCircle,
  Mail,
  Calendar,
  ArrowUpRight,
  RefreshCw,
  Download,
  Settings,
  BarChart3,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { cn, formatDate, getInitials } from '../lib/utils'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Skeleton } from '../components/ui/skeleton'
import AnimatedCounter from '../components/AnimatedCounter'
import { DonutChart, BarChart } from '../components/Charts'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

export default function Admin() {
  const { profile, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Data states
  const [users, setUsers] = useState([])
  const [clients, setClients] = useState([])
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalClients: 0,
    totalBoards: 0,
    totalTickets: 0,
    activeUsers: 0,
    hoursThisMonth: 0,
  })

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      // Fetch users/profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false })

      // Fetch board count
      const { count: boardCount } = await supabase
        .from('boards')
        .select('*', { count: 'exact', head: true })

      // Fetch ticket count
      const { count: ticketCount } = await supabase
        .from('tickets')
        .select('*', { count: 'exact', head: true })

      setUsers(profilesData || [])
      setClients(clientsData || [])
      setStats({
        totalUsers: profilesData?.length || 0,
        totalClients: clientsData?.length || 0,
        totalBoards: boardCount || 0,
        totalTickets: ticketCount || 0,
        activeUsers: profilesData?.filter(u => u.role !== 'client').length || 0,
        hoursThisMonth: clientsData?.reduce((sum, c) => sum + (c.monthly_hours || 0), 0) || 0,
      })
    } catch (error) {
      console.error('Error fetching admin data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  // Filter users
  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Role distribution for chart
  const roleDistribution = [
    { label: 'Team', value: users.filter(u => u.role === 'team').length },
    { label: 'Admin', value: users.filter(u => u.role === 'admin').length },
    { label: 'Client', value: users.filter(u => u.role === 'client').length },
  ]

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="mb-10">
          <Skeleton className="h-10 w-64 mb-3" />
          <Skeleton className="h-6 w-96" />
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="mb-10">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-brand-purple/10">
                <Shield className="h-6 w-6 text-brand-purple" />
              </div>
              <h1 className="text-4xl font-display font-bold">Admin Dashboard</h1>
            </div>
            <p className="text-lg text-muted-foreground">
              Manage users, clients, and system settings
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8"
      >
        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-purple transition-colors">
                    <AnimatedCounter value={stats.totalUsers} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.activeUsers} team members
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-purple/20 to-purple-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Users className="h-7 w-7 text-brand-purple" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-orange transition-colors">
                    <AnimatedCounter value={stats.totalClients} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active accounts
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-orange/20 to-brand-coral/10 group-hover:scale-110 transition-transform duration-300">
                  <Building2 className="h-7 w-7 text-brand-orange" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Boards</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-brand-blue transition-colors">
                    <AnimatedCounter value={stats.totalBoards} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active projects
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-brand-blue/20 to-cyan-500/10 group-hover:scale-110 transition-transform duration-300">
                  <Kanban className="h-7 w-7 text-brand-blue" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="relative overflow-hidden group cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Tickets</p>
                  <p className="text-4xl font-bold mt-2 group-hover:text-green-500 transition-colors">
                    <AnimatedCounter value={stats.totalTickets} />
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    All time
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/10 group-hover:scale-110 transition-transform duration-300">
                  <BarChart3 className="h-7 w-7 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <Tabs defaultValue="users" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4" />
            Users
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <Building2 className="h-4 w-4" />
            Clients
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">User Management</CardTitle>
                    <CardDescription>Manage all registered users</CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 rounded-xl"
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium">User</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Role</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-medium">Joined</th>
                        <th className="text-right py-3 px-4 text-sm font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map((user, index) => (
                          <motion.tr
                            key={user.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="border-t hover:bg-muted/30 transition-colors"
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-9 w-9">
                                  <AvatarImage src={user.avatar_url} />
                                  <AvatarFallback className="bg-brand-orange/10 text-brand-orange">
                                    {getInitials(user.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium">{user.full_name || 'No name'}</p>
                                  <p className="text-sm text-muted-foreground">{user.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge
                                variant={
                                  user.role === 'admin' ? 'default' :
                                  user.role === 'team' ? 'secondary' : 'outline'
                                }
                                className={cn(
                                  user.role === 'admin' && "bg-brand-purple text-white"
                                )}
                              >
                                {user.role}
                              </Badge>
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Active</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-sm text-muted-foreground">
                              {formatDate(user.created_at)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </td>
                          </motion.tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Clients Tab */}
        <TabsContent value="clients">
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">Client Management</CardTitle>
                    <CardDescription>Manage all client accounts</CardDescription>
                  </div>
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Client
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {clients.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-muted-foreground">
                      No clients yet
                    </div>
                  ) : (
                    clients.map((client, index) => (
                      <motion.div
                        key={client.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-5 rounded-2xl border bg-card hover:shadow-md hover:border-brand-orange/30 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg"
                              style={{ backgroundColor: client.color || '#F7931E' }}
                            >
                              {client.name?.charAt(0) || 'C'}
                            </div>
                            <div>
                              <h3 className="font-semibold group-hover:text-brand-orange transition-colors">
                                {client.name}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {client.monthly_hours}h/month
                              </p>
                            </div>
                          </div>
                          <Badge variant={client.is_active ? 'default' : 'secondary'}>
                            {client.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            <Mail className="h-3 w-3 inline mr-1" />
                            {client.contact_email || 'No email'}
                          </span>
                          <Button variant="ghost" size="icon-sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics">
          <motion.div variants={itemVariants} className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Distribution by Role</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <DonutChart
                  value={stats.activeUsers}
                  total={stats.totalUsers}
                  size={180}
                  strokeWidth={20}
                  label="Team Members"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monthly Hours by Client</CardTitle>
              </CardHeader>
              <CardContent>
                <BarChart
                  data={clients.slice(0, 6).map(c => ({
                    label: c.name?.substring(0, 8) || 'Client',
                    value: c.monthly_hours || 0
                  }))}
                  height={180}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-orange">
                      <AnimatedCounter value={stats.hoursThisMonth} />h
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Total Monthly Hours</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-blue">
                      <AnimatedCounter value={stats.totalBoards} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Boards</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-brand-purple">
                      <AnimatedCounter value={users.filter(u => u.role === 'admin').length} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Admins</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-muted/50">
                    <p className="text-3xl font-bold text-green-500">
                      <AnimatedCounter value={clients.filter(c => c.is_active).length} />
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">Active Clients</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}
