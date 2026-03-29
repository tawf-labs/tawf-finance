import { Users, UserPlus, Crown, Shield, Coins, FileText, CheckCircle, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { Modal } from '@/components/ui/Modal';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function Members() {
  const { user } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);

  const members = [
    { id: '1', name: 'Haji Abdullah', role: 'Chairman', email: 'abdullah@bmtberkat.co.id', status: 'active', joined: '2023-08-15' },
    { id: '2', name: 'Siti Aminah', role: 'Secretary', email: 'siti@bmtberkat.co.id', status: 'active', joined: '2023-08-15' },
    { id: '3', name: 'Budi Hartono', role: 'Treasurer', email: 'budi@bmtberkat.co.id', status: 'active', joined: '2023-09-01' },
    { id: '4', name: 'Rahmat Hidayat', role: 'Verification Officer', email: 'rahmat@bmtberkat.co.id', status: 'active', joined: '2023-10-15' },
    { id: '5', name: 'Dewi Sartika', role: 'Member', email: 'dewi@bmtberkat.co.id', status: 'active', joined: '2024-01-10' },
    { id: '6', name: 'Agus Setiawan', role: 'Member', email: 'agus@bmtberkat.co.id', status: 'active', joined: '2024-02-20' },
    { id: '7', name: 'Rina Wati', role: 'Member', email: 'rina@bmtberkat.co.id', status: 'pending', joined: '2024-03-25' },
  ];

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Chairman': return <Crown className="w-4 h-4 text-tawf-gold" />;
      case 'Treasurer': return <Coins className="w-4 h-4 text-tawf-gold" />;
      case 'Secretary': return <FileText className="w-4 h-4 text-tawf-green" />;
      case 'Verification Officer': return <Shield className="w-4 h-4 text-tawf-green" />;
      default: return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-tawf-green mb-2">Cooperative Members</h1>
          <p className="text-tawf-muted">Manage {user?.organization} team members</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-tawf-green-10 rounded-xl">
              <Users className="w-5 h-5 text-tawf-green" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Total Members</p>
              <p className="font-serif text-xl text-tawf-green">{members.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-50 rounded-xl">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Active</p>
              <p className="font-serif text-xl text-tawf-green">{members.filter(m => m.status === 'active').length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-50 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-tawf-muted">Pending</p>
              <p className="font-serif text-xl text-tawf-green">{members.filter(m => m.status === 'pending').length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Members List */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">All Members</h3>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl hover:border-tawf-green-20 transition-colors">
              <div className="flex items-center gap-4">
                <Avatar name={member.name} size="lg" />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-tawf-green">{member.name}</h4>
                    {getRoleIcon(member.role)}
                  </div>
                  <p className="text-sm text-tawf-muted">{member.email}</p>
                  <p className="text-xs text-tawf-muted">Joined {member.joined}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={member.status === 'active' ? 'success' : 'warning'} size="sm">
                  {member.status}
                </Badge>
                <Badge variant="info" size="sm">{member.role}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Add Member Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Member"
        size="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Full Name</label>
            <input
              type="text"
              placeholder="Enter full name"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Email Address</label>
            <input
              type="email"
              placeholder="Enter email address"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Role</label>
            <select className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold">
              <option>Member</option>
              <option>Verification Officer</option>
              <option>Secretary</option>
              <option>Treasurer</option>
              <option>Chairman</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-tawf-ink mb-2">Phone Number</label>
            <input
              type="tel"
              placeholder="+62 xxx xxxx xxxx"
              className="w-full px-4 py-3 border border-tawf-green-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-tawf-gold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary">Send Invite</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
