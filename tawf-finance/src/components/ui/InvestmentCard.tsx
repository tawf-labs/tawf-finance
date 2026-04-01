import type { HTMLAttributes } from 'react';
import { forwardRef } from 'react';
import { TrendingUp, Clock, DollarSign, Target } from 'lucide-react';
import { cn } from '@/utils/cn';
import { formatCurrency } from '@/data/mockData';
import { Card } from './Card';
import { Badge } from './Badge';
import { ProgressBar } from './ProgressBar';

export interface InvestmentCardProps extends HTMLAttributes<HTMLDivElement> {
  id: string;
  name: string;
  description: string;
  category: string;
  apy: { min: number; max: number };
  duration: { min: number; max: number };
  minInvestment: number;
  tvl: number;
  fundingProgress: number;
  fundingTarget: number;
  available?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  investedAmount?: number;
  showInvestment?: boolean;
  onInvestClick?: (id: string) => void;
  onDetailsClick?: (id: string) => void;
}

const riskLevelConfig = {
  low: { label: 'Low Risk', color: 'success' as const, bgColor: 'bg-green-50' },
  medium: { label: 'Medium Risk', color: 'warning' as const, bgColor: 'bg-yellow-50' },
  high: { label: 'High Risk', color: 'error' as const, bgColor: 'bg-red-50' },
};

export const InvestmentCard = forwardRef<HTMLDivElement, InvestmentCardProps>(
  ({
    id,
    name,
    description,
    category,
    apy,
    duration,
    minInvestment,
    tvl,
    fundingProgress,
    fundingTarget,
    available = true,
    riskLevel = 'medium',
    investedAmount,
    showInvestment = false,
    onInvestClick,
    onDetailsClick,
    className,
    ...props
  }, ref) => {
    const riskConfig = riskLevelConfig[riskLevel];

    return (
      <Card
        ref={ref}
        hover
        className={cn('p-6 h-full flex flex-col', className)}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <Badge variant="info" size="sm">{category}</Badge>
          {available ? (
            <Badge variant="success" size="sm">Open</Badge>
          ) : (
            <Badge variant="default" size="sm">Full</Badge>
          )}
        </div>

        {/* Title */}
        <h3 className="font-serif text-xl text-tawf-green mb-2">{name}</h3>
        <p className="text-tawf-muted text-sm leading-relaxed mb-4 line-clamp-2">
          {description}
        </p>

        {/* Risk Level */}
        {riskLevel && (
          <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-md mb-4', riskConfig.bgColor)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', riskConfig.color === 'success' ? 'bg-green-500' : riskConfig.color === 'warning' ? 'bg-yellow-500' : 'bg-red-500')} />
            <span className="text-xs font-medium">{riskConfig.label}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-tawf-gold shrink-0" />
            <div>
              <p className="text-xs text-tawf-muted">APY</p>
              <p className="font-medium text-tawf-green">{apy.min}-{apy.max}%</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-tawf-gold shrink-0" />
            <div>
              <p className="text-xs text-tawf-muted">Duration</p>
              <p className="font-medium text-tawf-green">{duration.min}-{duration.max}d</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-tawf-gold shrink-0" />
            <div>
              <p className="text-xs text-tawf-muted">Min Investment</p>
              <p className="font-medium text-tawf-green">{minInvestment} USDC</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-tawf-gold shrink-0" />
            <div>
              <p className="text-xs text-tawf-muted">TVL</p>
              <p className="font-medium text-tawf-green">{formatCurrency(tvl)}</p>
            </div>
          </div>
        </div>

        {/* Funding Progress */}
        <div className="mb-4">
          <ProgressBar
            value={fundingProgress}
            max={fundingTarget}
            size="sm"
            color="green"
            showLabel
            label="Funding Progress"
          />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-tawf-muted">{formatCurrency(fundingProgress)} raised</span>
            <span className="text-xs text-tawf-muted">Target: {formatCurrency(fundingTarget)}</span>
          </div>
        </div>

        {/* Invested Amount */}
        {showInvestment && investedAmount && investedAmount > 0 && (
          <div className="mb-4 p-3 bg-tawf-green-5 rounded-lg border border-tawf-green-10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-tawf-muted">Your Investment</span>
              <span className="font-semibold text-tawf-green">{formatCurrency(investedAmount)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex gap-2">
          {onInvestClick && available && (
            <button
              onClick={() => onInvestClick(id)}
              className="flex-1 bg-tawf-green text-tawf-sand py-2.5 px-4 rounded-full text-sm font-medium uppercase tracking-wide hover:bg-tawf-green-light transition-colors"
            >
              Invest Now
            </button>
          )}
          {onDetailsClick && (
            <button
              onClick={() => onDetailsClick(id)}
              className={cn(
                'py-2.5 px-4 rounded-full text-sm font-medium uppercase tracking-wide transition-colors border',
                onInvestClick && available ? 'border-tawf-green text-tawf-green hover:bg-tawf-green hover:text-tawf-sand' : 'flex-1 border-tawf-green text-tawf-green hover:bg-tawf-green hover:text-tawf-sand'
              )}
            >
              View Details
            </button>
          )}
        </div>
      </Card>
    );
  }
);

InvestmentCard.displayName = 'InvestmentCard';
