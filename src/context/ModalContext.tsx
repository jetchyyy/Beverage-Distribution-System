import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { FeedbackModal, type ModalType } from '../components/ui/feedback-modal';

export interface ModalOptions {
  title: string;
  description?: string | React.ReactNode;
  type?: ModalType;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
  onConfirm?: () => void;
  onCancel?: () => void;
}

export interface ConfirmOptions {
  title: string;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary';
}

interface SimpleModalOptions {
  title?: string;
  description: string | React.ReactNode;
  confirmText?: string;
}

interface ModalContextType {
  showModal: (options: ModalOptions) => void;
  showSuccess: (options: SimpleModalOptions | string) => void;
  showError: (options: SimpleModalOptions | string) => void;
  showWarning: (options: SimpleModalOptions | string) => void;
  showInfo: (options: SimpleModalOptions | string) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [modalProps, setModalProps] = useState<ModalOptions>({
    title: '',
    description: '',
    type: 'info',
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const closeModal = useCallback(() => {
    setIsOpen(false);
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const showModal = useCallback((options: ModalOptions) => {
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
    setModalProps(options);
    setIsOpen(true);
  }, []);

  const showSuccess = useCallback((options: SimpleModalOptions | string) => {
    const formatted: ModalOptions =
      typeof options === 'string'
        ? { title: 'Success', description: options, type: 'success' }
        : { title: options.title || 'Success', description: options.description, confirmText: options.confirmText || 'OK', type: 'success' };
    showModal(formatted);
  }, [showModal]);

  const showError = useCallback((options: SimpleModalOptions | string) => {
    const formatted: ModalOptions =
      typeof options === 'string'
        ? { title: 'Error', description: options, type: 'error' }
        : { title: options.title || 'Error', description: options.description, confirmText: options.confirmText || 'Dismiss', type: 'error' };
    showModal(formatted);
  }, [showModal]);

  const showWarning = useCallback((options: SimpleModalOptions | string) => {
    const formatted: ModalOptions =
      typeof options === 'string'
        ? { title: 'Warning', description: options, type: 'warning' }
        : { title: options.title || 'Warning', description: options.description, confirmText: options.confirmText || 'OK', type: 'warning' };
    showModal(formatted);
  }, [showModal]);

  const showInfo = useCallback((options: SimpleModalOptions | string) => {
    const formatted: ModalOptions =
      typeof options === 'string'
        ? { title: 'Information', description: options, type: 'info' }
        : { title: options.title || 'Information', description: options.description, confirmText: options.confirmText || 'OK', type: 'info' };
    showModal(formatted);
  }, [showModal]);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalProps({
        title: options.title,
        description: options.description,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmVariant: options.variant || 'default',
        type: 'confirm',
        onConfirm: () => {
          resolve(true);
          resolverRef.current = null;
          setIsOpen(false);
        },
        onCancel: () => {
          resolve(false);
          resolverRef.current = null;
          setIsOpen(false);
        },
      });
      setIsOpen(true);
    });
  }, []);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closeModal();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <ModalContext.Provider
      value={{
        showModal,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        confirm,
        closeModal,
      }}
    >
      {children}
      <FeedbackModal
        open={isOpen}
        onOpenChange={handleOpenChange}
        type={modalProps.type}
        title={modalProps.title}
        description={modalProps.description}
        confirmText={modalProps.confirmText}
        cancelText={modalProps.cancelText}
        confirmVariant={modalProps.confirmVariant}
        onConfirm={modalProps.onConfirm}
        onCancel={modalProps.onCancel}
      />
    </ModalContext.Provider>
  );
};

export const useModal = (): ModalContextType => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};
