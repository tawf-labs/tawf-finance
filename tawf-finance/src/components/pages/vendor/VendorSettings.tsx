import { Building2, Mail, Phone, Globe, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/hooks/useAuth';

export function VendorSettings() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Settings</h1>
        <p className="text-tawf-muted">Manage your vendor profile and preferences</p>
      </div>

      {/* Profile Section */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Company Profile</h3>

        <div className="flex items-center gap-6 p-6 bg-tawf-sand-30 rounded-xl mb-6">
          <div className="p-4 bg-white rounded-xl">
            <Building2 className="w-12 h-12 text-tawf-green" />
          </div>
          <div className="flex-1">
            <h3 className="font-serif text-xl text-tawf-green">{user?.organization}</h3>
            <p className="text-tawf-muted">{user?.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="success" size="sm">{user?.status}</Badge>
              <Badge variant="info" size="sm" className="capitalize">{user?.tier} Partner</Badge>
            </div>
          </div>
          <Button variant="secondary" size="md">Edit Profile</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Company Name</label>
            <input
              type="text"
              defaultValue={user?.organization}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Business Type</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>PT (Perseroan Terbatas)</option>
              <option>CV (Commanditaire Vennootschap)</option>
              <option>Firm</option>
              <option>UD (Usaha Dagang)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email Address
            </label>
            <input
              type="email"
              defaultValue={user?.email}
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
              defaultValue={user?.phoneNumber}
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Website
            </label>
            <input
              type="url"
              placeholder="https://yourcompany.com"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-tawf-ink mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Address
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

      {/* Service Preferences */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Service Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
            <div>
              <p className="font-medium text-tawf-green">Auto-accept Orders</p>
              <p className="text-sm text-tawf-muted">Automatically accept orders within your capacity</p>
            </div>
            <button className="w-12 h-6 rounded-full bg-tawf-green relative">
              <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
            <div>
              <p className="font-medium text-tawf-green">Weekend Deliveries</p>
              <p className="text-sm text-tawf-muted">Allow deliveries on weekends</p>
            </div>
            <button className="w-12 h-6 rounded-full bg-gray-200 relative">
              <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
            <div>
              <p className="font-medium text-tawf-green">Email Notifications</p>
              <p className="text-sm text-tawf-muted">Receive email notifications for new orders</p>
            </div>
            <button className="w-12 h-6 rounded-full bg-tawf-green relative">
              <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
        </div>
      </Card>

      {/* Team Management */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-xl text-tawf-green">Team Members</h3>
          <Button variant="primary" size="sm">+ Add Member</Button>
        </div>
        <div className="space-y-3">
          {[
            { name: 'Ahmad Rahman', role: 'Owner', email: 'ahmad@indonesiatek.co.id' },
            { name: 'Siti Nurhaliza', role: 'Operations Manager', email: 'siti@indonesiatek.co.id' },
            { name: 'Budi Santoso', role: 'Sales', email: 'budi@indonesiatek.co.id' },
          ].map((member, index) => (
            <div key={index} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
              <div className="flex items-center gap-3">
                <Avatar name={member.name} size="md" />
                <div>
                  <p className="font-medium text-tawf-green">{member.name}</p>
                  <p className="text-sm text-tawf-muted">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-tawf-muted">{member.role}</span>
                <Button variant="ghost" size="sm">Edit</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
