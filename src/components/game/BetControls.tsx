import { RiskLevel, BoardSize, BET_OPTIONS, BOARD_SIZES } from '@/config/gameConfig';
import { Minus, Plus, Zap, RotateCcw } from 'lucide-react';

interface BetControlsProps {
  balance: number;
  risk: RiskLevel;
  boardRows: BoardSize;
  betAmount: number;
  isDropping: boolean;
  autoMode: boolean;
  tokenMode: boolean;
  onRiskChange: (risk: RiskLevel) => void;
  onBoardRowsChange: (rows: BoardSize) => void;
  onBetChange: (amount: number) => void;
  onDrop: () => void;
  onDropMultiple: (count: number) => void;
  onAutoToggle: () => void;
  onTokenModeToggle: () => void;
  onResetBalance: () => void;
}

const riskOptions: { value: RiskLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Med' },
  { value: 'high', label: 'High' },
];

const riskStyles: Record<RiskLevel, string> = {
  low: 'bg-primary/20 text-primary border-primary/40',
  medium: 'bg-win/20 text-win border-win/40',
  high: 'bg-destructive/20 text-destructive border-destructive/40',
};

export default function BetControls({
  balance, risk, boardRows, betAmount, isDropping, autoMode, tokenMode,
  onRiskChange, onBoardRowsChange, onBetChange, onDrop, onDropMultiple,
  onAutoToggle, onTokenModeToggle, onResetBalance,
}: BetControlsProps) {
  const canBet = balance >= betAmount && !isDropping;

  const adjustBet = (dir: 'up' | 'down') => {
    const idx = BET_OPTIONS.indexOf(betAmount);
    if (dir === 'up' && idx < BET_OPTIONS.length - 1) onBetChange(BET_OPTIONS[idx + 1]);
    if (dir === 'down' && idx > 0) onBetChange(BET_OPTIONS[idx - 1]);
  };

  return (
    <div className="glass rounded-xl p-4 space-y-4 animate-fade-in">
      {/* Balance */}
      <div className="text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          {tokenMode ? 'Wallet Balance' : 'Demo Balance'}
        </p>
        <p className="font-mono text-2xl font-bold text-foreground">
          {balance.toFixed(2)}
          <span className="text-xs text-muted-foreground ml-1">VOI</span>
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/50">
        <span className="text-xs text-muted-foreground">Token Mode</span>
        <button
          onClick={onTokenModeToggle}
          className={`w-10 h-5 rounded-full relative transition-colors ${
            tokenMode ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-foreground transition-transform ${
              tokenMode ? 'left-5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Risk Selector */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Risk</p>
        <div className="grid grid-cols-3 gap-2">
          {riskOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => onRiskChange(opt.value)}
              className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                risk === opt.value
                  ? riskStyles[opt.value]
                  : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bet Amount */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Bet Amount</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => adjustBet('down')}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
          >
            <Minus size={14} />
          </button>
          <div className="flex-1 text-center font-mono text-lg font-semibold text-foreground">
            {betAmount}
          </div>
          <button
            onClick={() => adjustBet('up')}
            className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-muted-foreground"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="flex gap-1 mt-2 flex-wrap">
          {[0.1, 1, 5, 10, 50].map(v => (
            <button
              key={v}
              onClick={() => onBetChange(v)}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                betAmount === v
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-secondary/50 text-muted-foreground hover:bg-secondary'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Drop Buttons */}
      <button
        onClick={onDrop}
        disabled={!canBet}
        className={`w-full py-3 rounded-xl font-heading font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
          canBet
            ? 'bg-primary text-primary-foreground hover:brightness-110 glow-primary active:scale-95'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        }`}
      >
        <Zap size={16} />
        Drop Ball
      </button>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onDropMultiple(10)}
          disabled={balance < betAmount * 10}
          className="py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Drop 10
        </button>
        <button
          onClick={onAutoToggle}
          className={`py-2 rounded-lg text-xs font-medium transition-colors ${
            autoMode
              ? 'bg-primary/20 text-primary border border-primary/30'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {autoMode ? 'Stop Auto' : 'Auto Drop'}
        </button>
      </div>

      {/* Reset */}
      <button
        onClick={onResetBalance}
        className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw size={12} />
        Reset Balance
      </button>
    </div>
  );
}
