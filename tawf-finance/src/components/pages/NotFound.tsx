import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFound() {
  return (
    <section className="min-h-[60vh] flex items-center justify-center px-4 py-24">
      <div className="text-center max-w-md">
        <p className="text-sm uppercase tracking-wide text-tawf-muted mb-2">Error 404</p>
        <h1 className="font-serif text-4xl text-tawf-green mb-3">Page not found</h1>
        <p className="text-tawf-muted mb-8">The page you are looking for does not exist or has moved.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link to="/"><Button variant="primary">Go home</Button></Link>
          <Link to="/investor/dashboard"><Button variant="secondary">Open the app</Button></Link>
        </div>
      </div>
    </section>
  );
}
