import { motion } from 'framer-motion';
import { ArrowRight, Wallet, Search, CheckCircle, TrendingUp, Shield, FileText } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { Link } from 'react-router-dom';

export function HowItWorks() {
  const investorSteps = [
    {
      step: '01',
      icon: <Search className="w-8 h-8" />,
      title: 'Browse Pools',
      description: 'Explore our curated investment pools supporting different MSME sectors across Southeast Asia.',
    },
    {
      step: '02',
      icon: <Wallet className="w-8 h-8" />,
      title: 'Connect & Invest',
      description: 'Connect your wallet and stake your chosen amount. Minimum investment starts at just $10.',
    },
    {
      step: '03',
      icon: <CheckCircle className="w-8 h-8" />,
      title: 'Receive Returns',
      description: 'Earn profit share as businesses grow. Your funds are recycled into new opportunities.',
    },
  ];

  const businessSteps = [
    {
      step: '01',
      icon: <FileText className="w-8 h-8" />,
      title: 'Create PO',
      description: 'Submit a purchase order for the inventory or supplies your business needs.',
    },
    {
      step: '02',
      icon: <Shield className="w-8 h-8" />,
      title: 'Get Verified',
      description: 'Your local cooperative verifies your business and approves the funding request.',
    },
    {
      step: '03',
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Grow Business',
      description: 'Receive funding, fulfill orders, and repay as your revenue comes in.',
    },
  ];

  return (
    <div className="min-h-screen bg-tawf-sand">
      {/* Hero Section */}
      <Section className="py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto text-center"
        >
          <span className="text-tawf-gold uppercase tracking-widest text-sm font-medium">How It Works</span>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-tawf-green leading-[1.1] mt-4 mb-6">
            Simple, Ethical,
            <span className="block text-tawf-gold">Impactful Investing</span>
          </h1>
          <p className="text-tawf-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Our platform makes it easy to invest in MSMEs or get funding for your business,
            all while following Shariah principles.
          </p>
        </motion.div>
      </Section>

      {/* For Investors */}
      <Section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-tawf-green mb-4">For Investors</h2>
            <p className="text-tawf-muted max-w-2xl mx-auto">
              Start earning competitive returns while supporting real businesses in just a few steps
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {investorSteps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-serif text-tawf-green-10 font-bold absolute -top-4 -left-2">
                  {step.step}
                </div>
                <div className="bg-tawf-sand-30 rounded-2xl p-8 pt-10 h-full">
                  <div className="p-3 bg-tawf-green-10 rounded-xl w-fit mb-4 text-tawf-green">
                    {step.icon}
                  </div>
                  <h3 className="font-serif text-xl text-tawf-green mb-3">{step.title}</h3>
                  <p className="text-tawf-muted">{step.description}</p>
                </div>
                {index < investorSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-tawf-gold transform translate-y-8" />
                )}
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to="/earn">
              <Button variant="primary" size="lg">
                Explore Investment Pools
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </Section>

      {/* For Businesses */}
      <Section className="py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl text-tawf-green mb-4">For Business Owners</h2>
            <p className="text-tawf-muted max-w-2xl mx-auto">
              Access the funding you need to grow your MSME without collateral or complex paperwork
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {businessSteps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                <div className="text-6xl font-serif text-tawf-gold-20 font-bold absolute -top-4 -left-2">
                  {step.step}
                </div>
                <div className="bg-white rounded-2xl border border-tawf-green-10 p-8 pt-10 h-full">
                  <div className="p-3 bg-tawf-gold-10 rounded-xl w-fit mb-4 text-tawf-gold">
                    {step.icon}
                  </div>
                  <h3 className="font-serif text-xl text-tawf-green mb-3">{step.title}</h3>
                  <p className="text-tawf-muted">{step.description}</p>
                </div>
                {index < businessSteps.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-tawf-gold transform translate-y-8" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* Fee Structure */}
      <Section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-4">Transparent Fee Structure</h2>
          <p className="text-tawf-muted text-center mb-12">
            No hidden fees. Everything is clearly communicated upfront.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-tawf-sand-30 rounded-xl text-center">
              <p className="text-4xl font-serif text-tawf-green mb-2">0%</p>
              <p className="font-medium text-tawf-ink mb-1">For Investors</p>
              <p className="text-sm text-tawf-muted">No fees to invest or withdraw</p>
            </div>
            <div className="p-6 bg-tawf-sand-30 rounded-xl text-center">
              <p className="text-4xl font-serif text-tawf-green mb-2">~2-5%</p>
              <p className="font-medium text-tawf-ink mb-1">Platform Fee</p>
              <p className="text-sm text-tawf-muted">From profit returns to MSMEs</p>
            </div>
            <div className="p-6 bg-tawf-sand-30 rounded-xl text-center">
              <p className="text-4xl font-serif text-tawf-green mb-2">1%</p>
              <p className="font-medium text-tawf-ink mb-1">Cooperative Fee</p>
              <p className="text-sm text-tawf-muted">For verification services</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Security */}
      <Section className="py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-12">Bank-Grade Security</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 p-6 bg-white rounded-xl border border-tawf-green-10">
              <div className="p-3 bg-tawf-green-10 rounded-lg text-tawf-green">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-medium text-tawf-green mb-1">Smart Contract Audits</h3>
                <p className="text-sm text-tawf-muted">All contracts audited by leading security firms</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-white rounded-xl border border-tawf-green-10">
              <div className="p-3 bg-tawf-green-10 rounded-lg text-tawf-green">
                <Wallet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-medium text-tawf-green mb-1">Non-Custodial</h3>
                <p className="text-sm text-tawf-muted">You always control your private keys</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-white rounded-xl border border-tawf-green-10">
              <div className="p-3 bg-tawf-green-10 rounded-lg text-tawf-green">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-medium text-tawf-green mb-1">KYC Verified</h3>
                <p className="text-sm text-tawf-muted">All users undergo identity verification</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-white rounded-xl border border-tawf-green-10">
              <div className="p-3 bg-tawf-green-10 rounded-lg text-tawf-green">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-medium text-tawf-green mb-1">24/7 Monitoring</h3>
                <p className="text-sm text-tawf-muted">Continuous monitoring for suspicious activity</p>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </div>
  );
}
