import { useState, useCallback, useRef, useEffect } from 'react';
import Header from '@/components/game/Header';
import BetControls from '@/components/game/BetControls';
import PlinkoBoard from '@/components/game/PlinkoBoard';
import PayoutTable from '@/components/game/PayoutTable';
import ResultsHistory from '@/components/game/ResultsHistory';
import SessionStats from '@/components/game/SessionStats';
import Leaderboard from '@/components/game/Leaderboard';
import EventLog from '@/components/game/EventLog';
import { useGameState } from '@/hooks/useGameState';
import { useCelebration } from '@/hooks/useCelebration';
import {
  connectWallet,
  disconnectWallet,
  getWalletState,
  setWalletState,
  submitPlinkoBet,
  awaitGameResult,
} from '@/services/voiBlockchain';
import { toast } from 'sonner';

export default function Index() {
  const game = useGameState();
  const { celebrate, setFlashRef } = useCelebration();
  const [dropTrigger, setDropTrigger] = useState(0);
  const [forceBucket, setForceBucket] = useState<number | null>(null);
  const [pendingTx, setPendingTx] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pending on-chain result — resolved bucket/multiplier override
  const onChainResultRef = useRef<{ multiplier: number } | null>(null);

  // ── Demo (token mode OFF) drop ──────────────────────────────────────────
  const handleDrop = useCallback(() => {
    if (game.tokenMode) return; // handled by handleOnChainDrop
    if (!game.deductBet()) {
      toast.error('Insufficient balance!');
      return;
    }
    setForceBucket(null);
    onChainResultRef.current = null;
    game.setIsDropping(true);
    setDropTrigger(prev => prev + 1);
    setTimeout(() => game.setIsDropping(false), 300);
  }, [game]);

  // ── On-chain drop (token mode ON) ───────────────────────────────────────
  const handleOnChainDrop = useCallback(async () => {
    if (pendingTx) return;
    const ws = getWalletState();
    if (!ws.connected || !ws.address) {
      toast.error('Connect your Voi wallet first');
      return;
    }
    if (ws.balance < game.betAmount) {
      toast.error('Insufficient VOI balance');
      return;
    }

    setPendingTx(true);
    game.setIsDropping(true);
    const toastId = toast.loading('Submitting bet on Voi Network...');

    try {
      const { txHash } = await submitPlinkoBet(game.betAmount, game.risk, game.boardRows);
      toast.loading('Waiting for confirmation...', { id: toastId });

      const result = await awaitGameResult(txHash);

      // Store on-chain result for use in onBallLand
      onChainResultRef.current = { multiplier: result.multiplier };

      // Update wallet balance
      setWalletState({ connected: true, address: ws.address, balance: result.payout > 0 ? ws.balance - game.betAmount + result.payout : ws.balance - game.betAmount });

      // Trigger ball drop aimed at the on-chain bucket
      setForceBucket(result.bucketIndex);
      setDropTrigger(prev => prev + 1);

      toast.success(
        result.multiplier >= 5
          ? `🔥 ${result.multiplier.toFixed(2)}x — HUGE WIN! (${txHash.slice(0, 8)}...)`
          : result.multiplier >= 1
          ? `✓ ${result.multiplier.toFixed(2)}x (${txHash.slice(0, 8)}...)`
          : `${result.multiplier.toFixed(2)}x — Better luck next time`,
        { id: toastId, duration: 4000 }
      );
    } catch (e: any) {
      toast.error(e.message ?? 'Transaction failed', { id: toastId });
    } finally {
      setPendingTx(false);
      setTimeout(() => game.setIsDropping(false), 400);
    }
  }, [game, pendingTx]);

  const handleDropMultiple = useCallback((count: number) => {
    if (game.tokenMode) {
      toast.info('Multi-drop not available in token mode');
      return;
    }
    let dropped = 0;
    const interval = setInterval(() => {
      if (dropped >= count || game.balance < game.betAmount) {
        clearInterval(interval);
        return;
      }
      if (game.deductBet()) {
        setForceBucket(null);
        onChainResultRef.current = null;
        setDropTrigger(prev => prev + 1);
        dropped++;
      }
    }, 200);
  }, [game]);

  // Called by PlinkoBoard when ball lands
  const handleBallLand = useCallback((bucketIndex: number, multiplier: number) => {
    // In token mode, use the on-chain multiplier (not physics-derived)
    const finalMultiplier = game.tokenMode && onChainResultRef.current != null
      ? onChainResultRef.current.multiplier
      : multiplier;

    if (!game.tokenMode) {
      game.addResult(finalMultiplier, bucketIndex);
    } else {
      // In token mode balance is managed by the chain — just record the result
      game.addResult(finalMultiplier, bucketIndex);
    }

    celebrate(finalMultiplier);
    onChainResultRef.current = null;

    if (finalMultiplier >= 5) {
      toast.success(`🔥 ${finalMultiplier}x — HUGE WIN!`, { duration: 3000 });
    } else if (finalMultiplier >= 2) {
      toast.success(`🎉 ${finalMultiplier}x — Nice win!`, { duration: 2000 });
    }
  }, [game, celebrate]);

  const handleAutoToggle = useCallback(() => {
    if (game.tokenMode) {
      toast.info('Auto mode not available in token mode');
      return;
    }
    if (game.autoMode) {
      game.setAutoMode(false);
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    } else {
      game.setAutoMode(true);
    }
  }, [game]);

  // Auto-drop (demo only)
  useEffect(() => {
    if (game.autoMode && !game.tokenMode) {
      autoIntervalRef.current = setInterval(() => {
        if (game.balance >= game.betAmount) {
          if (game.deductBet()) {
            setForceBucket(null);
            onChainResultRef.current = null;
            setDropTrigger(prev => prev + 1);
          }
        } else {
          game.setAutoMode(false);
        }
      }, 800);
    }
    return () => {
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
    };
  }, [game.autoMode, game.tokenMode, game]);

  // Wallet connect/disconnect
  const handleConnectWallet = async () => {
    try {
      const wallet = await connectWallet();
      setWalletAddress(wallet.address);
      toast.success(`Connected: ${wallet.address?.slice(0, 8)}...`);
    } catch (e: any) {
      toast.error(e.message ?? 'Wallet connection failed');
    }
  };

  const handleDisconnect = async () => {
    await disconnectWallet();
    setWalletAddress(null);
    game.setTokenMode(false);
    toast.info('Wallet disconnected');
  };

  // Sync token mode toggle — require wallet
  const handleTokenModeToggle = async () => {
    if (!game.tokenMode) {
      const ws = getWalletState();
      if (!ws.connected) {
        try {
          const wallet = await connectWallet();
          setWalletAddress(wallet.address);
          game.setTokenMode(true);
          toast.success(`Token mode on — ${wallet.address?.slice(0, 8)}...`);
        } catch (e: any) {
          toast.error(e.message ?? 'Connect wallet to use token mode');
        }
      } else {
        game.setTokenMode(true);
      }
    } else {
      game.setTokenMode(false);
    }
  };

  const activeDrop = game.tokenMode ? handleOnChainDrop : handleDrop;

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      <div
        ref={setFlashRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ opacity: 0 }}
      />
      <Header
        tokenMode={game.tokenMode}
        onConnectWallet={walletAddress ? handleDisconnect : handleConnectWallet}
        walletAddress={walletAddress}
      />

      <main className="flex-1 container py-4">
        <div className="flex flex-col items-center gap-4 max-w-6xl mx-auto">
          <div className="w-full max-w-[600px]">
            <BetControls
              balance={game.tokenMode ? getWalletState().balance : game.balance}
              risk={game.risk}
              boardRows={game.boardRows}
              betAmount={game.betAmount}
              isDropping={game.isDropping || pendingTx}
              autoMode={game.autoMode}
              tokenMode={game.tokenMode}
              onRiskChange={game.setRisk}
              onBoardRowsChange={game.setBoardRows}
              onBetChange={game.setBetAmount}
              onDrop={activeDrop}
              onDropMultiple={handleDropMultiple}
              onAutoToggle={handleAutoToggle}
              onTokenModeToggle={handleTokenModeToggle}
              onResetBalance={game.resetBalance}
            />
          </div>

          <PlinkoBoard
            risk={game.risk}
            rows={game.boardRows}
            onBallLand={handleBallLand}
            dropTrigger={dropTrigger}
            forceBucket={forceBucket}
          />

          <div className="w-full max-w-[500px]">
            <PayoutTable risk={game.risk} rows={game.boardRows} />
          </div>

          <div className="w-full max-w-[600px] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SessionStats stats={game.stats} />
            <ResultsHistory results={game.results} />
          </div>

          <div className="w-full max-w-[600px] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Leaderboard />
            <EventLog results={game.results} />
          </div>

          {/* Provably fair */}
          <div className="glass rounded-xl p-4 w-full max-w-[600px]">
            <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Provably Fair</h3>
            {game.tokenMode ? (
              <p className="text-xs text-muted-foreground">
                Results are derived on-chain from <code className="text-primary">sha256(txID + round)</code> — verifiable by anyone on Voi Network. App ID: <code className="text-primary">49028406</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Enable Token Mode to play with real VOI on Voi Network. Results are provably fair via on-chain randomness.
              </p>
            )}
            <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/50 text-xs text-muted-foreground font-mono">
              {game.tokenMode ? `Contract: 49028406 | Network: Voi Mainnet` : 'Mode: Demo (no real tokens)'}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
