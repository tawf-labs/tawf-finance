import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface Props {
  children: ReactNode;
  /** Changing this value clears a caught error, so navigating away recovers. */
  resetKey?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render errors so one broken page shows a message instead of a blank
 * screen. React unmounts the whole tree on an uncaught render error.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen bg-tawf-sand flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-serif text-2xl text-tawf-green mb-2">Something went wrong</h1>
          <p className="text-tawf-muted mb-6">
            This page failed to load. Reloading usually fixes it. If it keeps happening, please tell us which page you were on.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-5 py-2 rounded-lg bg-tawf-green text-tawf-sand"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

/** ErrorBoundary that resets whenever the route changes. Must render inside the router. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}
