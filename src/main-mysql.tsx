import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AppMySQL from './AppMySQL.tsx';
import './index.css';
import { MySQLAuthProvider } from './contexts/MySQLAuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MySQLAuthProvider>
      <AppMySQL />
    </MySQLAuthProvider>
  </StrictMode>
);