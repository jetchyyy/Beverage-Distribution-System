import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, HelpCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface FeedbackModalProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  type?: ModalType;
  title: string;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  open,
  onOpenChange,
  type = 'info',
  title,
  description,
  confirmText = 'OK',
  cancelText = 'Cancel',
  confirmVariant,
  onConfirm,
  onCancel,
  loading = false,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="mx-auto sm:mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-900 border border-zinc-200">
            <CheckCircle2 className="h-6 w-6 text-zinc-900" />
          </div>
        );
      case 'error':
        return (
          <div className="mx-auto sm:mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 border border-red-200">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
        );
      case 'warning':
        return (
          <div className="mx-auto sm:mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600 border border-amber-200">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
        );
      case 'confirm':
        return (
          <div className="mx-auto sm:mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-800 border border-zinc-200">
            <HelpCircle className="h-6 w-6 text-zinc-800" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="mx-auto sm:mx-0 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200">
            <Info className="h-6 w-6 text-zinc-700" />
          </div>
        );
    }
  };

  const defaultButtonVariant = () => {
    if (confirmVariant) return confirmVariant;
    if (type === 'error' || confirmVariant === 'destructive') return 'destructive';
    return 'default';
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    if (onOpenChange) onOpenChange(false);
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    if (onOpenChange) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 bg-white border-zinc-200 shadow-2xl rounded-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
          {getIcon()}
          <div className="flex-1 text-center sm:text-left space-y-1">
            <DialogHeader className="p-0 text-center sm:text-left">
              <DialogTitle className="text-base font-semibold text-zinc-900 tracking-tight">
                {title}
              </DialogTitle>
              {description && (
                <DialogDescription className="text-sm text-zinc-600 mt-1.5 leading-relaxed">
                  {description}
                </DialogDescription>
              )}
            </DialogHeader>
          </div>
        </div>

        <DialogFooter className="mt-6 flex-col-reverse sm:flex-row sm:justify-end gap-2">
          {type === 'confirm' && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
              className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 w-full sm:w-auto"
            >
              {cancelText}
            </Button>
          )}
          <Button
            type="button"
            variant={defaultButtonVariant()}
            onClick={handleConfirm}
            disabled={loading}
            className={cn(
              'w-full sm:w-auto font-medium',
              defaultButtonVariant() === 'default' && 'bg-zinc-900 text-white hover:bg-zinc-800'
            )}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
