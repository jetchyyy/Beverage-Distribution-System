import React from 'react';
import { PackageOpen, Plus } from 'lucide-react';
import { Button } from './ui/button';

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionText,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg bg-white border border-zinc-200 border-dashed my-6">
      <div className="p-3 mb-4 text-zinc-500 rounded-full bg-zinc-100 border border-zinc-200">
        {icon || <PackageOpen className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500 max-w-sm mb-6">{description}</p>
      {actionText && onAction && (
        <Button onClick={onAction} size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          <span>{actionText}</span>
        </Button>
      )}
    </div>
  );
};
