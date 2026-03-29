import { Settings, Bell, Shield, Database } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';

export function AdminSettings() {
  const tabs = [
    { id: 'general', label: 'General', content: null, icon: <Settings className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', content: null, icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Security', content: null, icon: <Shield className="w-4 h-4" /> },
    { id: 'integrations', label: 'Integrations', content: null, icon: <Database className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Platform Settings</h1>
        <p className="text-tawf-muted">Configure platform-wide settings and preferences</p>
      </div>

      {/* Tabs */}
      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="general" variant="underline" />

        <div className="mt-8 space-y-6">
          {/* Platform Info */}
          <div>
            <h3 className="font-medium text-tawf-green mb-4">Platform Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Platform Name</label>
                <input
                  type="text"
                  defaultValue="Tawf Finance"
                  className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Support Email</label>
                <input
                  type="email"
                  defaultValue="support@tawf.finance"
                  className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
              </div>
            </div>
          </div>

          {/* Fee Structure */}
          <div>
            <h3 className="font-medium text-tawf-green mb-4">Fee Structure</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Platform Fee (%)</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="2.5"
                  className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
                <p className="text-xs text-tawf-muted mt-1">Fee charged on all transactions</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Cooperative Fee (%)</label>
                <input
                  type="number"
                  step="0.1"
                  defaultValue="1.0"
                  className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
                <p className="text-xs text-tawf-muted mt-1">Fee for cooperative services</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-tawf-ink mb-2">Min Investment ($)</label>
                <input
                  type="number"
                  defaultValue="10"
                  className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
                />
                <p className="text-xs text-tawf-muted mt-1">Minimum investment per pool</p>
              </div>
            </div>
          </div>

          {/* Sharia Compliance Settings */}
          <div>
            <h3 className="font-medium text-tawf-green mb-4">Shariah Compliance Settings</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                <div>
                  <p className="font-medium text-tawf-green">Require Shariah Compliance</p>
                  <p className="text-sm text-tawf-muted">All pools must be Shariah compliant</p>
                </div>
                <div className="w-12 h-6 bg-tawf-green rounded-full relative">
                  <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
              <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                <div>
                  <p className="font-medium text-tawf-green">Shariah Board Approval</p>
                  <p className="text-sm text-tawf-muted">Require board approval for new pools</p>
                </div>
                <div className="w-12 h-6 bg-tawf-green rounded-full relative">
                  <span className="absolute top-1 left-7 w-4 h-4 bg-white rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* Maintenance Mode */}
          <div>
            <h3 className="font-medium text-tawf-green mb-4">System Status</h3>
            <div className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
              <div>
                <p className="font-medium text-tawf-green">Maintenance Mode</p>
                <p className="text-sm text-tawf-muted">Temporarily disable platform for maintenance</p>
              </div>
              <div className="w-12 h-6 bg-gray-200 rounded-full relative">
                <span className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full" />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-tawf-green-10">
            <Button variant="primary" size="md">Save Changes</Button>
          </div>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="p-6 border-red-200">
        <h3 className="font-medium text-red-600 mb-4">Danger Zone</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
            <div>
              <p className="font-medium text-red-700">Reset All Data</p>
              <p className="text-sm text-red-600">Permanently delete all platform data (cannot be undone)</p>
            </div>
            <Button variant="ghost" size="md" className="text-red-600 hover:bg-red-100">
              Reset Platform
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
