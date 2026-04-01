import { Wallet, Volume2, VolumeX, LogOut } from 'lucide-react';
import { useState } from 'react';

interface HeaderProps {
  tokenMode: boolean;
  onConnectWallet: () => void;
  walletAddress?: string | null;
}

export default function Header({ tokenMode, onConnectWallet, walletAddress }: HeaderProps) {
  const [soundOn, setSoundOn] = useState(false);
  const short = walletAddress ? walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4) : null;

  return (
    <header className="flex items-center justify-between px-4 py-3 glass-strong">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="text-primary font-heading font-bold text-sm">V</span>
        </div>
        <h1 className="font-heading font-bold text-lg text-foreground">
          Voi <span className="text-primary text-glow-primary">Plinko</span>
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setSoundOn(!soundOn)}
          className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
          aria-label="Toggle sound"
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>

        {walletAddress ? (
          <button
            onClick={onConnectWallet}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/20 border border-primary/40 text-primary text-sm font-medium hover:bg-primary/30 transition-colors"
            title="Disconnect wallet"
          >
            <Wallet size={16} />
            <span className="hidden sm:inline font-mono text-xs">{short}</span>
            <LogOut size={14} className="hidden sm:inline opacity-60" />
          </button>
        ) : (
          <button
            onClick={onConnectWallet}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
          >
            <Wallet size={16} />
            <span className="hidden sm:inline">Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  );
}
