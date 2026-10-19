import './utils/polyfills';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Deregister any legacy service worker and clear stale CacheStorage
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      registration.unregister().catch(() => {});
    }
  }).catch(() => {});
  if (typeof caches !== 'undefined') {
    caches.keys().then((keys) => {
      for (const key of keys) {
        caches.delete(key).catch(() => {});
      }
    }).catch(() => {});
  }
}

async function bootstrap() {
  // Dev-only presentation mode with a simulated desktop backend (stripped from production builds)
  if (import.meta.env.DEV && new URLSearchParams(location.search).has('demo')) {
    const { installDemoMode } = await import('./demo/demoMode');
    await installDemoMode();
  }

  createRoot(document.getElementById('root')!).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

void bootstrap();


