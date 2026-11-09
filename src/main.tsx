import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import AppFallback from './components/AppFallback';
import './index.css';
import { setupPwa } from './lib/pwa';

setupPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppFallback>
      <App />
    </AppFallback>
  </StrictMode>,
);
