import { motion } from 'framer-motion';
import { Heart, Shield, Users, Award, Target, X, CheckCircle } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';

export function About() {
  const values = [
    {
      icon: <Heart className="w-8 h-8" />,
      title: 'Impact-First',
      description: 'We give licensed Shariah rural banks (BPRS) a wider funding channel, and give investors verifiable exposure to real serviced financing.',
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Shariah Aligned',
      description: 'Every sell-down akad (wakalah bil istithmar / musyarakah) is reviewed by the bank\'s DPS, ensuring ethical and responsible structures.',
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Originator-Led',
      description: 'The BPRS keeps originating and servicing its own financing. We provide the structuring, rails, and verification.',
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Transparent',
      description: 'On-chain verification of pool size, NPF ratio, and akad compliance, without exposing any borrower identity.',
    },
  ];

  const team = [
    { name: 'Hasan VC', role: 'Founder & CEO', bio: 'Former investment banker with 15+ years in Islamic finance' },
    { name: 'Sarah Ahmed', role: 'CTO', bio: 'Blockchain pioneer building ethical DeFi solutions' },
    { name: 'Dr. Rahman', role: 'Shariah Board Lead', bio: 'PhD in Islamic Finance, 20+ years of experience' },
    { name: 'Dewi Lestari', role: 'Head of Operations', bio: 'Expert in Shariah banking and BPRS operations across Indonesia' },
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
            Tawf Finance is originator-side Islamic capital-markets infrastructure. We let a licensed
            Shariah bank (BPRS) sell down a pool of its financing to an outside investor pool through
            a compliant akad.
          </p>
        </motion.div>
      </Section>

      {/* Mission */}
      <Section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-serif text-3xl text-tawf-green mb-6">Our Mission</h2>
          <p className="text-lg text-tawf-muted leading-relaxed mb-8">
            To give Indonesia&apos;s capital-constrained Shariah rural banks a funding channel priced
            outside their local deposit market, while enabling investors to take verifiable, Shariah-aligned
            exposure to real serviced financing.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">~175</p>
              <p className="text-tawf-muted">BPRS in Indonesia</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">250bp</p>
              <p className="text-tawf-muted">Funding Cost Gap</p>
            </div>
            <div>
              <p className="font-serif text-4xl text-tawf-green mb-2">$10</p>
              <p className="text-tawf-muted">Minimum Exposure</p>
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
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Trapped inside one operating area</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> High, capped deposit funding cost</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Quarterly PDF from the servicer</li>
                <li className="flex items-center gap-2"><X className="w-4 h-4 text-red-500" /> Balance sheet constrains growth</li>
              </ul>
            </Card>
            <Card className="p-6 bg-tawf-green text-tawf-sand">
              <h3 className="font-serif text-xl mb-3">Tawf Finance</h3>
              <ul className="space-y-2">
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Shariah-aligned profit sharing via a sell-down akad</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Funding priced outside the local deposit market</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> DPS-reviewed, OJK-supervised originator</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Continuous on-chain pool verification</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-white" /> Releases balance-sheet capacity to keep growing</li>
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
                layer: 'Layer 2: BPRS Originator',
                description: 'A licensed, OJK-supervised Shariah bank originates and services the financing and reports into SLIK',
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
