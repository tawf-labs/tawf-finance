import { DollarSign, Lightbulb, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/data/mockData';

export function Funding() {
  const fundingOptions = [
    {
      id: 1,
      name: 'Working Capital',
      description: 'Short-term funding for inventory and operational expenses',
      minAmount: 1000,
      maxAmount: 50000,
      duration: '30-90 days',
      rate: '1.5-3%',
      features: ['Fast approval', 'Flexible repayment', 'No collateral'],
    },
    {
      id: 2,
      name: 'Inventory Financing',
      description: 'Fund your inventory purchases with supplier partnerships',
      minAmount: 5000,
      maxAmount: 100000,
      duration: '30-60 days',
      rate: '2-4%',
      features: ['Direct to vendor', 'Bulk discounts', 'Quality assured'],
    },
    {
      id: 3,
      name: 'Growth Capital',
      description: 'Expand your business with longer-term financing',
      minAmount: 10000,
      maxAmount: 250000,
      duration: '90-180 days',
      rate: '3-5%',
      features: ['Business consulting', 'Mentorship', 'Network access'],
    },
  ];

  const applicationHistory = [
    { id: 'PO-001', amount: 5000, status: 'approved', date: '2024-03-05', type: 'Working Capital' },
    { id: 'PO-002', amount: 3500, status: 'active', date: '2024-03-12', type: 'Inventory Financing' },
    { id: 'PO-003', amount: 8000, status: 'pending', date: '2024-03-28', type: 'Inventory Financing' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Funding Options</h1>
        <p className="text-tawf-muted">Explore financing solutions tailored for your business</p>
      </div>

      {/* Your Tawf Score */}
      <Card className="p-6 bg-gradient-to-br from-tawf-green to-tawf-green-light text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-xl mb-1">Your Tawf Score</h3>
            <p className="text-tawf-sand-80 text-sm">Based on your business profile and repayment history</p>
          </div>
          <div className="text-center">
            <p className="font-serif text-5xl">78</p>
            <p className="text-tawf-sand-80 text-sm">Good Standing</p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-tawf-gold" />
          <p className="text-sm text-tawf-sand-80">
            Improve your score to access better rates and higher limits
          </p>
        </div>
      </Card>

      {/* Funding Options */}
      <div>
        <h2 className="font-serif text-xl text-tawf-green mb-4">Available Funding Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {fundingOptions.map((option) => (
            <Card key={option.id} hover className="p-6">
              <div className="mb-4">
                <div className="p-3 bg-tawf-green-10 rounded-xl w-fit mb-3">
                  <DollarSign className="w-6 h-6 text-tawf-green" />
                </div>
                <h3 className="font-serif text-xl text-tawf-green mb-2">{option.name}</h3>
                <p className="text-sm text-tawf-muted">{option.description}</p>
              </div>

              <div className="space-y-2 mb-4 p-4 bg-tawf-sand-30 rounded-xl">
                <div className="flex justify-between text-sm">
                  <span className="text-tawf-muted">Amount</span>
                  <span className="font-medium text-tawf-green">
                    {formatCurrency(option.minAmount)} - {formatCurrency(option.maxAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tawf-muted">Duration</span>
                  <span className="font-medium text-tawf-green">{option.duration}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-tawf-muted">Profit Rate</span>
                  <span className="font-medium text-tawf-gold">{option.rate}</span>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-xs text-tawf-muted mb-2">Key Features:</p>
                <ul className="space-y-1">
                  {option.features.map((feature, index) => (
                    <li key={index} className="text-sm text-tawf-green flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-tawf-gold" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Button variant="primary" size="md" className="w-full">
                Apply Now
              </Button>
            </Card>
          ))}
        </div>
      </div>

      {/* Application History */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">Application History</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-tawf-green-10">
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Reference</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Type</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Amount</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Status</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted">Date</th>
              </tr>
            </thead>
            <tbody>
              {applicationHistory.map((app) => (
                <tr key={app.id} className="border-b border-tawf-green-5">
                  <td className="py-4 px-4 font-medium text-tawf-green">{app.id}</td>
                  <td className="py-4 px-4 text-sm">{app.type}</td>
                  <td className="py-4 px-4 text-sm font-medium">{formatCurrency(app.amount)}</td>
                  <td className="py-4 px-4">
                    <Badge variant={app.status === 'approved' ? 'success' : app.status === 'active' ? 'indigo' : 'warning'} size="sm">
                      {app.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-sm text-tawf-muted">{app.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* How It Works */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">How Funding Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: '1', title: 'Create PO', desc: 'Submit a purchase order with your chosen vendor' },
            { step: '2', title: 'Verification', desc: 'Cooperative verifies the PO and business details' },
            { step: '3', title: 'Funding', desc: 'Investor pool funds the verified PO' },
            { step: '4', title: 'Repayment', desc: 'Repay as your sales come in, profit-sharing' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-12 h-12 mx-auto mb-3 bg-tawf-green text-tawf-sand rounded-full flex items-center justify-center font-serif text-xl">
                {item.step}
              </div>
              <h3 className="font-medium text-tawf-green mb-1">{item.title}</h3>
              <p className="text-sm text-tawf-muted">{item.desc}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
