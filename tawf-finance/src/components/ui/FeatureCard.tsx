import type { LucideProps } from 'lucide-react';
import { Card } from './Card';

export interface FeatureCardProps {
  icon: React.ComponentType<LucideProps>;
  title: string;
  description: string;
  label?: string;
}

export function FeatureCard({ icon: Icon, title, description, label }: FeatureCardProps) {
  return (
    <Card hover className="p-5 group h-full">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-glaze flex items-center justify-center">
          <Icon className="w-5 h-5 text-jade" strokeWidth={1.5} />
        </div>
        <div className="flex-1">
          {label && <p className="label mb-1">{label}</p>}
          <h3 className="font-serif text-xl text-ink mb-1 group-hover:text-jade transition-colors">
            {title}
          </h3>
          <p className="text-tawf-muted text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </Card>
  );
}
