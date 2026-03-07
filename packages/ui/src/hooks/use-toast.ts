import * as React from 'react';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error';
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
}

type ToastAction =
  | { type: 'ADD'; toast: Toast }
  | { type: 'REMOVE'; id: string };

function toastReducer(state: ToastState, action: ToastAction): ToastState {
  switch (action.type) {
    case 'ADD':
      return { toasts: [action.toast, ...state.toasts].slice(0, 5) };
    case 'REMOVE':
      return { toasts: state.toasts.filter((t) => t.id !== action.id) };
  }
}

const ToastContext = React.createContext<{
  toasts: Toast[];
  toast: (t: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(toastReducer, { toasts: [] });

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    dispatch({ type: 'ADD', toast: { ...t, id } });
    setTimeout(() => dispatch({ type: 'REMOVE', id }), t.duration ?? 5000);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    dispatch({ type: 'REMOVE', id });
  }, []);

  return (
    React.createElement(ToastContext.Provider, { value: { toasts: state.toasts, toast, dismiss } }, children)
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
