import * as React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6">
            <div className="text-center">
              <h3 className="text-sm font-medium text-red-800">Something went wrong</h3>
              <p className="mt-1 text-xs text-red-600">{this.state.error?.message}</p>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
