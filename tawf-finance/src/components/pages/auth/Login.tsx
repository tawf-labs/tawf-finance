import { useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight, User, Store, Building, Truck, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { demoUsers } from '@/data/mockData';

export function Login() {
  const { loginAsDemo, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login(email);
      // Navigation is handled by AuthContext
    } catch (error) {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: keyof typeof demoUsers) => {
    setIsLoading(true);
    await loginAsDemo(role);
    // Navigation is handled by AuthContext
  };

  return (
    <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <img src="/tawftransparent.png" alt="Tawf Finance" className="h-20 w-auto mx-auto mb-4 invert" />
          <h1 className="font-serif text-3xl text-tawf-green">Welcome Back</h1>
          <p className="text-tawf-muted mt-2">Sign in to your Tawf Finance account</p>
        </motion.div>

        {/* Demo Login Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="p-6">
            <h3 className="text-sm font-medium text-tawf-muted mb-4 text-center">
              Quick Demo Access
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleDemoLogin('investor')}
                disabled={isLoading}
                className="p-3 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-colors text-center disabled:opacity-50"
              >
                <User className="w-6 h-6 mx-auto mb-1 text-tawf-green" />
                <p className="text-sm font-medium text-tawf-green">Investor</p>
              </button>
              <button
                onClick={() => handleDemoLogin('business')}
                disabled={isLoading}
                className="p-3 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-colors text-center disabled:opacity-50"
              >
                <Store className="w-6 h-6 mx-auto mb-1 text-tawf-green" />
                <p className="text-sm font-medium text-tawf-green">Business</p>
              </button>
              <button
                onClick={() => handleDemoLogin('cooperative')}
                disabled={isLoading}
                className="p-3 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-colors text-center disabled:opacity-50"
              >
                <Building className="w-6 h-6 mx-auto mb-1 text-tawf-green" />
                <p className="text-sm font-medium text-tawf-green">Cooperative</p>
              </button>
              <button
                onClick={() => handleDemoLogin('vendor')}
                disabled={isLoading}
                className="p-3 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-colors text-center disabled:opacity-50"
              >
                <Truck className="w-6 h-6 mx-auto mb-1 text-tawf-green" />
                <p className="text-sm font-medium text-tawf-green">Vendor</p>
              </button>
            </div>
            <button
              onClick={() => handleDemoLogin('admin')}
              disabled={isLoading}
              className="w-full mt-3 p-3 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-colors disabled:opacity-50"
            >
              <div className="flex items-center justify-center gap-2">
                <Shield className="w-5 h-5 text-tawf-green" />
                <span className="text-sm font-medium text-tawf-green">Admin Demo</span>
              </div>
            </button>
          </Card>
        </motion.div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-tawf-green-10" />
          <span className="text-sm text-tawf-muted">or</span>
          <div className="flex-1 h-px bg-tawf-green-10" />
        </div>

        {/* Login Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="p-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full pl-12 pr-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-tawf-muted" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-12 pr-12 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-tawf-muted hover:text-tawf-green"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded text-tawf-green focus:ring-tawf-gold" />
                  <span className="text-sm text-tawf-muted">Remember me</span>
                </label>
                <a href="#" className="text-sm text-tawf-gold hover:underline">
                  Forgot password?
                </a>
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
                {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </form>

            <p className="text-center text-sm text-tawf-muted mt-6">
              Don't have an account?{' '}
              <a href="/register" className="text-tawf-gold hover:underline font-medium">
                Create account
              </a>
            </p>
          </Card>
        </motion.div>

        {/* Tawf ID Connect */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="p-4 mt-4 bg-gradient-to-r from-tawf-green to-tawf-green-light text-white text-center">
            <p className="text-sm text-tawf-sand-80 mb-3">
              Or continue with Tawf ID
            </p>
            <Button variant="secondary" size="md" className="bg-white text-tawf-green hover:bg-tawf-sand w-full">
              Connect Tawf ID
            </Button>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
