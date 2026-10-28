import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LiveTvIntegration } from './components/LiveTvIntegration';
import { reportError } from './lib/errorReporting';
import './styles.css';

/*
 * Anything that escapes React - a failed dynamic import, an event handler, a
 * rejected promise - reaches the reporter rather than disappearing.
 */
window.addEventListener('error', (event) => reportError(event.error ?? event.message, 'window.error'));
window.addEventListener('unhandledrejection', (event) => reportError(event.reason, 'window.unhandledrejection'));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <LiveTvIntegration />
    </ErrorBoundary>
  </StrictMode>,
);