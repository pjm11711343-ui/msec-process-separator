import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';
import UpdateBanner from './components/UpdateBanner';
import AppFallback from './components/AppFallback';
import './index.css';
import { setupPwa } from './lib/pwa';

setupPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppFallback>
      <AuthGate>
        <App />
      </AuthGate>
      <UpdateBanner />
    </AppFallback>
  </StrictMode>,
);
