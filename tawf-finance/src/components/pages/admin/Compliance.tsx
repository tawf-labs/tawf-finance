import { Shield, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import { mockComplianceDocuments, mockSystemAlerts } from '@/data/mockData';

export function AdminCompliance() {
  const pendingDocs = mockComplianceDocuments.filter(d => d.status === 'pending');
  const verifiedDocs = mockComplianceDocuments.filter(d => d.status === 'verified');

  const tabs = [
    { id: 'alerts', label: 'System Alerts', content: null, badge: mockSystemAlerts.filter(a => !a.resolved).length },
    { id: 'pending', label: 'Pending Reviews', content: null, badge: pendingDocs.length },
    { id: 'approved', label: 'Approved', content: null, badge: verifiedDocs.length },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Compliance & Security</h1>
        <p className="text-tawf-muted">Monitor platform compliance and security alerts</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-50 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Critical Alerts</p>
              <p className="font-serif text-xl text-red-600">{mockSystemAlerts.filter(a => a.severity === 'critical' && !a.resolved).length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Pending KYC</p>
              <p className="font-serif text-xl text-tawf-green">{pendingDocs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Verified Users</p>
              <p className="font-serif text-xl text-tawf-green">{verifiedDocs.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-gold-10 rounded-xl">
              <Shield className="w-5 h-5 text-tawf-gold" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Sharia Compliance</p>
              <p className="font-serif text-xl text-tawf-green">100%</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs Content */}
      <Card className="p-6">
        <Tabs tabs={tabs} defaultTab="alerts" variant="pills" />

        <div className="mt-6">
          {/* System Alerts */}
          <div className="space-y-3">
            {mockSystemAlerts.map((alert) => (
              <div key={alert.id} className={`p-4 rounded-xl border ${
                alert.severity === 'critical' ? 'bg-red-50 border-red-200' :
                alert.severity === 'high' ? 'bg-orange-50 border-orange-200' :
                alert.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-tawf-sand-30 border-tawf-green-10'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      alert.severity === 'critical' ? 'bg-red-100' :
                      alert.severity === 'high' ? 'bg-orange-100' :
                      alert.severity === 'medium' ? 'bg-yellow-100' :
                      'bg-gray-100'
                    }`}>
                      {alert.severity === 'critical' && <AlertTriangle className="w-5 h-5 text-red-600" />}
                      {alert.severity === 'high' && <AlertTriangle className="w-5 h-5 text-orange-600" />}
                      {alert.severity === 'medium' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                      {alert.severity === 'low' && <Shield className="w-5 h-5 text-gray-600" />}
                    </div>
                    <div>
                      <p className={`font-medium ${
                        alert.severity === 'critical' ? 'text-red-800' :
                        alert.severity === 'high' ? 'text-orange-800' :
                        alert.severity === 'medium' ? 'text-yellow-800' :
                        'text-tawf-green'
                      }`}>
                        {alert.title}
                      </p>
                      <p className={`text-sm ${
                        alert.severity === 'critical' ? 'text-red-600' :
                        alert.severity === 'high' ? 'text-orange-600' :
                        alert.severity === 'medium' ? 'text-yellow-600' :
                        'text-tawf-muted'
                      }`}>
                        {alert.message}
                      </p>
                      <p className="text-xs text-tawf-muted mt-1">{alert.createdAt}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {!alert.resolved && (
                      <Badge variant={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'default'} size="sm">
                        {alert.severity}
                      </Badge>
                    )}
                    {!alert.resolved && (
                      <Button variant="primary" size="sm">Resolve</Button>
                    )}
                    {alert.resolved && (
                      <Badge variant="success" size="sm">Resolved</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Audit Log */}
      <Card className="p-6">
        <h2 className="font-serif text-xl text-tawf-green mb-4">Recent Audit Log</h2>
        <div className="space-y-3">
          {[
            { action: 'User verification approved', user: 'Admin', time: '5 min ago', ip: '192.168.1.1' },
            { action: 'Pool created', user: 'Admin', time: '15 min ago', ip: '192.168.1.1' },
            { action: 'Alert resolved', user: 'Admin', time: '1 hour ago', ip: '192.168.1.1' },
            { action: 'User suspended', user: 'Admin', time: '2 hours ago', ip: '192.168.1.1' },
            { action: 'System settings updated', user: 'Admin', time: '3 hours ago', ip: '192.168.1.1' },
          ].map((log, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-tawf-sand-30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-tawf-green">{log.action}</p>
                <p className="text-xs text-tawf-muted">by {log.user} · {log.ip}</p>
              </div>
              <span className="text-xs text-tawf-muted">{log.time}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
