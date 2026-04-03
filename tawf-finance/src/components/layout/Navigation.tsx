import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { WalletButton } from '@/components/solana/WalletButton';

const publicNavLinks = [
  { name: 'Features', href: '/#features' },
  { name: 'How It Works', href: '/#how-it-works' },
  { name: 'Impact', href: '/#impact' },
];

export function Navigation() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isHomePage = location.pathname === '/';
  const isAuthPage = ['/login', '/register', '/onboarding'].includes(location.pathname);
  const isDashboardPage = location.pathname.includes('/investor') ||
                          location.pathname.includes('/vendor') ||
                          location.pathname.includes('/cooperative') ||
                          location.pathname.includes('/business') ||
                          location.pathname.includes('/admin');

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Don't show Navigation on dashboard pages (they have DashboardLayout)
  if (isDashboardPage) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || !isHomePage
          ? 'bg-tawf-sand/90 backdrop-blur-md border-b border-tawf-green/10 shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="section-container">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <img src="/tawftransparent.png" alt="tawf.finance" className="pt-2 h-24 w-auto invert" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {!isAuthPage && (
              <>
                {isHomePage ? (
                  publicNavLinks.map((link) => (
                    <a
                      key={link.name}
                      href={link.href}
                      className="nav-link"
                    >
                      {link.name}
                    </a>
                  ))
                ) : (
                  <>
                    <Link to="/about" className="nav-link">About</Link>
                    <Link to="/how-it-works" className="nav-link">How It Works</Link>
                    <Link to="/glossary" className="nav-link">Glossary</Link>
                  </>
                )}
              </>
            )}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && (
              <Link to="/investor/dashboard">
                <Button variant="secondary" size="sm">Dashboard</Button>
              </Link>
            )}
            <WalletButton className="btn-primary text-sm px-4 py-2 rounded-lg" />
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-tawf-green"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden bg-tawf-sand border-b border-tawf-green/10"
          >
            <div className="section-container py-6">
              <div className="flex flex-col gap-4">
                {!isAuthPage && (
                  <>
                    {isHomePage ? (
                      publicNavLinks.map((link) => (
                        <a
                          key={link.name}
                          href={link.href}
                          className="nav-link py-2"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          {link.name}
                        </a>
                      ))
                    ) : (
                      <>
                        <Link to="/about" className="nav-link py-2" onClick={() => setIsMobileMenuOpen(false)}>About</Link>
                        <Link to="/how-it-works" className="nav-link py-2" onClick={() => setIsMobileMenuOpen(false)}>How It Works</Link>
                        <Link to="/glossary" className="nav-link py-2" onClick={() => setIsMobileMenuOpen(false)}>Glossary</Link>
                      </>
                    )}
                  </>
                )}
                <div className="h-px bg-tawf-green/10 my-2" />
                {isAuthenticated && (
                  <Link to="/investor/dashboard" className="nav-link py-2" onClick={() => setIsMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                )}
                <WalletButton className="btn-primary text-sm px-4 py-2 rounded-lg w-full justify-center" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </motion.nav>
  );
}
