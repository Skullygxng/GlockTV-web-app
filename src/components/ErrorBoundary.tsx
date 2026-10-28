import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportError } from '../lib/errorReporting';

/*
 * React unmounts the whole tree when a render throws, which on a phone is
 * indistinguishable from a broken build: a blank page with no way back. This
 * keeps something on screen and offers the one action that helps.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    reportError(error, `render:${(info.componentStack ?? '').trim().slice(0, 120) || 'unknown'}`);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="overlay">
        <section className="state-panel" role="alert" aria-label="Something went wrong">
          <strong>Something went wrong</strong>
          <span>Reloading usually fixes it. Nothing you saved has been lost.</span>
          <button
            type="button"
            className="state-panel__retry"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </section>
      </div>
    );
  }
}
