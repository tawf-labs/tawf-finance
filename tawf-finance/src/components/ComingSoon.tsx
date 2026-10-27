import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';

/**
 * Placeholder for features kept in the codebase but switched off for the
 * pilot (see src/config/features.ts).
 */
export function ComingSoon({ title, body }: { title: string; body: string }) {
  return (
    <Card className="p-10 text-center max-w-2xl mx-auto">
      <Clock className="w-14 h-14 text-tawf-gold mx-auto mb-4" />
      <h2 className="font-serif text-2xl text-tawf-green mb-2">{title}</h2>
      <p className="text-tawf-muted mb-6">{body}</p>
      <Link to="/investor/deposito" className="text-sm font-medium text-tawf-green hover:underline">
        See the Tawf Deposito Pool →
      </Link>
    </Card>
  );
}
