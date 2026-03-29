import { useState, useCallback, useRef, useEffect } from 'react';
import Header from '@/components/game/Header';
import BetControls from '@/components/game/BetControls';
import PlinkoBoard from '@/components/game/PlinkoBoard';
import PayoutTable from '@/components/game/PayoutTable';
import ResultsHistory from '@/components/game/ResultsHistory';
import SessionStats from '@/components/game/SessionStats';
import { useGameState } from '@/hooks/useGameState';
import { useCelebration } from '@/hooks/useCelebration';
import { connectWallet } from '@/services/voiBlockchain';
import { toast } from 'sonner';

export default function Index() {
  const game = useGameState();
  const { celebrate, setFlashRef } = useCelebration();
  const [dropTrigger, setDropTrigger] = useState(0);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleDrop = useCallback(() => {
    if (!game.deductBet()) {
      toast.error('Insufficient balance!');
      return;
    }
    game.setIsDropping(true);
    setDropTrigger(prev => prev + 1);
    setTimeout(() => game.setIsDropping(false), 300);
  }, [game]);

  const handleDropMultiple = useCallback((count: number) => {
    let dropped = 0;
    const interval = setInterval(() => {
      if (dropped >= count || game.balance < game.betAmount) {
        clearInterval(interval);
        return;
      }
      if (game.deductBet()) {
        setDropTrigger(prev => prev + 1);
        dropped++;
      }
    }, 200);
  }, [game]);

  const handleBallLand = useCallback((bucketIndex: number, multiplier: number) => {
    game.addResult(multiplier, bucketIndex);
    celebrate(multiplier);

    if (multiplier >= 5) {
      toast.success(`🔥 ${multiplier}x — HUGE WIN!`, { duration: 3000 });
    } else if (multiplier >= 2) {
      toast.success(`🎉 ${multiplier}x — Nice win!`, { duration: 2000 });
    }
  }, [game, celebrate]);

  const handleAutoToggle = useCallback(() => {
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

  // Auto-drop effect
  useEffect(() => {
    if (game.autoMode) {
      autoIntervalRef.current = setInterval(() => {
        if (game.balance >= game.betAmount) {
          if (game.deductBet()) {
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
  }, [game.autoMode, game]);

  const handleConnectWallet = async () => {
    try {
      const wallet = await connectWallet();
      toast.success(`Connected: ${wallet.address}`);
    } catch {
      toast.error('Wallet connection failed');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background relative">
      {/* Screen flash overlay */}
      <div
        ref={setFlashRef}
        className="fixed inset-0 pointer-events-none z-50"
        style={{ opacity: 0 }}
      />
      <Header tokenMode={game.tokenMode} onConnectWallet={handleConnectWallet} />

      <main className="flex-1 container py-4">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_280px] gap-4 max-w-6xl mx-auto">
          {/* Left panel — Controls */}
          <div className="space-y-4 order-2 lg:order-1">
            <BetControls
              balance={game.balance}
              risk={game.risk}
              betAmount={game.betAmount}
              isDropping={game.isDropping}
              autoMode={game.autoMode}
              tokenMode={game.tokenMode}
              onRiskChange={game.setRisk}
              onBetChange={game.setBetAmount}
              onDrop={handleDrop}
              onDropMultiple={handleDropMultiple}
              onAutoToggle={handleAutoToggle}
              onTokenModeToggle={() => game.setTokenMode(!game.tokenMode)}
              onResetBalance={game.resetBalance}
            />
          </div>

          {/* Center — Board */}
          <div className="order-1 lg:order-2 flex flex-col items-center">
            <PlinkoBoard
              risk={game.risk}
              onBallLand={handleBallLand}
              dropTrigger={dropTrigger}
            />
            <div className="mt-4 w-full max-w-[500px]">
              <PayoutTable risk={game.risk} />
            </div>
          </div>

          {/* Right panel — Results & Stats */}
          <div className="space-y-4 order-3">
            <SessionStats stats={game.stats} />
            <ResultsHistory results={game.results} />

            {/* Provably fair placeholder */}
            <div className="glass rounded-xl p-4">
              <h3 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Provably Fair</h3>
              <p className="text-xs text-muted-foreground">
                On-chain fairness verification will be available when Token Mode launches on Voi Network.
              </p>
              <div className="mt-2 px-3 py-2 rounded-lg bg-secondary/50 text-xs text-muted-foreground font-mono">
                Seed: demo_mode
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
