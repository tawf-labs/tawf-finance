import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, TrendingUp, FileText, Heart, Sprout, Store, Building, Truck, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';

export function Onboarding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const totalSteps = user?.role === 'investor' ? 4 : 3;

  const onboardingSteps = {
    investor: [
      {
        title: 'Welcome to Tawf Finance!',
        description: 'Let\'s get you started with a quick tour of our platform.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-green-10 rounded-full flex items-center justify-center">
              <Sprout className="w-12 h-12 text-tawf-green" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Ethical Finance, Real Impact</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Tawf Finance connects investors like you with MSMEs across Southeast Asia, following Shariah principles.
            </p>
          </div>
        ),
      },
      {
        title: 'Explore Investment Pools',
        description: 'Discover vetted MSMEs seeking funding.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-gold-10 rounded-full flex items-center justify-center">
              <TrendingUp className="w-12 h-12 text-tawf-gold" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Earn Competitive Returns</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Invest in curated pools with 10-20% APY while supporting real businesses and communities.
            </p>
            <div className="flex justify-center gap-4 mt-6">
              <Badge variant="success" size="md">Shariah Compliant</Badge>
              <Badge variant="info" size="md">10-20% APY</Badge>
              <Badge variant="warning" size="md">Low Risk</Badge>
            </div>
          </div>
        ),
      },
      {
        title: 'Track Your Impact',
        description: 'See the difference you\'re making.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-green-50 rounded-full flex items-center justify-center">
              <Heart className="w-12 h-12 text-green-600" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Real Impact, Real Stories</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Track the MSMEs you've supported, jobs created, and communities impacted by your investments.
            </p>
          </div>
        ),
      },
      {
        title: 'You\'re All Set!',
        description: 'Start your investment journey today.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-tawf-green to-tawf-gold rounded-full flex items-center justify-center text-white">
              <Check className="w-12 h-12" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Ready to Invest?</h3>
            <p className="text-tawf-muted max-w-md mx-auto mb-6">
              You have $5,000 in demo funds to start exploring investment pools.
            </p>
          </div>
        ),
      },
    ],
    business: [
      {
        title: 'Welcome to Tawf Finance!',
        description: 'Let\'s get your business funded.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-green-10 rounded-full flex items-center justify-center">
              <Store className="w-12 h-12 text-tawf-green" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Grow Your MSME</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Get working capital for your business through our network of cooperatives and investors.
            </p>
          </div>
        ),
      },
      {
        title: 'Create Purchase Orders',
        description: 'Request funding for inventory and supplies.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-gold-10 rounded-full flex items-center justify-center">
              <FileText className="w-12 h-12 text-tawf-gold" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Quick & Easy Funding</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Submit purchase orders and get verified by your cooperative for fast funding approval.
            </p>
          </div>
        ),
      },
      {
        title: 'You\'re All Set!',
        description: 'Start requesting funding today.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-tawf-green to-tawf-gold rounded-full flex items-center justify-center text-white">
              <Check className="w-12 h-12" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Ready to Get Funded?</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Your Tawf Score is {78} - complete your profile to improve it and access better rates.
            </p>
          </div>
        ),
      },
    ],
    cooperative: [
      {
        title: 'Welcome to Tawf Finance!',
        description: 'Let\'s set up your cooperative dashboard.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-green-10 rounded-full flex items-center justify-center">
              <Building className="w-12 h-12 text-tawf-green" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Empower Your Community</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Verify local businesses and facilitate funding to support MSMEs in your area.
            </p>
          </div>
        ),
      },
      {
        title: 'Verify & Fund Businesses',
        description: 'Review and approve purchase orders.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-blue-50 rounded-full flex items-center justify-center">
              <Check className="w-12 h-12 text-blue-600" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Build Trust & Grow</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Use your local knowledge to verify businesses and help them access the funding they need.
            </p>
          </div>
        ),
      },
      {
        title: 'You\'re All Set!',
        description: 'Start supporting local businesses.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-tawf-green to-tawf-gold rounded-full flex items-center justify-center text-white">
              <Check className="w-12 h-12" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Ready to Make an Impact?</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              You have {3} businesses pending verification. Start reviewing them now!
            </p>
          </div>
        ),
      },
    ],
    vendor: [
      {
        title: 'Welcome to Tawf Finance!',
        description: 'Let\'s set up your vendor profile.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-tawf-green-10 rounded-full flex items-center justify-center">
              <Truck className="w-12 h-12 text-tawf-green" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Supply & Grow</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Connect with cooperatives and MSMEs to supply your products and services.
            </p>
          </div>
        ),
      },
      {
        title: 'List Your Services',
        description: 'Showcase your offerings to MSMEs.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-purple-50 rounded-full flex items-center justify-center">
              <Package className="w-12 h-12 text-purple-600" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Expand Your Reach</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              List your services and products to reach thousands of MSMEs looking for reliable vendors.
            </p>
          </div>
        ),
      },
      {
        title: 'You\'re All Set!',
        description: 'Start receiving orders today.',
        content: (
          <div className="text-center py-8">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-tawf-green to-tawf-gold rounded-full flex items-center justify-center text-white">
              <Check className="w-12 h-12" />
            </div>
            <h3 className="font-serif text-2xl text-tawf-green mb-3">Ready to Serve?</h3>
            <p className="text-tawf-muted max-w-md mx-auto">
              Add your services and start receiving orders from MSMEs across Indonesia.
            </p>
          </div>
        ),
      },
    ],
  };

  const steps = onboardingSteps[user?.role as keyof typeof onboardingSteps] || onboardingSteps.investor;
  const currentStepData = steps[step - 1];

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      // Redirect to appropriate dashboard
      const redirectMap: Record<string, string> = {
        investor: '/investor/dashboard',
        business: '/business/dashboard',
        cooperative: '/cooperative/dashboard',
        vendor: '/vendor/dashboard',
        admin: '/admin/dashboard',
      };
      navigate(redirectMap[user?.role || 'investor']);
    }
  };

  const handleSkip = () => {
    const redirectMap: Record<string, string> = {
      investor: '/investor/dashboard',
      business: '/business/dashboard',
      cooperative: '/cooperative/dashboard',
      vendor: '/vendor/dashboard',
      admin: '/admin/dashboard',
    };
    navigate(redirectMap[user?.role || 'investor']);
  };

  return (
    <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                i + 1 <= step ? 'bg-tawf-green text-white' : 'bg-tawf-green-10 text-tawf-muted'
              }`}>
                {i + 1 < step ? <Check className="w-5 h-5" /> : i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div className={`w-12 h-1 rounded-full mx-1 transition-all ${i + 1 < step ? 'bg-tawf-green' : 'bg-tawf-green-10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="p-8">
            <h2 className="font-serif text-2xl text-tawf-green mb-2 text-center">
              {currentStepData.title}
            </h2>
            <p className="text-tawf-muted text-center mb-6">
              {currentStepData.description}
            </p>

            {currentStepData.content}

            <div className="flex justify-center gap-4 mt-8">
              {step > 1 && (
                <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button variant="primary" size="lg" onClick={handleNext}>
                {step === totalSteps ? 'Go to Dashboard' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            {step < totalSteps && (
              <button
                onClick={handleSkip}
                className="w-full mt-4 text-sm text-tawf-muted hover:text-tawf-green"
              >
                Skip onboarding
              </button>
            )}
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
