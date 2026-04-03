import { Building2, Mail, Phone, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';

export function BusinessSettings() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Settings</h1>
        <p className="text-tawf-muted">Manage your business profile and preferences</p>
      </div>

      {/* Profile Section */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Business Profile</h3>

        <div className="flex items-center gap-6 p-6 bg-tawf-sand-30 rounded-xl mb-6">
          <div className="p-4 bg-white rounded-xl">
            <Building2 className="w-12 h-12 text-tawf-green" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-xl text-tawf-green">{user?.address ? `${user.address.slice(0, 4)}...${user.address.slice(-4)}` : 'Wallet'}</h3>
            <p className="text-tawf-muted font-mono text-sm">{user?.address ?? ''}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success" size="sm">{'Active'}</Badge>
            </div>
          </div>
          <Button variant="secondary" size="md">Edit Profile</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Business Name</label>
            <input
              type="text"
              defaultValue={''}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Business Type</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>Retail</option>
              <option>Food & Beverage</option>
              <option>Agriculture</option>
              <option>Manufacturing</option>
              <option>Services</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              defaultValue={''}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <Phone className="w-4 h-4" />
              Phone Number
            </label>
            <input
              type="tel"
              defaultValue={''}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Business Address
            </label>
            <textarea
              rows={2}
              placeholder="Full business address"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="ghost" size="md">Cancel</Button>
          <Button variant="primary" size="md">Save Changes</Button>
        </div>
      </Card>

      {/* Team Management */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Team Members</h3>
        <p className="text-sm text-tawf-muted mb-4">Add team members to help manage your business account</p>

        <div className="space-y-3">
          {[
            { name: 'Owner', email: user?.address ? `${user.address.slice(0, 4)}...${user.address.slice(-4)}` : 'owner', role: 'Owner' },
            { name: 'Manager', email: 'manager@business.com', role: 'Manager' },
          ].map((member, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} size="md" />
                <div>
                  <p className="font-medium text-tawf-green">{member.name}</p>
                  <p className="text-sm text-tawf-muted">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-tawf-muted">{member.role}</span>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Notification Preferences</h3>
        <div className="space-y-3">
          {[
            { title: 'PO Status Updates', desc: 'Get notified when POs are approved, funded, or require action' },
            { title: 'Repayment Reminders', desc: 'Receive reminders before repayment due dates' },
            { title: 'New Funding Opportunities', desc: 'Be notified about new funding options' },
            { title: 'Marketing Updates', desc: 'Receive tips and business insights' },
          ].map((item, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
              <div>
                <p className="font-medium text-tawf-green">{item.title}</p>
                <p className="text-sm text-tawf-muted">{item.desc}</p>
              </div>
              <button className="w-12 h-6 rounded-full bg-tawf-green relative">
                <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
