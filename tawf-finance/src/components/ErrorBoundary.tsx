import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Optional label shown in the fallback, e.g. "dashboard". */
  area?: string;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render-time errors in its subtree and shows a fallback instead of a
 * blank white screen. React error boundaries must be class components.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface the error in the console for debugging without crashing the app.
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const area = this.props.area ? ` in the ${this.props.area}` : '';
    return (
      <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-tawf-green/10 p-8 text-center">
          <h1 className="font-serif text-2xl text-tawf-green mb-3">Something went wrong</h1>
          <p className="text-tawf-muted text-sm leading-relaxed mb-6">
            An unexpected error occurred{area}. Your funds and data are not affected. Try
            reloading the page, and if it persists, reconnect your wallet.
          </p>
          <button
            onClick={this.handleReload}
            className="px-6 py-3 rounded-full bg-tawf-green text-tawf-sand font-medium text-sm uppercase tracking-wide hover:bg-tawf-gold hover:text-tawf-green transition-colors"
          >
            Reload
          </button>
          {this.state.message && (
            <p className="mt-6 text-xs text-tawf-muted/70 font-mono break-words">
              {this.state.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
