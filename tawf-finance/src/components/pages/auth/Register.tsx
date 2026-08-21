import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, ArrowLeft, User, Store, Building, Shield } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type UserRole = 'investor' | 'business' | 'cooperative' | 'issuer';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  organization?: string;
  businessType?: string;
  role?: UserRole;
  agreeTerms: boolean;
}

export function Register() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    agreeTerms: false,
  });

  const roleInfo = {
    investor: {
      title: 'Investor',
      icon: <User className="w-8 h-8" />,
      description: 'Earn returns while supporting MSMEs',
      color: 'bg-tawf-green',
    },
    business: {
      title: 'Business Owner',
      icon: <Store className="w-8 h-8" />,
      description: 'Get funding for your MSME',
      color: 'bg-tawf-gold',
    },
    cooperative: {
      title: 'Cooperative (BMT)',
      icon: <Building className="w-8 h-8" />,
      description: 'Verify and fund local businesses',
      color: 'bg-blue-500',
    },
    issuer: {
      title: 'Licensed Issuer',
      icon: <Shield className="w-8 h-8" />,
      description: 'Approve, mint, repay, and mature deals',
      color: 'bg-purple-500',
    },
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setTimeout(() => setStep(2), 300);
  };

  const handleSubmit = () => {
    // In a real app, would submit to backend
    console.log('Registration data:', { ...formData, role: selectedRole });
    navigate('/onboarding');
  };

  return (
    <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <img src="/tawftransparent.png" alt="Tawf Finance" className="h-16 w-auto mx-auto mb-4 invert" />
          <h1 className="font-serif text-3xl text-tawf-green">Create Account</h1>
          <p className="text-tawf-muted mt-2">Join the Tawf Finance ecosystem</p>
        </motion.div>

        {/* Progress */}
        {step > 1 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 1 ? 'bg-tawf-green text-white' : 'bg-tawf-green-10 text-tawf-muted'}`}>
              {step > 1 ? <Check className="w-4 h-4" /> : '1'}
            </div>
            <div className={`w-12 h-1 rounded-full ${step >= 2 ? 'bg-tawf-green' : 'bg-tawf-green-10'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step >= 2 ? 'bg-tawf-green text-white' : 'bg-tawf-green-10 text-tawf-muted'}`}>
              2
            </div>
          </div>
        )}

        {/* Step 1: Role Selection */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-6">
              <h2 className="font-serif text-xl text-tawf-green mb-2">I want to join as...</h2>
              <p className="text-sm text-tawf-muted mb-6">Select your role in the ecosystem</p>

              <div className="grid grid-cols-2 gap-4">
                {(Object.entries(roleInfo) as [UserRole, typeof roleInfo[UserRole]][]).map(([role, info]) => (
                  <button
                    key={role}
                    onClick={() => handleRoleSelect(role)}
                    className="p-5 border border-tawf-green-10 rounded-xl hover:border-tawf-green hover:bg-tawf-green-5 transition-all text-left"
                  >
                    <div className="text-3xl mb-2">{info.icon}</div>
                    <h3 className="font-medium text-tawf-green">{info.title}</h3>
                    <p className="text-xs text-tawf-muted mt-1">{info.description}</p>
                  </button>
                ))}
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-tawf-muted">
                  Already have an account?{' '}
                  <a href="/login" className="text-tawf-gold hover:underline font-medium">
                    Sign in
                  </a>
                </p>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Step 2: Registration Form */}
        {step === 2 && selectedRole && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <Card className="p-6">
              {/* Selected Role */}
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 text-tawf-muted hover:text-tawf-green mb-4 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Change role
              </button>

              <div className="flex items-center gap-3 p-4 bg-tawf-sand-30 rounded-xl mb-6">
                <span className="text-3xl">{roleInfo[selectedRole].icon}</span>
                <div>
                  <p className="font-medium text-tawf-green">Registering as {roleInfo[selectedRole].title}</p>
                  <p className="text-xs text-tawf-muted">{roleInfo[selectedRole].description}</p>
                </div>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">First Name</label>
                    <input
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">Last Name</label>
                    <input
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">Phone Number</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                    placeholder="+62 xxx xxxx xxxx"
                    required
                  />
                </div>

                {(selectedRole === 'business' || selectedRole === 'cooperative' || selectedRole === 'issuer') && (
                  <div>
                    <label className="block text-sm font-medium text-tawf-ink mb-2">Organization/Business Name</label>
                    <input
                      type="text"
                      value={formData.organization}
                      onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                      className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-tawf-ink mb-2">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                    required
                  />
                  <p className="text-xs text-tawf-muted mt-1">Must be at least 8 characters</p>
                </div>

                <div className="flex items-start gap-3 p-4 bg-tawf-sand-30 rounded-xl">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={formData.agreeTerms}
                    onChange={(e) => setFormData({ ...formData, agreeTerms: e.target.checked })}
                    className="mt-1 rounded text-tawf-green focus:ring-tawf-gold"
                    required
                  />
                  <label htmlFor="terms" className="text-sm text-tawf-muted">
                    I agree to the{' '}
                    <a href="#" className="text-tawf-gold hover:underline">Terms of Service</a>
                    {' '}and{' '}
                    <a href="#" className="text-tawf-gold hover:underline">Privacy Policy</a>
                  </label>
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={!formData.agreeTerms}>
                  Create Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </form>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
