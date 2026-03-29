import { Shield, CheckCircle, Clock, AlertCircle, Upload } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMockData } from '@/hooks/useMockData';
import { formatDate } from '@/data/mockData';

export function Compliance() {
  const { complianceDocuments } = useMockData();

  const documentTypes = [
    { type: 'Business License', required: true, desc: 'Valid business registration from government authority' },
    { type: 'Tax ID', required: true, desc: 'Tax identification number' },
    { type: 'Certificate of Sharia Compliance', required: false, desc: 'Shariah compliance certification' },
    { type: 'ISO Certification', required: false, desc: 'Quality management certification' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'pending': return <Clock className="w-5 h-5 text-yellow-600" />;
      case 'rejected': return <AlertCircle className="w-5 h-5 text-red-600" />;
      default: return <Upload className="w-5 h-5 text-gray-400" />;
    }
  };

  const hasDocument = (type: string) => {
    return complianceDocuments.find(d => d.documentType === type);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl text-tawf-green mb-2">Compliance</h1>
        <p className="text-tawf-muted">Manage your regulatory documentation</p>
      </div>

      {/* Status Overview */}
      <Card className="p-6 bg-gradient-to-br from-tawf-green to-tawf-green-light text-white">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-white/20 rounded-xl">
            <Shield className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <h2 className="font-serif text-xl mb-1">Compliance Status</h2>
            <p className="text-tawf-sand-80 text-sm">
              Your vendor account is in good standing. All required documents are verified.
            </p>
          </div>
          <Badge variant="success" size="md" className="bg-white text-tawf-green">Verified</Badge>
        </div>
      </Card>

      {/* Required Documents */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Required Documents</h3>
        <div className="space-y-4">
          {documentTypes.map((docType) => {
            const existingDoc = hasDocument(docType.type);
            return (
              <div key={docType.type} className="flex items-center justify-between p-4 border border-tawf-green-10 rounded-xl">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-tawf-green">{docType.type}</h4>
                    {docType.required && <span className="text-xs text-tawf-muted">(Required)</span>}
                    {existingDoc && (
                      <Badge variant={existingDoc.status === 'verified' ? 'success' : existingDoc.status === 'pending' ? 'warning' : 'error'} size="sm">
                        {existingDoc.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-tawf-muted mt-1">{docType.desc}</p>
                  {existingDoc && (
                    <p className="text-xs text-tawf-muted mt-1">
                      Uploaded: {formatDate(existingDoc.uploadedAt)}
                      {existingDoc.expiresAt && ` · Expires: ${formatDate(existingDoc.expiresAt)}`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {existingDoc ? (
                    <>
                      {getStatusIcon(existingDoc.status)}
                      <Button variant="secondary" size="sm">Update</Button>
                    </>
                  ) : (
                    <>
                      {getStatusIcon('none')}
                      <Button variant="primary" size="sm">Upload</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Uploaded Documents */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Document History</h3>
        <div className="space-y-3">
          {complianceDocuments.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-4 bg-tawf-sand-30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded-lg">
                  <svg className="w-5 h-5 text-tawf-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-tawf-green">{doc.fileName}</p>
                  <p className="text-xs text-tawf-muted">{doc.documentType}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={doc.status === 'verified' ? 'success' : doc.status === 'pending' ? 'warning' : 'error'} size="sm">
                  {doc.status}
                </Badge>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Compliance Guidelines */}
      <Card className="p-6">
        <h3 className="font-serif text-xl text-tawf-green mb-4">Compliance Guidelines</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <h4 className="font-medium text-tawf-green mb-2">Shariah Compliance</h4>
            <p className="text-sm text-tawf-muted">
              All vendors must comply with Islamic finance principles. Avoid interest-based transactions and prohibited activities.
            </p>
          </div>
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <h4 className="font-medium text-tawf-green mb-2">Data Protection</h4>
            <p className="text-sm text-tawf-muted">
              Ensure all personal and business data is handled according to Indonesian data protection regulations.
            </p>
          </div>
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <h4 className="font-medium text-tawf-green mb-2">Anti-Money Laundering</h4>
            <p className="text-sm text-tawf-muted">
              Maintain proper records and report suspicious transactions as per AML regulations.
            </p>
          </div>
          <div className="p-4 bg-tawf-sand-30 rounded-xl">
            <h4 className="font-medium text-tawf-green mb-2">Quality Standards</h4>
            <p className="text-sm text-tawf-muted">
              Maintain quality standards and timely delivery to ensure positive ratings from partners.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
