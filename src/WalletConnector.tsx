import { useState } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';

const WALLET_ICONS: Record<string, string> = {
  kibisis: '🟣',
  lute: '🎸',
  walletconnect: '🔗',
};

const WALLET_LABELS: Record<string, string> = {
  kibisis: 'Kibisis',
  lute: 'Lute',
  walletconnect: 'WalletConnect',
};

interface Props {
  onConnected?: () => void;
}

export function WalletConnector({ onConnected }: Props) {
  const { wallets, activeAddress, activeWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  const handleConnect = async (wallet: typeof wallets[0]) => {
    setConnecting(wallet.id);
    try {
      await wallet.connect();
      setOpen(false);
      onConnected?.();
    } catch (e) {
      console.error('Wallet connect error:', e);
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = () => {
    activeWallet?.disconnect();
  };

  if (activeAddress) {
    return (
      <button className="btn-wallet-connected" onClick={handleDisconnect} title="Click to disconnect">
        {WALLET_ICONS[activeWallet?.id ?? ''] ?? '💼'} {activeAddress.slice(0, 6)}...{activeAddress.slice(-4)}
      </button>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-connect" onClick={() => setOpen(v => !v)}>
        Connect Wallet
      </button>

      {open && (
        <>
          {/* backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            onClick={() => setOpen(false)}
          />
          <div className="wallet-dropdown">
            <div className="wallet-dropdown-title">Select Wallet</div>
            {wallets.map(wallet => (
              <button
                key={wallet.id}
                className="wallet-option"
                onClick={() => handleConnect(wallet)}
                disabled={connecting !== null}
              >
                <span className="wallet-icon">{WALLET_ICONS[wallet.id] ?? '💼'}</span>
                <div>
                  <div className="wallet-name">{WALLET_LABELS[wallet.id] ?? wallet.metadata.name}</div>
                  <div className="wallet-desc">
                    {wallet.id === 'kibisis' && 'Browser extension'}
                    {wallet.id === 'lute' && 'Browser extension'}
                    {wallet.id === 'walletconnect' && 'Mobile via QR code'}
                  </div>
                </div>
                {connecting === wallet.id && <div className="wallet-spinner" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
