import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {installApiAuth} from './utils/apiAuth';
import './index.css';

// Jeton de session joint à chaque appel /api (authentification serveur obligatoire)
installApiAuth();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
