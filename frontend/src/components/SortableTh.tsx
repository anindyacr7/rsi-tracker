import React from 'react';
import clsx from 'clsx';
import type { SortField, SortDirection } from '../types';

interface SortableThProps {
  children: React.ReactNode;
  field: SortField;
  currentSort: { field: SortField; dir: SortDirection };
  onSort: (field: SortField) => void;
  align?: 'left' | 'right' | 'center';
  iconAlign?: 'left' | 'right';
  className?: string;
}

export function SortableTh({ 
  children, 
  field, 
  currentSort, 
  onSort, 
  align = 'left', 
  iconAlign = 'left', 
  className = '' 
}: SortableThProps) {
  const isSorted = currentSort.field === field;
  
  return (
    <th 
      onClick={() => onSort(field)}
      className={clsx(
        "py-2 px-2 font-semibold whitespace-nowrap cursor-pointer hover:text-primary transition-colors group select-none",
        align === 'right' && "text-right",
        align === 'center' && "text-center",
        align === 'left' && "text-left",
        isSorted && "text-primary",
        className
      )}
    >
      <div className={clsx(
        "flex items-center gap-1", 
        align === 'right' ? "justify-end" : align === 'center' ? "justify-center" : "justify-start"
      )}>
        {children} 
        <span className={clsx(
          "material-symbols-outlined text-[16px] transition-opacity", 
          isSorted ? 'opacity-100' : 'text-outline group-hover:text-primary opacity-0 group-hover:opacity-100'
        )}>
          {isSorted ? (currentSort.dir === 'asc' ? 'expand_less' : 'expand_more') : 'unfold_more'}
        </span>
      </div>
    </th>
  );
}
