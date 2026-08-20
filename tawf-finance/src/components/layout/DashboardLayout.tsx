import { useState, useEffect } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  FileText,
  CreditCard,
  Heart,
  Settings,
  Bell,
  Menu,
  X,
  LogOut,
  Store,
  Users,
  CheckCircle,
  Shield,
  LayoutDashboard,
  Package,
  DollarSign,
  Truck,
  BarChart3,
  Briefcase,
  Building2,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { ConnectButton } from '@/components/web3/ConnectButton';
import { cn } from '@/utils/cn';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  badge?: number;
  children?: NavItem[];
}

const navConfigs: Record<string, NavItem[]> = {
  investor: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/investor/dashboard' },
    { id: 'pools', label: 'Investment Pools', icon: TrendingUp, href: '/investor/pools' },
    { id: 'portfolio', label: 'Portfolio', icon: Briefcase, href: '/investor/portfolio' },
    { id: 'transactions', label: 'Transactions', icon: CreditCard, href: '/investor/transactions' },
    { id: 'impact', label: 'Impact', icon: Heart, href: '/investor/impact' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/investor/settings' },
  ],
  vendor: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/vendor/dashboard' },
    { id: 'services', label: 'Services', icon: Package, href: '/vendor/services' },
    { id: 'partnerships', label: 'Partnerships', icon: Building2, href: '/vendor/partnerships' },
    { id: 'compliance', label: 'Compliance', icon: Shield, href: '/vendor/compliance' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/vendor/settings' },
  ],
  cooperative: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/cooperative/dashboard' },
    { id: 'verification', label: 'Verification', icon: CheckCircle, href: '/cooperative/verification' },
    { id: 'businesses', label: 'Businesses', icon: Store, href: '/cooperative/businesses' },
    { id: 'deals', label: 'Deals', icon: DollarSign, href: '/cooperative/deals' },
    { id: 'members', label: 'Members', icon: Users, href: '/cooperative/members' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/cooperative/settings' },
  ],
  business: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/business/dashboard' },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, href: '/business/purchase-orders' },
    { id: 'funding', label: 'Funding', icon: DollarSign, href: '/business/funding' },
    { id: 'fulfillment', label: 'Fulfillment', icon: Truck, href: '/business/fulfillment' },
    { id: 'performance', label: 'Performance', icon: BarChart3, href: '/business/performance' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/business/settings' },
  ],
  admin: [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin/dashboard' },
    { id: 'users', label: 'Users', icon: Users, href: '/admin/users' },
    { id: 'investments', label: 'Investments', icon: TrendingUp, href: '/admin/investments' },
    { id: 'pools', label: 'Pools', icon: Briefcase, href: '/admin/pools' },
    { id: 'compliance', label: 'Compliance', icon: Shield, href: '/admin/compliance' },
    { id: 'settings', label: 'Settings', icon: Settings, href: '/admin/settings' },
  ],
};

export function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = user ? navConfigs[user.role] || [] : [];

  // Get page title from current path
  const getPageTitle = () => {
    const currentItem = navItems.find(item => location.pathname.startsWith(item.href));
    return currentItem?.label || 'Dashboard';
  };

  // Close mobile menu on route change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close mobile menu on navigation
    setMobileMenuOpen(false);
  }, [location.pathname]);

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-tawf-sand">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-screen bg-tawf-green text-tawf-sand z-40 transition-all duration-300 hidden lg:flex flex-col',
          sidebarCollapsed ? 'w-20' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="p-6 border-b border-tawf-green-20">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <img src="/tawftransparent.png" alt="Tawf" className="h-20 w-auto invert brightness-0" />
              {/* {!sidebarCollapsed && (
                <span className="font-serif text-xl font-semibold">Tawf Finance</span>
              )} */}
            </Link>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded-lg hover:bg-tawf-green-20 text-tawf-sand hidden lg:block"
            >
              {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-tawf-gold text-tawf-green font-medium'
                    : 'text-tawf-sand-70 hover:bg-tawf-green-20 hover:text-tawf-sand'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <Badge variant="warning" size="sm">{item.badge}</Badge>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-tawf-green-20">
          <div className={cn('flex items-center gap-3', sidebarCollapsed ? 'justify-center' : '')}>
            <Avatar name={user.name} size="sm" />
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-tawf-sand-60 capitalize">{user.role}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Sidebar */}
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: mobileMenuOpen ? 0 : '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed left-0 top-0 h-screen w-72 bg-tawf-green text-tawf-sand z-50 lg:hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-tawf-green-20">
          <Link to="/" className="flex items-center gap-3">
            <img src="/tawftransparent.png" alt="Tawf" className="h-10 w-auto invert brightness-0" />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-tawf-green-20"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');

            return (
              <Link
                key={item.id}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200',
                  isActive
                    ? 'bg-tawf-gold text-tawf-green font-medium'
                    : 'text-tawf-sand-70 hover:bg-tawf-green-20 hover:text-tawf-sand'
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge variant="warning" size="sm">{item.badge}</Badge>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Section */}
        <div className="p-4 border-t border-tawf-green-20">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl hover:bg-tawf-green-20 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className={cn('transition-all duration-300', 'lg:ml-64')}>
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-tawf-sand/90 backdrop-blur-md border-b border-tawf-green-10">
          <div className="flex items-center justify-between px-4 lg:px-8 h-16">
            <div className="flex items-center gap-4">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-tawf-green-10 text-tawf-green"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Breadcrumbs */}
              <nav className="hidden sm:flex items-center gap-2 text-sm">
                <Link to="/" className="text-tawf-muted hover:text-tawf-green">
                  Home
                </Link>
                <span className="text-tawf-muted">/</span>
                <span className="text-tawf-green font-medium">{getPageTitle()}</span>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-tawf-green-10">
                <Search className="w-4 h-4 text-tawf-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="bg-transparent border-none outline-none text-sm w-40"
                />
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-full hover:bg-tawf-green-10 text-tawf-green">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              {/* Wallet */}
              <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-tawf-green-10">
                <ConnectButton variant="secondary" size="sm" />
              </div>

              {/* User Menu */}
              <div className="hidden md:flex items-center gap-3 pl-3 border-l border-tawf-green-10">
                <Avatar name={user.name} size="sm" />
                <div className="text-sm">
                  <p className="font-medium text-tawf-ink">{user.name}</p>
                  <p className="text-xs text-tawf-muted capitalize">{user.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 rounded-lg hover:bg-tawf-green-10 text-tawf-muted hover:text-red-600 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
