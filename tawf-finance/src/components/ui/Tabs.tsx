import { useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: ReactNode;
  disabled?: boolean;
  badge?: string | number;
}

export interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  variant?: 'underline' | 'pills' | 'segmented';
  className?: string;
  onChange?: (tabId: string) => void;
}

export function Tabs({ tabs, defaultTab, variant = 'underline', className, onChange }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id);

  const handleTabChange = (tabId: string) => {
    if (tabs.find(t => t.id === tabId)?.disabled) return;
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabContent = tabs.find(t => t.id === activeTab)?.content;

  const variantStyles = {
    underline: {
      container: 'border-b border-tawf-green-10',
      tab: 'pb-3 border-b-2 -mb-px transition-colors',
      active: 'border-tawf-green text-tawf-green',
      inactive: 'border-transparent text-tawf-muted hover:text-tawf-green',
    },
    pills: {
      container: 'bg-tawf-sand-30 p-1 rounded-xl inline-flex',
      tab: 'px-4 py-2 rounded-lg transition-all duration-200 text-sm font-medium',
      active: 'bg-white text-tawf-green shadow-sm',
      inactive: 'text-tawf-muted hover:text-tawf-green',
    },
    segmented: {
      container: 'bg-tawf-sand-30 p-1 rounded-lg inline-flex',
      tab: 'px-3 py-1.5 rounded-md transition-all duration-200 text-sm font-medium',
      active: 'bg-tawf-green text-white',
      inactive: 'text-tawf-muted hover:text-tawf-green',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn('w-full', className)}>
      <div className={cn('flex gap-1', styles.container)}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            disabled={tab.disabled}
            className={cn(
              'relative flex items-center gap-2',
              styles.tab,
              activeTab === tab.id ? styles.active : styles.inactive,
              tab.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {tab.icon && <span className="w-4 h-4">{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={cn(
                'ml-1 px-2 py-0.5 text-xs rounded-full',
                activeTab === tab.id
                  ? variant === 'segmented' ? 'bg-white/20 text-white' : 'bg-tawf-green-10 text-tawf-green'
                  : 'bg-tawf-green-10 text-tawf-muted'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTabContent}
      </div>
    </div>
  );
}
