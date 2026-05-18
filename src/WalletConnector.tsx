import { useState } from 'react';
import {
  WalletManager,
  WalletId,
  NetworkConfigBuilder,
} from '@txnlab/use-wallet-react';
import { useWallet } from '@txnlab/use-wallet-react';

// ── Voi Mainnet — mirrors FlowBet exactly ───────────────────────────────────
const networks = new NetworkConfigBuilder()
  .addNetwork('voimain', {
    algod: { token: '', baseServer: 'https://mainnet-api.voi.nodely.dev', port: '443' },
    isTestnet: false,
    genesisHash: 'r20fSQI8gWe/kFZziNonSPCXLwcQmH/nxROvnnueWOk=',
    genesisId: 'voimain-v1.0',
    caipChainId: 'algorand:r20fSQI8gWe_kFZziNonSPCXLwcQmH_n',
  })
  .build();

const wallets: any[] = [
  { id: WalletId.KIBISIS },
  { id: WalletId.LUTE, options: { siteName: 'VOI PLINKO' } },
  {
    id: WalletId.WALLETCONNECT,
    options: {
      projectId: 'cd7fe0125d88d239da79fa286e6de2a8',
      themeMode: 'dark' as const,
      metadata: {
        name: 'VOI PLINKO',
        description: 'On-chain Plinko on the Voi Network',
        url: 'https://voiplinko.com',
        icons: ['https://voiplinko.com/voi-plinko-logo.jpg'],
      },
    },
  },
];

export const walletManager = new WalletManager({
  wallets,
  networks,
  defaultNetwork: 'voimain',
});

// ── Wallet icons / labels ────────────────────────────────────────────────────
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

// ── WalletButton component ───────────────────────────────────────────────────
export function WalletButton() {
  const { wallets: availableWallets, activeAddress, activeWallet } = useWallet();
  const [open, setOpen] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async (wallet: typeof availableWallets[0]) => {
    setConnectingId(wallet.id);
    setError(null);
    try {
      // WalletConnect opens its own modal — close ours first so it's not blocked
      if (wallet.id === 'walletconnect') {
        setOpen(false);
        await wallet.connect();
      } else {
        await wallet.connect({ network: 'voimain' });
      }
      setOpen(false);
    } catch (e: any) {
      console.error('Connect failed:', e);
      const msg = e?.message ?? String(e);
      // Kibisis sometimes throws "already enabled" — treat as success
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('enabled')) {
        setOpen(false);
      } else {
        setError(msg);
      }
    } finally {
      setConnectingId(null);
    }
  };

  const fmt = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

  if (activeAddress) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{
          background: '#18212f', border: '1px solid #00a39e', borderRadius: 8,
          padding: '8px 16px', color: '#00a39e', fontFamily: 'Poppins, sans-serif', fontSize: 14,
        }}>
          {fmt(activeAddress)}
        </div>
        <button
          onClick={() => activeWallet?.disconnect()}
          style={{
            background: '#18212f', border: '1px solid #2a3a52', borderRadius: 8,
            padding: '8px 12px', color: '#888', cursor: 'pointer',
            fontFamily: 'Poppins, sans-serif', fontSize: 13,
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: '#00a39e', border: 'none', borderRadius: 8,
          padding: '10px 22px', color: '#fff', fontWeight: 700,
          fontFamily: 'Poppins, sans-serif', fontSize: 15, cursor: 'pointer',
        }}
      >
        Connect Wallet
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              background: '#18212f', borderRadius: 16, padding: 32, minWidth: 340,
              border: '1px solid #2a3a52', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 style={{
              color: '#fff', margin: '0 0 24px', fontSize: 20,
              fontWeight: 700, fontFamily: 'Poppins, sans-serif',
            }}>
              Connect Wallet
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availableWallets.map(wallet => {
                const isLoading = connectingId === wallet.id;
                return (
                  <button
                    key={wallet.id}
                    onClick={() => handleConnect(wallet)}
                    disabled={!!connectingId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      background: '#0d1b2a', border: '1px solid #2a3a52',
                      borderRadius: 12, padding: '14px 18px',
                      color: '#fff', fontSize: 16, cursor: connectingId ? 'wait' : 'pointer',
                      fontFamily: 'Poppins, sans-serif', fontWeight: 500,
                      opacity: connectingId && !isLoading ? 0.5 : 1,
                      transition: 'border-color 0.15s, background 0.15s',
                      textAlign: 'left', width: '100%',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = '#00a39e';
                      e.currentTarget.style.background = '#112030';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = '#2a3a52';
                      e.currentTarget.style.background = '#0d1b2a';
                    }}
                  >
                    {wallet.metadata?.icon
                      ? <img src={wallet.metadata.icon} style={{ width: 36, height: 36, borderRadius: 8 }} alt="" />
                      : <span style={{ fontSize: 28 }}>{WALLET_ICONS[wallet.id] ?? '💼'}</span>
                    }
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {isLoading ? 'Connecting…' : (WALLET_LABELS[wallet.id] ?? wallet.metadata?.name ?? wallet.id)}
                      </div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {wallet.id === 'kibisis' && 'Browser extension'}
                        {wallet.id === 'lute' && 'Browser extension'}
                        {wallet.id === 'walletconnect' && 'Mobile wallet via QR'}
                      </div>
                    </div>
                    {isLoading && (
                      <div style={{
                        marginLeft: 'auto', width: 20, height: 20,
                        border: '2px solid #00a39e', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 0.7s linear infinite',
                      }} />
                    )}
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{
                marginTop: 16, padding: '10px 14px', background: '#2a0d0d',
                border: '1px solid #7f1d1d', borderRadius: 8,
                color: '#fca5a5', fontSize: 13, fontFamily: 'Poppins, sans-serif',
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ marginTop: 16, padding: '10px 14px', background: '#0d1b2a', borderRadius: 8, fontSize: 12, color: '#666', fontFamily: 'Poppins, sans-serif' }}>
              Wallets detected: {availableWallets.length > 0 ? availableWallets.map(w => w.id).join(', ') : 'none'}
            </div>

            <button
              onClick={() => setOpen(false)}
              style={{
                marginTop: 12, width: '100%', background: 'transparent',
                border: 'none', color: '#666', cursor: 'pointer',
                fontSize: 14, fontFamily: 'Poppins, sans-serif', padding: '8px 0',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
