import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Column<T> {
  id: string;
  header: string;
  cell: (item: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  sortable?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  sortable = false,
  onRowClick,
  emptyMessage = 'No data available',
  className,
}: TableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = (columnId: string) => {
    if (!sortable) return;

    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortColumn) return 0;

    const column = columns.find(col => col.id === sortColumn);
    if (!column) return 0;

    const aValue = column.cell(a);
    const bValue = column.cell(b);

    // Simple string comparison for sorting
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();

    if (sortDirection === 'asc') {
      return aStr.localeCompare(bStr);
    } else {
      return bStr.localeCompare(aStr);
    }
  });

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-tawf-green-10">
            {columns.map((column) => (
              <th
                key={column.id}
                className={cn(
                  'py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-tawf-muted',
                  column.sortable && sortable && 'cursor-pointer hover:text-tawf-green transition-colors',
                  column.className
                )}
                onClick={() => column.sortable && handleSort(column.id)}
              >
                <div className="flex items-center gap-1">
                  {column.header}
                  {sortable && column.sortable && (
                    <span className="flex flex-col">
                      <ChevronUp
                        className={cn(
                          'w-3 h-3 -mb-1.5',
                          sortColumn === column.id && sortDirection === 'asc'
                            ? 'text-tawf-green'
                            : 'text-gray-300'
                        )}
                      />
                      <ChevronDown
                        className={cn(
                          'w-3 h-3 -mt-1.5',
                          sortColumn === column.id && sortDirection === 'desc'
                            ? 'text-tawf-green'
                            : 'text-gray-300'
                        )}
                      />
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-tawf-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((item) => (
              <tr
                key={keyExtractor(item)}
                onClick={() => onRowClick?.(item)}
                className={cn(
                  'border-b border-tawf-green-5 hover:bg-tawf-sand-30 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((column) => (
                  <td key={column.id} className={cn('py-4 px-4 text-sm', column.className)}>
                    {column.cell(item)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
