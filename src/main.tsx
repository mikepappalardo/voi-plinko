import React from 'react';
import ReactDOM from 'react-dom/client';
import { WalletProvider } from '@txnlab/use-wallet-react';
import App from './App';
import { walletManager } from './WalletConnector';
import './index.css';

// Wipe stale use-wallet persisted state
try {
  localStorage.removeItem('@txnlab/use-wallet:v4');
  localStorage.removeItem('@txnlab/use-wallet');
} catch { /* ignore */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WalletProvider manager={walletManager}>
      <App />
    </WalletProvider>
  </React.StrictMode>
);
