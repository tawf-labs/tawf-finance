import { motion } from 'framer-motion';
import { Heart, Shield, Users, Award, Target, X, CheckCircle } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export function About() {
  const values = [
    {
      icon: <Heart className="w-8 h-8" />,
      title: 'Impact-First',
      description: 'We prioritize positive social impact alongside financial returns, supporting MSMEs across Southeast Asia.',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Shariah Compliant',
      description: 'All our financial products follow Islamic finance principles, ensuring ethical and responsible investing.',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Community Driven',
      description: 'We empower local cooperatives to verify and support businesses in their communities.',
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Transparent',
      description: 'Blockchain technology ensures every transaction is verifiable and traceable.',
    },
  ];

  const team = [
    { name: 'Hasan VC', role: 'Founder & CEO', bio: 'Former investment banker with 15+ years in Islamic finance' },
    { name: 'Sarah Ahmed', role: 'CTO', bio: 'Blockchain pioneer building ethical DeFi solutions' },
    { name: 'Dr. Rahman', role: 'Shariah Board Lead', bio: 'PhD in Islamic Finance, 20+ years of experience' },
    { name: 'Dewi Lestari', role: 'Head of Operations', bio: 'Expert in MSME development across Indonesia' },
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
          <span className="text-tawf-gold uppercase tracking-widest text-sm font-medium">About Us</span>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-tawf-green leading-[1.1] mt-4 mb-6">
            Democratizing Finance for
            <span className="block text-tawf-gold">Real Impact</span>
          </h1>
          <p className="text-tawf-muted text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            Tawf Finance bridges the gap between investors and micro, small, and medium enterprises,
            following Shariah principles to create ethical financial growth for all.
          </p>
        </motion.div>
      </Section>

      {/* Mission */}
      <Section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl text-tawf-green mb-6">Our Mission</h2>
          <p className="text-lg text-tawf-muted leading-relaxed mb-8">
            To empower millions of underserved MSMEs across Southeast Asia with access to ethical,
            affordable financing while enabling investors to earn competitive returns through Shariah-compliant investments.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">10M+</p>
              <p className="text-tawf-muted">MSMEs to Support</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">$50B</p>
              <p className="text-tawf-muted">Addressable Market</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">15%</p>
              <p className="text-tawf-muted">Target IRR</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Values */}
      <Section className="py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-12">Our Core Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="p-6 h-full">
                  <div className="p-3 bg-tawf-green-10 rounded-xl w-fit mb-4 text-tawf-green">
                    {value.icon}
                  </div>
                  <h3 className="font-serif text-xl text-tawf-green mb-2">{value.title}</h3>
                  <p className="text-tawf-muted text-sm">{value.description}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </Section>

      {/* How We're Different */}
      <Section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-12">How We're Different</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="p-6 bg-tawf-green-5">
              <h3 className="font-serif text-xl text-tawf-green mb-3">Traditional Finance</h3>
              <ul className="space-y-2 text-tawf-muted">
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Interest-based (riba)</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Collateral requirements</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Complex application process</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Hidden fees</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> No social impact tracking</li>
              </ul>
            </Card>
            <Card className="p-6 bg-tawf-green text-tawf-sand">
              <h3 className="font-serif text-xl mb-3">Tawf Finance</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Shariah-compliant profit sharing</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Based on business performance, not collateral</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Simple, cooperative-powered verification</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Transparent fees on blockchain</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Measurable social impact</li>
              </ul>
            </Card>
          </div>
        </div>
      </Section>

      {/* Team */}
      <Section className="py-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-12">Leadership Team</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {team.map((member, index) => (
              <Card key={index} className="p-6 text-center">
                <div className="w-20 h-20 mx-auto mb-4 bg-tawf-green-10 rounded-full flex items-center justify-center text-tawf-green text-2xl font-serif">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="font-medium text-tawf-green">{member.name}</h3>
                <p className="text-sm text-tawf-gold mb-2">{member.role}</p>
                <p className="text-xs text-tawf-muted">{member.bio}</p>
              </Card>
            ))}
          </div>
        </div>
      </Section>

      {/* Trust Architecture */}
      <Section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-serif text-3xl text-tawf-green text-center mb-6">Trust Architecture</h2>
          <p className="text-tawf-muted text-center mb-12">
            Our multi-layered trust system ensures security and transparency for all participants
          </p>

          <div className="space-y-6">
            {[
              {
                layer: 'Layer 1: Smart Contracts',
                description: 'All transactions executed through audited smart contracts on blockchain',
                color: 'tawf-green',
              },
              {
                layer: 'Layer 2: Cooperative Network',
                description: 'Local BMTs and cooperatives verify businesses using real-world relationships',
                color: 'tawf-gold',
              },
              {
                layer: 'Layer 3: Shariah Board',
                description: 'Independent scholars ensure all products comply with Islamic principles',
                color: 'blue-500',
              },
              {
                layer: 'Layer 4: Digital Receipts',
                description: 'Soulbound NFTs provide immutable proof of investment and impact',
                color: 'purple-500',
              },
            ].map((layer, index) => (
              <div key={index} className={`p-6 rounded-xl border-2 border-${layer.color}-10`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 bg-${layer.color}-10 rounded-lg`}>
                    <Target className={`w-6 h-6 text-${layer.color}`} />
                  </div>
                  <div>
                    <h3 className="font-medium text-tawf-green mb-1">{layer.layer}</h3>
                    <p className="text-tawf-muted text-sm">{layer.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
