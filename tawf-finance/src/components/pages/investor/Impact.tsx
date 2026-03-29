import { motion } from 'framer-motion';
import { Heart, Users, Building2, Globe, Award, Store, Leaf, Palette } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { mockImpactMetrics } from '@/data/mockData';
import { cn } from '@/utils/cn';

const impactStories = [
  {
    id: 1,
    business: 'Warung Berkah',
    location: 'Jakarta Selatan, Indonesia',
    category: 'Retail',
    impact: 'Expanded inventory by 40% and hired 2 new employees after receiving funding.',
    icon: <Store className="w-8 h-8" />,
  },
  {
    id: 2,
    business: 'Jamu Herbal Sehat',
    location: 'Yogyakarta, Indonesia',
    category: 'Health & Wellness',
    impact: 'Increased production capacity by 60% and now supplies 50+ retail stores.',
    icon: <Leaf className="w-8 h-8" />,
  },
  {
    id: 3,
    business: 'Kerajinan Nusantara',
    location: 'Surakarta, Indonesia',
    category: 'Crafts',
    impact: 'Preserved traditional batik techniques and trained 15 local artisans.',
    icon: <Palette className="w-8 h-8" />,
  },
];

const digitalReceipts = [
  { id: 'inv-001', pool: 'Kurban Farms Pool', amount: 500, date: '2024-03-01', hash: '0xabc123...' },
  { id: 'inv-002', pool: 'Warung Pool', amount: 300, date: '2024-03-15', hash: '0xdef456...' },
  { id: 'inv-003', pool: 'Jamu & Herbal Pool', amount: 250, date: '2024-01-10', hash: '0xghi789...' },
];

export function Impact() {
  const stats = [
    { label: 'MSMEs Supported', value: mockImpactMetrics.msmeSupported.toLocaleString(), icon: Building2, color: 'green' },
    { label: 'Jobs Created', value: mockImpactMetrics.jobsCreated.toLocaleString(), icon: Users, color: 'gold' },
    { label: 'Communities Impacted', value: mockImpactMetrics.communitiesImpacted.toLocaleString(), icon: Globe, color: 'blue' },
    { label: 'Countries', value: mockImpactMetrics.countries.toString(), icon: Globe, color: 'purple' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Your Impact</h1>
        <p className="text-tawf-muted">See the real difference your investments are making</p>
      </div>

      {/* Global Impact Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-2xl border border-tawf-green-10 p-6"
          >
            <div className={cn('p-3 rounded-xl w-fit mb-4', stat.color === 'green' ? 'bg-tawf-green-10' : stat.color === 'gold' ? 'bg-tawf-gold-10' : stat.color === 'blue' ? 'bg-blue-50' : 'bg-purple-50')}>
              <stat.icon className={cn('w-6 h-6', stat.color === 'green' ? 'text-tawf-green' : stat.color === 'gold' ? 'text-tawf-gold' : stat.color === 'blue' ? 'text-blue-600' : 'text-purple-600')} />
            </div>
            <p className="font-serif text-2xl text-tawf-green mb-1">{stat.value}</p>
            <p className="text-sm text-tawf-muted">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Detailed Impact Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-serif text-xl text-tawf-green mb-4">Impact Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Building2 className="w-5 h-5 text-green-600" />
                </div>
                <span className="font-medium">Women-Led Businesses</span>
              </div>
              <span className="font-serif text-lg text-tawf-green">
                {mockImpactMetrics.womenLedBusinesses.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <Award className="w-5 h-5 text-amber-600" />
                </div>
                <span className="font-medium">Rural Businesses</span>
              </div>
              <span className="font-serif text-lg text-tawf-green">
                {mockImpactMetrics.ruralBusinesses.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Globe className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-medium">Total Disbursed</span>
              </div>
              <span className="font-serif text-lg text-tawf-green">
                ${(mockImpactMetrics.totalDisbursed / 1000000).toFixed(1)}M
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-tawf-gold-20 rounded-lg">
                  <Heart className="w-5 h-5 text-tawf-gold" />
                </div>
                <span className="font-medium">Average ROI</span>
              </div>
              <span className="font-serif text-lg text-tawf-green">
                {mockImpactMetrics.averageROI}%
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-serif text-xl text-tawf-green mb-4">Your Contribution</h3>
          <div className="text-center py-8">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-tawf-green to-tawf-gold flex items-center justify-center">
              <Heart className="w-16 h-16 text-white" />
            </div>
            <p className="text-sm text-tawf-muted mb-1">Your investments have helped support</p>
            <p className="font-serif text-3xl text-tawf-green mb-2">12 MSMEs</p>
            <p className="text-sm text-tawf-muted">across 3 communities</p>
          </div>
          <div className="border-t border-tawf-green-10 pt-4 mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-tawf-muted">Shariah Compliant</span>
              <Badge variant="success" size="sm">100%</Badge>
            </div>
          </div>
        </Card>
      </div>

      {/* Impact Stories */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Impact Stories</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {impactStories.map((story) => (
            <div key={story.id} className="bg-tawf-sand-30 rounded-xl p-5">
              <div className="text-tawf-green mb-3">{story.icon}</div>
              <h4 className="font-medium text-tawf-green mb-1">{story.business}</h4>
              <p className="text-xs text-tawf-muted mb-3">{story.location}</p>
              <Badge variant="info" size="sm" className="mb-3">{story.category}</Badge>
              <p className="text-sm text-tawf-muted">{story.impact}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Digital Receipts */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-tawf-green">Digital Receipts</h3>
          <button className="text-sm text-tawf-gold hover:underline">
            View All
          </button>
        </div>
        <p className="text-sm text-tawf-muted mb-4">
          Soulbound NFTs that prove your on-chain investments and impact
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {digitalReceipts.map((receipt) => (
            <div key={receipt.id} className="border border-tawf-green-10 rounded-xl p-4 hover:border-tawf-gold transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-tawf-gold-20 rounded-lg">
                  <Award className="w-5 h-5 text-tawf-gold" />
                </div>
                <Badge variant="success" size="sm">Verified</Badge>
              </div>
              <h4 className="font-medium text-tawf-green mb-1">{receipt.pool}</h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-tawf-muted">${receipt.amount}</span>
                <span className="text-tawf-muted">{receipt.date}</span>
              </div>
              <div className="mt-3 pt-3 border-t border-tawf-green-10">
                <p className="text-xs font-mono text-tawf-muted truncate">{receipt.hash}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Share Impact */}
      <Card className="p-8 text-center bg-gradient-to-br from-tawf-green to-tawf-green-light text-white">
        <Heart className="w-12 h-12 mx-auto mb-4 text-tawf-gold" />
        <h3 className="font-serif text-2xl mb-2">Share Your Impact</h3>
        <p className="text-tawf-sand-70 mb-6 max-w-md mx-auto">
          Your investments are creating real change. Share your impact story and inspire others to join the movement.
        </p>
        <div className="flex justify-center gap-3">
          <button className="px-6 py-3 bg-white text-tawf-green rounded-full font-medium hover:bg-tawf-sand transition-colors">
            Share on Twitter
          </button>
          <button className="px-6 py-3 bg-tawf-gold text-tawf-green rounded-full font-medium hover:bg-tawf-gold-80 transition-colors">
            Copy Impact Report
          </button>
        </div>
      </Card>
    </div>
  );
}
